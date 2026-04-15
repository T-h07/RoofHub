"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { buildWizardValuesFromDraft } from "@/lib/listings/provider-wizard/mapping";
import {
  evaluateProviderPublishReadiness,
  type ProviderPublishBlocker,
} from "@/lib/listings/provider-wizard/publish";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Enums } from "@/types/database";

import type { CompanyListingWorkflowAction } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const WORKFLOW_ACTION_VALUES: readonly CompanyListingWorkflowAction[] = [
  "submit_for_review",
  "needs_changes",
  "approve",
  "publish",
  "unpublish",
] as const;

type TransitionCompanyListingWorkflowInput = {
  listingId: string;
  action: CompanyListingWorkflowAction;
  note?: string;
};

export type TransitionCompanyListingWorkflowResult = {
  ok: boolean;
  message: string;
  previousStatus?: Enums<"listing_status">;
  nextStatus?: Enums<"listing_status">;
  blockers?: ProviderPublishBlocker[];
};

type TransitionRpcRow = {
  listing_id: string;
  organization_id: string;
  previous_status: Enums<"listing_status">;
  next_status: Enums<"listing_status">;
  event_type: Enums<"listing_workflow_event_type">;
  published_at: string | null;
  published_by_user_id: string | null;
};

const WORKFLOW_REVIEW_READINESS_LISTING_SELECT = `
  id,
  owner_id,
  organization_id,
  created_by_user_id,
  assigned_agent_user_id,
  published_by_user_id,
  slug,
  title,
  description,
  listing_type,
  property_type,
  listing_status,
  price_amount,
  currency_code,
  deposit_amount,
  area_m2,
  bedrooms,
  bathrooms,
  floor_number,
  total_floors,
  city,
  neighborhood,
  address_text,
  available_from,
  furnished,
  parking,
  pets_allowed,
  elevator,
  balcony,
  internet_included,
  utilities_included,
  heating_type,
  public_location_mode,
  latitude,
  longitude,
  updated_at,
  created_at
`;

type ListingImageReadinessRow = {
  id: string;
  is_cover: boolean;
};

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function isWorkflowAction(value: unknown): value is CompanyListingWorkflowAction {
  return typeof value === "string" && WORKFLOW_ACTION_VALUES.includes(value as CompanyListingWorkflowAction);
}

function mapWorkflowActionError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("requires a company-owned listing")) {
    return "This action is available only for company-owned listings.";
  }

  if (normalized.includes("active company membership")) {
    return "You need an active company membership to manage this listing workflow.";
  }

  if (normalized.includes("creator or assigned agent")) {
    return "Only the assigned agent or original creator can submit this listing for review.";
  }

  if (normalized.includes("owner, admin, or manager")) {
    return "Only owner, admin, or manager members can run this workflow action.";
  }

  if (normalized.includes("review note is required")) {
    return "Add a reviewer note before requesting changes.";
  }

  if (normalized.includes("only submitted listings")) {
    return "This listing must be submitted before reviewers can approve or request changes.";
  }

  if (normalized.includes("approved or unpublished")) {
    return "Only approved or previously unpublished listings can be published.";
  }

  if (normalized.includes("only published listings can be unpublished")) {
    return "Only currently published listings can be unpublished.";
  }

  if (normalized.includes("invalid company listing workflow transition")) {
    return "That status transition is not allowed for company workflow.";
  }

  if (normalized.includes("workflow action is invalid")) {
    return "Workflow action is invalid.";
  }

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "You do not have permission to run this workflow action.";
  }

  return "Workflow action failed. Please retry.";
}

function toSuccessMessage(action: CompanyListingWorkflowAction) {
  switch (action) {
    case "submit_for_review":
      return "Listing submitted for internal review.";
    case "needs_changes":
      return "Listing returned with requested changes.";
    case "approve":
      return "Listing approved. It can now be published.";
    case "publish":
      return "Listing published to RoofHub public discovery.";
    case "unpublish":
      return "Listing unpublished from public discovery.";
    default:
      return "Workflow action completed.";
  }
}

async function ensureSubmitForReviewReadiness(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  listingId: string;
}): Promise<{ ok: true } | { ok: false; message: string; blockers?: ProviderPublishBlocker[] }> {
  const { data: listingDraft, error: listingDraftError } = await input.supabase
    .from("listings")
    .select(WORKFLOW_REVIEW_READINESS_LISTING_SELECT)
    .eq("id", input.listingId)
    .maybeSingle();

  if (listingDraftError || !listingDraft) {
    return {
      ok: false,
      message: "Listing details could not be validated for review readiness.",
    };
  }

  const { data: listingImages, error: listingImagesError } = await input.supabase
    .from("listing_images")
    .select("id, is_cover")
    .eq("listing_id", input.listingId);

  if (listingImagesError) {
    return {
      ok: false,
      message: "Listing photos could not be validated for review readiness.",
    };
  }

  const listingValues = buildWizardValuesFromDraft(listingDraft, {
    preferredContactMethod: "",
    contactMethods: ["in_app"],
    contactEmail: "",
    phone: "",
    whatsappPhone: "",
    viberPhone: "",
  });

  const normalizedImages = (listingImages ?? []) as ListingImageReadinessRow[];
  const reviewReadiness = evaluateProviderPublishReadiness({
    values: listingValues,
    imageCount: normalizedImages.length,
    hasCoverImage: normalizedImages.some((image) => image.is_cover),
  });

  if (reviewReadiness.isReady) {
    return { ok: true };
  }

  const primaryBlocker = reviewReadiness.blockers[0];
  return {
    ok: false,
    message: primaryBlocker
      ? `Listing is not review-ready yet: ${primaryBlocker.title}.`
      : "Listing is not review-ready yet.",
    blockers: reviewReadiness.blockers,
  };
}

