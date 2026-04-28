import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCompanyAdminClient } from "@/lib/company/server-authorization";
import type { Database, Tables } from "@/types/database";
import { canReviewCompanyListingWorkflow } from "@/lib/company/permissions";
import type { Json } from "@/types/database";
import {
  LISTING_EDIT_PATCH_COLUMNS,
  LISTING_EDIT_PATCH_FIELD_LABELS,
  loadListingActiveEditSubmission,
  sanitizeListingEditPatch,
  toListingEditPatchValueLabel,
} from "./edit-submissions";

import type {
  CompanyListingEditFieldDiff,
  CompanyListingEditSubmissionSummary,
  CompanyListingWorkflowCapabilities,
  CompanyListingWorkflowListingSummary,
  CompanyListingWorkflowStatus,
  CompanyListingWorkflowTimelineEvent,
} from "./types";

type WorkflowListingRow = CompanyListingWorkflowListingSummary & {
  owner_id: string;
  description: Tables<"listings">["description"];
  listing_type: Tables<"listings">["listing_type"];
  property_type: Tables<"listings">["property_type"];
  price_amount: Tables<"listings">["price_amount"];
  currency_code: Tables<"listings">["currency_code"];
  deposit_amount: Tables<"listings">["deposit_amount"];
  area_m2: Tables<"listings">["area_m2"];
  bedrooms: Tables<"listings">["bedrooms"];
  bathrooms: Tables<"listings">["bathrooms"];
  floor_number: Tables<"listings">["floor_number"];
  total_floors: Tables<"listings">["total_floors"];
  city: Tables<"listings">["city"];
  neighborhood: Tables<"listings">["neighborhood"];
  address_text: Tables<"listings">["address_text"];
  available_from: Tables<"listings">["available_from"];
  furnished: Tables<"listings">["furnished"];
  parking: Tables<"listings">["parking"];
  pets_allowed: Tables<"listings">["pets_allowed"];
  elevator: Tables<"listings">["elevator"];
  balcony: Tables<"listings">["balcony"];
  internet_included: Tables<"listings">["internet_included"];
  utilities_included: Tables<"listings">["utilities_included"];
  heating_type: Tables<"listings">["heating_type"];
  public_location_mode: Tables<"listings">["public_location_mode"];
  latitude: Tables<"listings">["latitude"];
  longitude: Tables<"listings">["longitude"];
};

type WorkflowMembershipRole = Tables<"organization_members">["role"] | "admin";

const WORKFLOW_TIMELINE_SELECT =
  "id, listing_id, organization_id, actor_user_id, event_type, from_status, to_status, note, created_at, actorProfile:profiles!listing_workflow_events_actor_user_id_fkey(id, display_name, avatar_url)";

const WORKFLOW_LISTING_SELECT = `
  id,
  owner_id,
  organization_id,
  created_by_user_id,
  assigned_agent_user_id,
  published_by_user_id,
  listing_status,
  title,
  description,
  slug,
  updated_at,
  listing_type,
  property_type,
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
  longitude
`;

const COMPANY_WORKFLOW_STATUS_SET: ReadonlySet<CompanyListingWorkflowStatus> = new Set([
  "draft",
  "submitted_for_review",
  "needs_changes",
  "approved",
  "published",
  "unpublished",
  "hidden_by_admin",
]);

function isCompanyWorkflowStatus(value: unknown): value is CompanyListingWorkflowStatus {
  return typeof value === "string" && COMPANY_WORKFLOW_STATUS_SET.has(value as CompanyListingWorkflowStatus);
}

function isCompanyWorkflowReviewer(role: WorkflowMembershipRole | null) {
  if (!role) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  return canReviewCompanyListingWorkflow(role, "active");
}

function isCompanyWorkflowSubmitter(input: {
  role: WorkflowMembershipRole | null;
  actorId: string;
  createdByUserId: string;
  assignedAgentUserId: string | null;
}) {
  if (isCompanyWorkflowReviewer(input.role)) {
    return true;
  }

  return (
    input.actorId === input.createdByUserId ||
    (input.assignedAgentUserId !== null && input.actorId === input.assignedAgentUserId)
  );
}

