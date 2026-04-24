import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Tables } from "@/types/database";
import type { Database } from "@/types/database";
import {
  canManageCompanyConversationRouting,
  canManageCompanyTeam,
  canReviewCompanyListingWorkflow,
  canViewCompanyActivityFeed,
  canViewCompanyInboxQueue,
  canViewCompanyPendingQueue,
} from "@/lib/company/permissions";
import {
  getCompanyAdminClient,
  requireCurrentUserScopedCompanyAccess,
} from "@/lib/company/server-authorization";

import {
  mapCompanyActivityRows,
  type CompanyActivityItem,
  type CompanyActivityRpcRow,
} from "./activity-feed";
import type { CompanyMembershipSummary, CompanyWorkspaceSummary } from "./context";

type CompanyDashboardOverviewRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_overview"]["Returns"][number];
type CompanyDashboardPendingQueueRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_pending_queue"]["Returns"][number];
type CompanyDashboardConversationRow = Pick<
  Tables<"conversations">,
  "id" | "assigned_member_user_id" | "routing_status"
>;
type CompanyDashboardUnreadMessageRow = Pick<Tables<"messages">, "conversation_id">;

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

export type CompanyDashboardMessagingMetrics = {
  totalConversations: number;
  sharedQueueConversations: number;
  assignedToViewerConversations: number;
  assignedToOtherConversations: number;
  unreadMessages: number;
  unreadAssignedToViewerMessages: number;
  unreadSharedQueueMessages: number;
};

