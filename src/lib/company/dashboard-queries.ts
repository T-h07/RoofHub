import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Tables } from "@/types/database";
import type { Database } from "@/types/database";

import {
  mapCompanyActivityRows,
  type CompanyActivityItem,
  type CompanyActivityRpcRow,
} from "./activity-feed";
import { getCurrentUserCompanyContext, type CompanyMembershipSummary, type CompanyWorkspaceSummary } from "./context";
import type { OrganizationMemberRole } from "./team-types";

type CompanyDashboardOverviewRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_overview"]["Returns"][number];
type CompanyDashboardPendingQueueRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_pending_queue"]["Returns"][number];

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

export type CompanyDashboardActivityItem = CompanyActivityItem;

export type CompanyDashboardWorkspaceData = {
  profile: Tables<"profiles">;
  organization: CompanyWorkspaceSummary;
  membership: CompanyMembershipSummary;
  overview: CompanyDashboardOverviewMetrics;
  pendingReviewQueue: CompanyDashboardPendingQueueItem[];
  pendingQueueUnavailableMessage: string | null;
  activity: CompanyDashboardActivityItem[];
  canViewActivityFeed: boolean;
  activityAccessMessage: string | null;
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

type LoadCompanyDashboardWorkspaceOptions = {
  pendingQueueLimit?: number;
  activityLimit?: number;
};

export async function loadCompanyDashboardWorkspace(
  supabase: SupabaseClient<Database>,
  options?: LoadCompanyDashboardWorkspaceOptions
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
  const pendingQueueLimit = Math.max(0, Math.min(40, Math.trunc(options?.pendingQueueLimit ?? 10)));
  const activityLimit = Math.max(1, Math.min(120, Math.trunc(options?.activityLimit ?? 22)));
  const canViewActivityFeed = reviewer;

  const [overviewRpcResult, pendingQueueRpcResult, activityRpcResult] = await Promise.all([
    supabase.rpc("get_company_dashboard_overview", {
      p_organization_id: organization.id,
      p_viewer_user_id: companyContextResult.profile.id,
    }),
    reviewer && pendingQueueLimit > 0
      ? supabase.rpc("get_company_dashboard_pending_queue", {
          p_organization_id: organization.id,
          p_viewer_user_id: companyContextResult.profile.id,
          p_limit: pendingQueueLimit,
        })
      : Promise.resolve({ data: [], error: null }),
    canViewActivityFeed
      ? supabase.rpc("get_company_dashboard_activity_feed", {
          p_organization_id: organization.id,
          p_viewer_user_id: companyContextResult.profile.id,
          p_limit: activityLimit,
        })
      : Promise.resolve({ data: [], error: null }),
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
  const activity = !canViewActivityFeed || activityRpcResult.error
    ? []
    : mapCompanyActivityRows((activityRpcResult.data ?? []) as CompanyActivityRpcRow[]);

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
      canViewActivityFeed,
      activityAccessMessage: canViewActivityFeed
        ? null
        : "Owner, admin, or manager role is required for company activity log visibility.",
      activityUnavailableMessage: activityRpcResult.error
        ? "Activity feed is temporarily unavailable."
        : null,
      isReviewer: reviewer,
      isOwnerOrAdmin: ownerOrAdmin,
    },
  };
}
