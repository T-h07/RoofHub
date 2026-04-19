import type {
  OrganizationMemberRole,
  OrganizationMemberStatus,
} from "../company/team-types";
import {
  canManageCompanyConversationRouting as canManageRoutingPermission,
  canReviewCompanyListingWorkflow,
  isActiveCompanyMemberStatus,
} from "../company/permissions";

export type MessagingCompanyQueueAccess = "company_queue" | "assigned_only";

export function canManageCompanyConversationRouting(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
) {
  return canManageRoutingPermission(role, status);
}

export function getCompanyConversationQueueAccess(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
): MessagingCompanyQueueAccess | null {
  if (!isActiveCompanyMemberStatus(status)) {
    return null;
  }

  return canReviewCompanyListingWorkflow(role, status)
    ? "company_queue"
    : "assigned_only";
}

export function canAccessCompanyConversation(input: {
  viewerUserId: string;
  activeOrganizationId: string | null;
  membershipRole: OrganizationMemberRole;
  membershipStatus: OrganizationMemberStatus;
  conversationOrganizationId: string | null;
  assignedMemberUserId: string | null;
}) {
  if (
    !isActiveCompanyMemberStatus(input.membershipStatus) ||
    !input.activeOrganizationId ||
    !input.conversationOrganizationId ||
    input.activeOrganizationId !== input.conversationOrganizationId
  ) {
    return false;
  }

  if (
    canReviewCompanyListingWorkflow(
      input.membershipRole,
      input.membershipStatus
    )
  ) {
    return true;
  }

  return input.assignedMemberUserId === input.viewerUserId;
}