export type CompanyDashboardWorkspaceData = {
  profile: Tables<"profiles">;
  organization: CompanyWorkspaceSummary;
  membership: CompanyMembershipSummary;
  overview: CompanyDashboardOverviewMetrics;
  messaging: CompanyDashboardMessagingMetrics;
  messagingUnavailableMessage: string | null;
  pendingReviewQueue: CompanyDashboardPendingQueueItem[];
  pendingQueueUnavailableMessage: string | null;
  activity: CompanyDashboardActivityItem[];
  canViewActivityFeed: boolean;
  canViewInboxQueue: boolean;
  canManageRouting: boolean;
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

function createEmptyMessagingMetrics(): CompanyDashboardMessagingMetrics {
  return {
    totalConversations: 0,
    sharedQueueConversations: 0,
    assignedToViewerConversations: 0,
    assignedToOtherConversations: 0,
    unreadMessages: 0,
    unreadAssignedToViewerMessages: 0,
    unreadSharedQueueMessages: 0,
  };
}

async function loadCompanyDashboardMessagingMetrics(input: {
  adminSupabase: ReturnType<typeof getCompanyAdminClient>;
  organizationId: string;
  viewerUserId: string;
  canViewInboxQueue: boolean;
}) {
  const { adminSupabase, organizationId, viewerUserId, canViewInboxQueue } = input;
  const emptyMetrics = createEmptyMessagingMetrics();

  let conversationQuery = adminSupabase
    .from("conversations")
    .select("id, assigned_member_user_id, routing_status")
    .eq("owner_mode", "company_workspace")
    .eq("organization_id", organizationId);

  if (!canViewInboxQueue) {
    conversationQuery = conversationQuery.eq("assigned_member_user_id", viewerUserId);
  }

  const { data: conversationRows, error: conversationError } = await conversationQuery;

  if (conversationError || !conversationRows) {
    return {
      metrics: emptyMetrics,
      unavailableMessage: canViewInboxQueue
        ? "Inbox workload metrics are temporarily unavailable."
        : "Assigned inbox metrics are temporarily unavailable.",
    };
  }

  const conversations = conversationRows as CompanyDashboardConversationRow[];
  if (conversations.length === 0) {
    return { metrics: emptyMetrics, unavailableMessage: null };
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const { data: unreadRows, error: unreadError } = await adminSupabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", viewerUserId)
    .is("read_at", null);

  const unreadByConversation = new Map<string, number>();
  if (!unreadError && unreadRows) {
    for (const row of unreadRows as CompanyDashboardUnreadMessageRow[]) {
      unreadByConversation.set(
        row.conversation_id,
        (unreadByConversation.get(row.conversation_id) ?? 0) + 1
      );
    }
  }

  const metrics = createEmptyMessagingMetrics();
  for (const conversation of conversations) {
    const unreadCount = unreadByConversation.get(conversation.id) ?? 0;
    metrics.totalConversations += 1;
    metrics.unreadMessages += unreadCount;

    if (conversation.routing_status === "shared_queue") {
      metrics.sharedQueueConversations += 1;
      metrics.unreadSharedQueueMessages += unreadCount;
    }

    if (conversation.assigned_member_user_id === viewerUserId) {
      metrics.assignedToViewerConversations += 1;
      metrics.unreadAssignedToViewerMessages += unreadCount;
    } else if (conversation.assigned_member_user_id) {
      metrics.assignedToOtherConversations += 1;
    }
  }

  return {
    metrics,
    unavailableMessage: unreadError
      ? canViewInboxQueue
        ? "Unread message metrics are temporarily unavailable."
        : "Unread assigned message metrics are temporarily unavailable."
      : null,
  };
}

type LoadCompanyDashboardWorkspaceOptions = {
  pendingQueueLimit?: number;
  activityLimit?: number;
};

export async function loadCompanyDashboardWorkspace(
  supabase: SupabaseClient<Database>,
  options?: LoadCompanyDashboardWorkspaceOptions
): Promise<LoadCompanyDashboardWorkspaceResult> {
  const scopedAccess = await requireCurrentUserScopedCompanyAccess(supabase, {
    permission: "dashboard",
    selectionRequiredMessage:
      "Select an active company workspace before opening the company dashboard.",
    membershipRequiredMessage:
      "An active company membership is required to open the company dashboard.",
    forbiddenMessage: "You do not have permission to open this company dashboard.",
  });

  if (!scopedAccess.ok) {
    return {
      ok: false,
      reason: "company_membership_required",
      message: scopedAccess.message,
    };
  }

  const { profile, membership, organization } = scopedAccess;
  const reviewer = canReviewCompanyListingWorkflow(
    membership.role,
    membership.member_status
  );
  const ownerOrAdmin = canManageCompanyTeam(
    membership.role,
    membership.member_status
  );
  const pendingQueueLimit = Math.max(0, Math.min(40, Math.trunc(options?.pendingQueueLimit ?? 10)));
  const activityLimit = Math.max(1, Math.min(120, Math.trunc(options?.activityLimit ?? 22)));
  const canViewActivityFeed = canViewCompanyActivityFeed(
    membership.role,
    membership.member_status
  );
  const canViewPendingQueue = canViewCompanyPendingQueue(
    membership.role,
    membership.member_status
  );
  const canViewInboxQueue = canViewCompanyInboxQueue(
    membership.role,
    membership.member_status
  );
  const canManageRouting = canManageCompanyConversationRouting(
    membership.role,
    membership.member_status
  );
  const adminSupabase = getCompanyAdminClient();

  const [overviewRpcResult, pendingQueueRpcResult, activityRpcResult, messagingMetricsResult] = await Promise.all([
    adminSupabase.rpc("get_company_dashboard_overview", {
      p_organization_id: organization.id,
      p_viewer_user_id: profile.id,
    }),
    canViewPendingQueue && pendingQueueLimit > 0
      ? adminSupabase.rpc("get_company_dashboard_pending_queue", {
          p_organization_id: organization.id,
          p_viewer_user_id: profile.id,
          p_limit: pendingQueueLimit,
        })
      : Promise.resolve({ data: [], error: null }),
    canViewActivityFeed
      ? adminSupabase.rpc("get_company_dashboard_activity_feed", {
          p_organization_id: organization.id,
          p_viewer_user_id: profile.id,
          p_limit: activityLimit,
        })
      : Promise.resolve({ data: [], error: null }),
    loadCompanyDashboardMessagingMetrics({
      adminSupabase,
      organizationId: organization.id,
      viewerUserId: profile.id,
      canViewInboxQueue,
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
  const activity = !canViewActivityFeed || activityRpcResult.error
    ? []
    : mapCompanyActivityRows((activityRpcResult.data ?? []) as CompanyActivityRpcRow[]);

  return {
    ok: true,
    workspace: {
      profile,
      organization,
      membership,
      overview,
      messaging: messagingMetricsResult.metrics,
      messagingUnavailableMessage: messagingMetricsResult.unavailableMessage,
      pendingReviewQueue,
      pendingQueueUnavailableMessage: canViewPendingQueue && pendingQueueRpcResult.error
        ? "Pending queue is temporarily unavailable."
        : null,
      activity,
      canViewActivityFeed,
      canViewInboxQueue,
      canManageRouting,
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