function resolveWorkflowCapabilities(input: {
  status: WorkflowListingRow["listing_status"];
  role: WorkflowMembershipRole | null;
  actorId: string;
  createdByUserId: string;
  assignedAgentUserId: string | null;
}): CompanyListingWorkflowCapabilities {
  const canReview = isCompanyWorkflowReviewer(input.role);
  const canSubmit =
    (input.status === "draft" || input.status === "needs_changes") &&
    isCompanyWorkflowSubmitter({
      role: input.role,
      actorId: input.actorId,
      createdByUserId: input.createdByUserId,
      assignedAgentUserId: input.assignedAgentUserId,
    });

  const canRequestChanges = canReview && input.status === "submitted_for_review";
  const canApprove = canReview && input.status === "submitted_for_review";
  const canPublish = canReview && (input.status === "approved" || input.status === "unpublished");
  const canUnpublish = canReview && input.status === "published";

  return {
    canSubmitForReview: canSubmit,
    canRequestChanges,
    canApprove,
    canPublish,
    canUnpublish,
    canManageWorkflow: canSubmit || canRequestChanges || canApprove || canPublish || canUnpublish,
  };
}

function toComparablePrimitive(value: unknown): Json {
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}

function buildListingEditDiff(input: {
  listing: WorkflowListingRow;
  proposedPatch: Record<string, Json>;
}): CompanyListingEditFieldDiff[] {
  const diffs: CompanyListingEditFieldDiff[] = [];

  for (const field of LISTING_EDIT_PATCH_COLUMNS) {
    if (!(field in input.proposedPatch)) {
      continue;
    }

    const currentValue = toComparablePrimitive(input.listing[field]);
    const proposedValue = toComparablePrimitive(input.proposedPatch[field]);

    if (JSON.stringify(currentValue) === JSON.stringify(proposedValue)) {
      continue;
    }

    diffs.push({
      field,
      label: LISTING_EDIT_PATCH_FIELD_LABELS[field],
      currentValue: toListingEditPatchValueLabel(currentValue),
      proposedValue: toListingEditPatchValueLabel(proposedValue),
    });
  }

  return diffs;
}

