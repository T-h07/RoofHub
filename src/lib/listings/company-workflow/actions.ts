"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  getCompanyAdminClient,
  requireCurrentUserScopedCompanyAccess,
} from "@/lib/company/server-authorization";
import { notifyListingWorkflowTransition } from "@/lib/notifications";
import { buildWizardValuesFromDraft } from "@/lib/listings/provider-wizard/mapping";
import {
  evaluateProviderPublishReadiness,
  type ProviderPublishBlocker,
} from "@/lib/listings/provider-wizard/publish";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Enums, Json } from "@/types/database";

import type {
  CompanyListingWorkflowAction,
  CompanyListingWorkflowEventType,
  CompanyListingWorkflowStatus,
} from "./types";

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

type WorkflowTransitionListingRow = {
  id: string;
  title: string;
  organization_id: string;
  created_by_user_id: string;
  assigned_agent_user_id: string | null;
  listing_status: CompanyListingWorkflowStatus;
  published_at: string | null;
  published_by_user_id: string | null;
  slug: string | null;
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
  supabase: ReturnType<typeof getCompanyAdminClient>;
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

function canRunWorkflowAction(input: {
  action: CompanyListingWorkflowAction;
  actorUserId: string;
  membershipRole: Enums<"organization_member_role">;
  listing: WorkflowTransitionListingRow;
}) {
  const isReviewer =
    input.membershipRole === "owner" ||
    input.membershipRole === "admin" ||
    input.membershipRole === "manager";
  const isResponsibleActor =
    input.actorUserId === input.listing.created_by_user_id ||
    input.actorUserId === input.listing.assigned_agent_user_id;

  switch (input.action) {
    case "submit_for_review":
      return {
        allowed: isReviewer || isResponsibleActor,
        message: "Only the assigned agent or original creator can submit this listing for review.",
      };
    case "needs_changes":
    case "approve":
      return {
        allowed: isReviewer,
        message: "Only owner, admin, or manager members can run this workflow action.",
      };
    case "publish":
    case "unpublish":
      return {
        allowed: isReviewer,
        message: "Only owner, admin, or manager members can publish or unpublish listings.",
      };
    default:
      return {
        allowed: false,
        message: "Workflow action is invalid.",
      };
  }
}

function resolveWorkflowTransition(input: {
  action: CompanyListingWorkflowAction;
  currentStatus: CompanyListingWorkflowStatus;
  note: string;
}) {
  switch (input.action) {
    case "submit_for_review":
      if (input.currentStatus !== "draft" && input.currentStatus !== "needs_changes") {
        return {
          ok: false as const,
          message: "Only draft or needs-changes listings can be submitted for review.",
        };
      }

      return {
        ok: true as const,
        nextStatus: "submitted_for_review" as CompanyListingWorkflowStatus,
        eventType: "submitted_for_review" as CompanyListingWorkflowEventType,
      };
    case "needs_changes":
      if (input.currentStatus !== "submitted_for_review") {
        return {
          ok: false as const,
          message: "Only submitted listings can be marked needs changes.",
        };
      }

      if (!input.note) {
        return {
          ok: false as const,
          message: "Review note is required when requesting changes.",
        };
      }

      return {
        ok: true as const,
        nextStatus: "needs_changes" as CompanyListingWorkflowStatus,
        eventType: "needs_changes" as CompanyListingWorkflowEventType,
      };
    case "approve":
      if (input.currentStatus !== "submitted_for_review") {
        return {
          ok: false as const,
          message: "Only submitted listings can be approved.",
        };
      }

      return {
        ok: true as const,
        nextStatus: "approved" as CompanyListingWorkflowStatus,
        eventType: "approved" as CompanyListingWorkflowEventType,
      };
    case "publish":
      if (input.currentStatus !== "approved" && input.currentStatus !== "unpublished") {
        return {
          ok: false as const,
          message: "Only approved or unpublished listings can be published.",
        };
      }

      return {
        ok: true as const,
        nextStatus: "published" as CompanyListingWorkflowStatus,
        eventType: "published" as CompanyListingWorkflowEventType,
      };
    case "unpublish":
      if (input.currentStatus !== "published") {
        return {
          ok: false as const,
          message: "Only published listings can be unpublished.",
        };
      }

      return {
        ok: true as const,
        nextStatus: "unpublished" as CompanyListingWorkflowStatus,
        eventType: "unpublished" as CompanyListingWorkflowEventType,
      };
    default:
      return {
        ok: false as const,
        message: "Workflow action is invalid.",
      };
  }
}

async function appendListingWorkflowEvent(input: {
  listingId: string;
  organizationId: string;
  actorUserId: string;
  eventType: CompanyListingWorkflowEventType;
  fromStatus: Enums<"listing_status"> | null;
  toStatus: Enums<"listing_status"> | null;
  note?: string;
  metadata?: Record<string, unknown>;
}) {
  const adminSupabase = getCompanyAdminClient();
  const { error } = await adminSupabase.from("listing_workflow_events").insert({
    listing_id: input.listingId,
    organization_id: input.organizationId,
    actor_user_id: input.actorUserId,
    event_type: input.eventType,
    from_status: input.fromStatus,
    to_status: input.toStatus,
    note: input.note?.trim() ? input.note.trim() : null,
    metadata: (input.metadata ?? {}) as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
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

  const scopedAccess = await requireCurrentUserScopedCompanyAccess(supabase, {
    permission:
      input.action === "publish" || input.action === "unpublish"
        ? "workflow_publish"
        : "workspace",
    selectionRequiredMessage:
      "Select an active company workspace before managing listing workflow.",
    membershipRequiredMessage:
      "An active company membership is required to manage company listing workflow.",
    forbiddenMessage:
      input.action === "publish" || input.action === "unpublish"
        ? "You do not have permission to publish or unpublish this company listing."
        : "You do not have permission to manage this company listing workflow.",
  });

  if (!scopedAccess.ok) {
    return {
      ok: false,
      message: scopedAccess.message,
    };
  }

  const adminSupabase = getCompanyAdminClient();
  const { data: listingData, error: listingError } = await adminSupabase
    .from("listings")
    .select(
      "id, title, organization_id, created_by_user_id, assigned_agent_user_id, listing_status, published_at, published_by_user_id, slug"
    )
    .eq("id", input.listingId)
    .eq("organization_id", scopedAccess.organization.id)
    .maybeSingle();

  if (listingError || !listingData) {
    return {
      ok: false,
      message: "Listing workflow is unavailable for the selected company workspace.",
    };
  }

  const listing = listingData as WorkflowTransitionListingRow;
  const permissionCheck = canRunWorkflowAction({
    action: input.action,
    actorUserId: profileResult.profile.id,
    membershipRole: scopedAccess.membership.role,
    listing,
  });

  if (!permissionCheck.allowed) {
    return {
      ok: false,
      message: permissionCheck.message,
    };
  }

  if (input.action === "submit_for_review") {
    const readiness = await ensureSubmitForReviewReadiness({
      supabase: adminSupabase,
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

  const transition = resolveWorkflowTransition({
    action: input.action,
    currentStatus: listing.listing_status,
    note: normalizedNote,
  });

  if (!transition.ok) {
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
          error_code: null,
          error_message: transition.message,
        },
      },
    });

    return {
      ok: false,
      message: mapWorkflowActionError(transition.message),
    };
  }

  const nextPublishedAt =
    input.action === "publish"
      ? new Date().toISOString()
      : input.action === "unpublish"
        ? null
        : listing.published_at;
  const nextPublishedByUserId =
    input.action === "publish" ? profileResult.profile.id : listing.published_by_user_id;

  const { data: updatedListingRow, error: updateError } = await adminSupabase
    .from("listings")
    .update({
      listing_status: transition.nextStatus,
      published_at: nextPublishedAt,
      published_by_user_id: nextPublishedByUserId,
      archived_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id)
    .eq("organization_id", scopedAccess.organization.id)
    .select("id, organization_id, slug")
    .maybeSingle();

  if (updateError || !updatedListingRow) {
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
          error_code: updateError?.code ?? null,
          error_message: updateError?.message ?? "unknown_workflow_error",
        },
      },
    });

    return {
      ok: false,
      message: mapWorkflowActionError(updateError?.message ?? ""),
    };
  }

  try {
    await appendListingWorkflowEvent({
      listingId: listing.id,
      organizationId: scopedAccess.organization.id,
      actorUserId: profileResult.profile.id,
      eventType: transition.eventType,
      fromStatus: listing.listing_status,
      toStatus: transition.nextStatus,
      note: normalizedNote,
      metadata: {
        action: input.action,
        actor_role: scopedAccess.membership.role,
      },
    });
  } catch (workflowEventError) {
    await adminSupabase
      .from("listings")
      .update({
        listing_status: listing.listing_status,
        published_at: listing.published_at,
        published_by_user_id: listing.published_by_user_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", listing.id)
      .eq("organization_id", scopedAccess.organization.id);

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
          error_code: null,
          error_message:
            workflowEventError instanceof Error
              ? workflowEventError.message
              : "workflow_event_persist_failed",
        },
      },
    });

    return {
      ok: false,
      message: "Workflow action failed. Please retry.",
    };
  }

  const updatedListing = updatedListingRow as Pick<WorkflowTransitionListingRow, "id" | "organization_id" | "slug">;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.listingStatusChanged,
      actorUserId: profileResult.profile.id,
      actorRole: profileResult.profile.role,
      targetType: "listing",
      targetId: listing.id,
      listingId: listing.id,
      fromStatus: listing.listing_status,
      toStatus: transition.nextStatus,
      metadata: {
        source: "company_workflow",
        action: input.action,
        organization_id: scopedAccess.organization.id,
        note_present: normalizedNote.length > 0,
      },
    },
  });

  await notifyListingWorkflowTransition({
    listingId: listing.id,
    listingTitle: listing.title,
    organizationId: scopedAccess.organization.id,
    action: input.action,
    actorUserId: profileResult.profile.id,
    createdByUserId: listing.created_by_user_id,
    assignedAgentUserId: listing.assigned_agent_user_id,
  });

  await revalidateListingWorkflowPaths({
    listingId: listing.id,
    listingSlug: updatedListing.slug ?? listing.slug ?? null,
    organizationId: scopedAccess.organization.id,
  });

  return {
    ok: true,
    message: toSuccessMessage(input.action),
    previousStatus: listing.listing_status,
    nextStatus: transition.nextStatus,
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
  const adminSupabase = getCompanyAdminClient();
  const { data: listingRow, error: listingError } = await adminSupabase
    .from("listings")
    .select("id, organization_id, listing_status")
    .eq("id", input.listingId)
    .maybeSingle();

  if (listingError || !listingRow?.organization_id) {
    return;
  }

  await appendListingWorkflowEvent({
    listingId: listingRow.id,
    organizationId: listingRow.organization_id,
    actorUserId: input.actorUserId,
    eventType: "created",
    fromStatus: null,
    toStatus: listingRow.listing_status,
    metadata: {
      source: "provider_wizard",
    },
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
