import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCompanyAdminClient } from "@/lib/company/server-authorization";
import type { Database, Tables } from "@/types/database";
import { canReviewCompanyListingWorkflow } from "@/lib/company/permissions";

import type {
  CompanyListingWorkflowCapabilities,
  CompanyListingWorkflowListingSummary,
  CompanyListingWorkflowStatus,
  CompanyListingWorkflowTimelineEvent,
} from "./types";

type WorkflowListingRow = CompanyListingWorkflowListingSummary & {
  owner_id: string;
};

type WorkflowMembershipRole = Tables<"organization_members">["role"] | "admin";

const WORKFLOW_TIMELINE_SELECT =
  "id, listing_id, organization_id, actor_user_id, event_type, from_status, to_status, note, created_at, actorProfile:profiles!listing_workflow_events_actor_user_id_fkey(id, display_name, avatar_url)";

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
    .select(
      "id, owner_id, organization_id, created_by_user_id, assigned_agent_user_id, published_by_user_id, listing_status, title, slug, updated_at"
    )
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

  return {
    ok: true,
    listing: listingRow as WorkflowListingRow,
    viewerRole,
    capabilities,
    timeline: (timelineRows ?? []) as CompanyListingWorkflowTimelineEvent[],
  };
}