async function resolveViewerWorkflowRole(input: {
  supabase: SupabaseClient<Database>;
  organizationId: string;
  viewerId: string;
  viewerAppRole: Tables<"profiles">["role"];
}): Promise<WorkflowMembershipRole | null> {
  if (input.viewerAppRole === "admin") {
    return "admin";
  }

  const { data, error } = await input.supabase
    .from("organization_members")
    .select("role, member_status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.viewerId)
    .eq("member_status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role;
}

export type CompanyListingWorkflowContextResult =
  | {
      ok: true;
      listing: WorkflowListingRow;
      viewerRole: WorkflowMembershipRole;
      capabilities: CompanyListingWorkflowCapabilities;
      timeline: CompanyListingWorkflowTimelineEvent[];
      activeEditSubmission: CompanyListingEditSubmissionSummary | null;
    }
  | {
      ok: false;
      reason: "not_found" | "forbidden" | "not_company_listing" | "error";
      message: string;
    };

export async function loadCompanyListingWorkflowContextForViewer(
  supabase: SupabaseClient<Database>,
  input: {
    listingId: string;
    viewerId: string;
    viewerAppRole: Tables<"profiles">["role"];
    timelineLimit?: number;
  }
): Promise<CompanyListingWorkflowContextResult> {
  const timelineLimit =
    typeof input.timelineLimit === "number" && Number.isFinite(input.timelineLimit)
      ? Math.max(1, Math.min(64, Math.trunc(input.timelineLimit)))
      : 24;

  const adminSupabase = getCompanyAdminClient();
  const { data: listingRow, error: listingError } = await adminSupabase
    .from("listings")
    .select(WORKFLOW_LISTING_SELECT)
    .eq("id", input.listingId)
    .maybeSingle();

  if (listingError) {
    return {
      ok: false,
      reason: "error",
      message: "Listing workflow is temporarily unavailable.",
    };
  }

  if (!listingRow) {
    return {
      ok: false,
      reason: "not_found",
      message: "Listing workflow record was not found.",
    };
  }

  if (!listingRow.organization_id) {
    return {
      ok: false,
      reason: "not_company_listing",
      message: "Workflow review is available only for company-owned listings.",
    };
  }

  if (!isCompanyWorkflowStatus(listingRow.listing_status)) {
    return {
      ok: false,
      reason: "error",
      message: "Listing workflow status is unsupported for company review.",
    };
  }

  const viewerRole = await resolveViewerWorkflowRole({
    supabase,
    organizationId: listingRow.organization_id,
    viewerId: input.viewerId,
    viewerAppRole: input.viewerAppRole,
  });

  if (!viewerRole) {
    return {
      ok: false,
      reason: "forbidden",
      message: "Active company membership is required to access listing workflow.",
    };
  }

  if (
    !isCompanyWorkflowReviewer(viewerRole) &&
    input.viewerId !== listingRow.created_by_user_id &&
    input.viewerId !== listingRow.assigned_agent_user_id
  ) {
    return {
      ok: false,
      reason: "forbidden",
      message:
        "Listing workflow access is limited to reviewers, the listing creator, or the assigned agent.",
    };
  }

  const capabilities = resolveWorkflowCapabilities({
    status: listingRow.listing_status,
    role: viewerRole,
    actorId: input.viewerId,
    createdByUserId: listingRow.created_by_user_id,
    assignedAgentUserId: listingRow.assigned_agent_user_id,
  });

  const { data: timelineRows, error: timelineError } = await adminSupabase
    .from("listing_workflow_events")
    .select(WORKFLOW_TIMELINE_SELECT)
    .eq("listing_id", listingRow.id)
    .order("created_at", { ascending: false })
    .limit(timelineLimit);

  if (timelineError) {
    return {
      ok: false,
      reason: "error",
      message: "Workflow timeline is temporarily unavailable.",
    };
  }

  const activeSubmissionRow = await loadListingActiveEditSubmission({
    listingId: listingRow.id,
  });
  const activeSubmissionPatch = sanitizeListingEditPatch(activeSubmissionRow?.proposed_patch ?? {});
  const activeSubmissionDiff = activeSubmissionRow
    ? buildListingEditDiff({
        listing: listingRow as WorkflowListingRow,
        proposedPatch: activeSubmissionPatch,
      })
    : [];
  const activeEditSubmission: CompanyListingEditSubmissionSummary | null = activeSubmissionRow
    ? {
        id: activeSubmissionRow.id,
        listingId: activeSubmissionRow.listing_id,
        organizationId: activeSubmissionRow.organization_id,
        status: activeSubmissionRow.status,
        submittedByUserId: activeSubmissionRow.submitted_by_user_id,
        submittedByDisplayName: activeSubmissionRow.submittedBy?.display_name ?? null,
        reviewerUserId: activeSubmissionRow.reviewer_user_id,
        reviewerDisplayName: activeSubmissionRow.reviewerProfile?.display_name ?? null,
        reviewNote: activeSubmissionRow.review_note,
        submittedAt: activeSubmissionRow.submitted_at,
        reviewedAt: activeSubmissionRow.reviewed_at,
        appliedAt: activeSubmissionRow.applied_at,
        updatedAt: activeSubmissionRow.updated_at,
        diff: activeSubmissionDiff,
        changedFieldCount: activeSubmissionDiff.length,
      }
    : null;

  return {
    ok: true,
    listing: listingRow as WorkflowListingRow,
    viewerRole,
    capabilities,
    timeline: (timelineRows ?? []) as CompanyListingWorkflowTimelineEvent[],
    activeEditSubmission,
  };
}
