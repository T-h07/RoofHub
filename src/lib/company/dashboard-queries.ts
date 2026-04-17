import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Json, Tables } from "@/types/database";
import type { Database } from "@/types/database";

import { getCurrentUserCompanyContext, type CompanyMembershipSummary, type CompanyWorkspaceSummary } from "./context";
import type { OrganizationMemberRole } from "./team-types";

type CompanyDashboardOverviewRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_overview"]["Returns"][number];
type CompanyDashboardPendingQueueRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_pending_queue"]["Returns"][number];
type CompanyDashboardActivityRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_activity_feed"]["Returns"][number];

export type CompanyDashboardOverviewMetrics = {
  draftCount: number;
  pendingReviewCount: number;
  needsChangesCount: number;
  publishedCount: number;
  activeMemberCount: number;
  pendingInviteCount: number;
};

export type CompanyDashboardPendingQueueItem = {
  listingId: string;
  title: string;
  listingStatus: Tables<"listings">["listing_status"];
  listingType: Tables<"listings">["listing_type"];
  propertyType: Tables<"listings">["property_type"];
  city: string;
  neighborhood: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  createdByUserId: string;
  createdByDisplayName: string | null;
  assignedAgentUserId: string | null;
  assignedAgentDisplayName: string | null;
};

export type CompanyDashboardActivityItem = {
  id: string;
  source: "listing_workflow" | "organization_invite";
  eventType: string;
  occurredAt: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  targetId: string;
  targetLabel: string;
  note: string | null;
  fromStatus: Tables<"listings">["listing_status"] | null;
  toStatus: Tables<"listings">["listing_status"] | null;
  inviteRole: OrganizationMemberRole | null;
  inviteStatus: Database["public"]["Enums"]["organization_invite_status"] | null;
};

export type CompanyDashboardWorkspaceData = {
  profile: Tables<"profiles">;
  organization: CompanyWorkspaceSummary;
  membership: CompanyMembershipSummary;
  overview: CompanyDashboardOverviewMetrics;
  pendingReviewQueue: CompanyDashboardPendingQueueItem[];
  pendingQueueUnavailableMessage: string | null;
  activity: CompanyDashboardActivityItem[];
  activityUnavailableMessage: string | null;
  isReviewer: boolean;
  isOwnerOrAdmin: boolean;
};

export type LoadCompanyDashboardWorkspaceResult =
  | {
      ok: true;
      workspace: CompanyDashboardWorkspaceData;
    }
  | {
      ok: false;
      reason: "context_unavailable" | "company_membership_required" | "overview_unavailable";
      message: string;
    };

const REVIEWER_ROLE_SET = new Set<OrganizationMemberRole>(["owner", "admin", "manager"]);
const OWNER_OR_ADMIN_ROLE_SET = new Set<OrganizationMemberRole>(["owner", "admin"]);

function isReviewerRole(role: OrganizationMemberRole) {
  return REVIEWER_ROLE_SET.has(role);
}

function isOwnerOrAdminRole(role: OrganizationMemberRole) {
  return OWNER_OR_ADMIN_ROLE_SET.has(role);
}

function toMetadataRecord(metadata: Json): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toOptionalListingStatus(value: unknown): Tables<"listings">["listing_status"] | null {
  return typeof value === "string" ? (value as Tables<"listings">["listing_status"]) : null;
}

function toOptionalInviteRole(value: unknown): OrganizationMemberRole | null {
  return typeof value === "string" ? (value as OrganizationMemberRole) : null;
}

function toOptionalInviteStatus(
  value: unknown
): Database["public"]["Enums"]["organization_invite_status"] | null {
  return typeof value === "string"
    ? (value as Database["public"]["Enums"]["organization_invite_status"])
    : null;
}

function mapOverviewRow(row: CompanyDashboardOverviewRpcRow): CompanyDashboardOverviewMetrics {
  return {
    draftCount: row.draft_count,
    pendingReviewCount: row.pending_review_count,
    needsChangesCount: row.needs_changes_count,
    publishedCount: row.published_count,
    activeMemberCount: row.active_member_count,
    pendingInviteCount: row.pending_invite_count,
  };
}