async function revalidateListingWorkflowPaths(input: {
  listingId: string;
  listingSlug: string | null;
  organizationId: string;
}) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath(`/dashboard/listings/${input.listingId}/edit`);
  revalidatePath(`/dashboard/listings/${input.listingId}/workflow`);

  if (input.listingSlug) {
    revalidatePath(`/listing/${input.listingSlug}`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (org?.slug) {
    revalidatePath(`/companies/${org.slug}`);
  }
}

export async function transitionCompanyListingWorkflowAction(
  input: TransitionCompanyListingWorkflowInput
): Promise<TransitionCompanyListingWorkflowResult> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      message: "Workflow payload is invalid.",
    };
  }

  if (!isUuid(input.listingId)) {
    return {
      ok: false,
      message: "Listing id is invalid.",
    };
  }

  if (!isWorkflowAction(input.action)) {
    return {
      ok: false,
      message: "Workflow action is invalid.",
    };
  }

  const normalizedNote = typeof input.note === "string" ? input.note.trim() : "";
  if (normalizedNote.length > 2000) {
    return {
      ok: false,
      message: "Review note must be 2000 characters or less.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  const trafficResult = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.providerStatusUpdatePerListing,
    identity: {
      userId: profileResult.profile.id,
      scope: `${input.listingId}:${input.action}`,
      includeIp: false,
    },
    throttledMessage: "Too many workflow actions for this listing. Please wait and retry.",
    unavailableMessage: "Listing workflow is temporarily unavailable. Please retry shortly.",
  });

  if (!trafficResult.ok) {
    return {
      ok: false,
      message: trafficResult.message,
    };
  }

  if (input.action === "submit_for_review") {
    const readiness = await ensureSubmitForReviewReadiness({
      supabase,
      listingId: input.listingId,
    });

    if (!readiness.ok) {
      return {
        ok: false,
        message: readiness.message,
        blockers: readiness.blockers,
      };
    }
  }

  const { data, error } = await supabase
    .rpc("transition_company_listing_workflow", {
      p_listing_id: input.listingId,
      p_action: input.action,
      p_note: normalizedNote.length > 0 ? normalizedNote : undefined,
    })
    .single<TransitionRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.listingStatusChangeFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "listing",
        targetId: input.listingId,
        listingId: input.listingId,
        metadata: {
          source: "company_workflow",
          action: input.action,
          note_present: normalizedNote.length > 0,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_workflow_error",
        },
      },
    });

    return {
      ok: false,
      message: mapWorkflowActionError(error?.message ?? ""),
    };
  }

  const { data: listingRow } = await supabase
    .from("listings")
    .select("slug")
    .eq("id", data.listing_id)
    .maybeSingle();

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.listingStatusChanged,
      actorUserId: profileResult.profile.id,
      actorRole: profileResult.profile.role,
      targetType: "listing",
      targetId: data.listing_id,
      listingId: data.listing_id,
      fromStatus: data.previous_status,
      toStatus: data.next_status,
      metadata: {
        source: "company_workflow",
        action: input.action,
        organization_id: data.organization_id,
        note_present: normalizedNote.length > 0,
      },
    },
  });

  await revalidateListingWorkflowPaths({
    listingId: data.listing_id,
    listingSlug: listingRow?.slug ?? null,
    organizationId: data.organization_id,
  });

  return {
    ok: true,
    message: toSuccessMessage(input.action),
    previousStatus: data.previous_status,
    nextStatus: data.next_status,
  };
}

export async function recordCompanyListingCreatedWorkflowEvent(input: {
  listingId: string;
  actorUserId: string;
  actorRole: Enums<"app_role">;
}) {
  if (!isUuid(input.listingId)) {
    return;
  }

  const supabase = await createServerSupabaseClient();
  const { data: listingRow, error: listingError } = await supabase
    .from("listings")
    .select("id, organization_id, listing_status")
    .eq("id", input.listingId)
    .maybeSingle();

  if (listingError || !listingRow?.organization_id) {
    return;
  }

  await supabase.rpc("log_listing_workflow_event", {
    p_listing_id: listingRow.id,
    p_event_type: "created",
    p_to_status: listingRow.listing_status,
    p_metadata: {
      source: "provider_wizard",
    },
    p_actor_user_id: input.actorUserId,
  });

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.listingStatusChanged,
      actorUserId: input.actorUserId,
      actorRole: input.actorRole,
      targetType: "listing",
      targetId: listingRow.id,
      listingId: listingRow.id,
      toStatus: listingRow.listing_status,
      metadata: {
        source: "company_workflow",
        action: "created",
        organization_id: listingRow.organization_id,
      },
    },
  });
}