function mapPendingQueueRows(rows: CompanyDashboardPendingQueueRpcRow[]): CompanyDashboardPendingQueueItem[] {
  return rows.map((row) => ({
    listingId: row.listing_id,
    title: row.title,
    listingStatus: row.listing_status,
    listingType: row.listing_type,
    propertyType: row.property_type,
    city: row.city,
    neighborhood: row.neighborhood,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    submittedAt: row.submitted_at,
    createdByUserId: row.created_by_user_id,
    createdByDisplayName: row.created_by_display_name,
    assignedAgentUserId: row.assigned_agent_user_id,
    assignedAgentDisplayName: row.assigned_agent_display_name,
  }));
}

function mapActivityRows(rows: CompanyDashboardActivityRpcRow[]): CompanyDashboardActivityItem[] {
  return rows.map((row) => {
    const metadata = toMetadataRecord(row.metadata);

    return {
      id: row.event_id,
      source: row.event_source === "organization_invite" ? "organization_invite" : "listing_workflow",
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name,
      targetId: row.target_id,
      targetLabel: row.target_label,
      note: toOptionalString(metadata.note),
      fromStatus: toOptionalListingStatus(metadata.from_status),
      toStatus: toOptionalListingStatus(metadata.to_status),
      inviteRole: toOptionalInviteRole(metadata.role),
      inviteStatus: toOptionalInviteStatus(metadata.status),
    };
  });
}

export async function loadCompanyDashboardWorkspace(
  supabase: SupabaseClient<Database>
): Promise<LoadCompanyDashboardWorkspaceResult> {
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false,
      reason: "context_unavailable",
      message: companyContextResult.message,
    };
  }

  const membership = companyContextResult.company.primaryMembership;
  const organization = companyContextResult.company.primaryOrganization;
  if (!membership || !organization) {
    return {
      ok: false,
      reason: "company_membership_required",
      message: "An active company membership is required to open the company dashboard.",
    };
  }

  const reviewer = isReviewerRole(membership.role);
  const ownerOrAdmin = isOwnerOrAdminRole(membership.role);

  const [overviewRpcResult, pendingQueueRpcResult, activityRpcResult] = await Promise.all([
    supabase.rpc("get_company_dashboard_overview", {
      p_organization_id: organization.id,
      p_viewer_user_id: companyContextResult.profile.id,
    }),
    reviewer
      ? supabase.rpc("get_company_dashboard_pending_queue", {
          p_organization_id: organization.id,
          p_viewer_user_id: companyContextResult.profile.id,
          p_limit: 10,
        })
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("get_company_dashboard_activity_feed", {
      p_organization_id: organization.id,
      p_viewer_user_id: companyContextResult.profile.id,
      p_limit: 22,
    }),
  ]);

  if (overviewRpcResult.error || !overviewRpcResult.data?.[0]) {
    return {
      ok: false,
      reason: "overview_unavailable",
      message: "Company dashboard metrics are temporarily unavailable.",
    };
  }

  const overview = mapOverviewRow(overviewRpcResult.data[0]);
  const pendingReviewQueue = pendingQueueRpcResult.error
    ? []
    : mapPendingQueueRows(
        (pendingQueueRpcResult.data ?? []) as CompanyDashboardPendingQueueRpcRow[]
      );
  const activity = activityRpcResult.error
    ? []
    : mapActivityRows((activityRpcResult.data ?? []) as CompanyDashboardActivityRpcRow[]);

  return {
    ok: true,
    workspace: {
      profile: companyContextResult.profile,
      organization,
      membership,
      overview,
      pendingReviewQueue,
      pendingQueueUnavailableMessage: pendingQueueRpcResult.error
        ? "Pending queue is temporarily unavailable."
        : null,
      activity,
      activityUnavailableMessage: activityRpcResult.error
        ? "Activity feed is temporarily unavailable."
        : null,
      isReviewer: reviewer,
      isOwnerOrAdmin: ownerOrAdmin,
    },
  };
}
