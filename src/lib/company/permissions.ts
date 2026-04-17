import type {
  OrganizationMemberRole,
  OrganizationMemberStatus,
} from "@/lib/company/team-types";

const OWNER_ROLE_OPTIONS: ReadonlyArray<OrganizationMemberRole> = [
  "owner",
  "admin",
  "manager",
  "agent",
];

const REVIEWER_ROLES: ReadonlySet<OrganizationMemberRole> = new Set([
  "owner",
  "admin",
  "manager",
]);

const TEAM_MANAGER_ROLES: ReadonlySet<OrganizationMemberRole> = new Set([
  "owner",
  "admin",
]);

const ADMIN_ASSIGNABLE_ROLES: ReadonlySet<OrganizationMemberRole> = new Set([
  "manager",
  "agent",
]);

const OWNER_ASSIGNABLE_ROLES: ReadonlySet<OrganizationMemberRole> = new Set([
  "admin",
  "manager",
  "agent",
]);

const ADMIN_MUTABLE_MEMBER_ROLES: ReadonlyArray<OrganizationMemberRole> = [
  "manager",
  "agent",
];

export function isActiveCompanyMemberStatus(status: OrganizationMemberStatus) {
  return status === "active";
}

export function isCompanyReviewerRole(role: OrganizationMemberRole) {
  return REVIEWER_ROLES.has(role);
}

export function isCompanyTeamManagerRole(role: OrganizationMemberRole) {
  return TEAM_MANAGER_ROLES.has(role);
}

export function canManageCompanyTeam(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
) {
  return isActiveCompanyMemberStatus(status) && isCompanyTeamManagerRole(role);
}

export function canEditCompanyProfile(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
) {
  return isActiveCompanyMemberStatus(status) && role === "owner";
}

export function canReviewCompanyListingWorkflow(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
) {
  return isActiveCompanyMemberStatus(status) && isCompanyReviewerRole(role);
}

export function canViewCompanyActivityFeed(
  role: OrganizationMemberRole,
  status: OrganizationMemberStatus
) {
  return canReviewCompanyListingWorkflow(role, status);
}

export function canInviteOrganizationRole(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus,
  targetRole: OrganizationMemberRole
) {
  if (!isActiveCompanyMemberStatus(actorStatus)) {
    return false;
  }

  if (actorRole === "owner") {
    return OWNER_ASSIGNABLE_ROLES.has(targetRole);
  }

  if (actorRole === "admin") {
    return ADMIN_ASSIGNABLE_ROLES.has(targetRole);
  }

  return false;
}

export function getInvitableOrganizationRoles(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus
): OrganizationMemberRole[] {
  if (!isActiveCompanyMemberStatus(actorStatus)) {
    return [];
  }

  if (actorRole === "owner") {
    return [...OWNER_ASSIGNABLE_ROLES];
  }

  if (actorRole === "admin") {
    return [...ADMIN_ASSIGNABLE_ROLES];
  }

  return [];
}

export function canMutateOrganizationMemberRole(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus,
  targetCurrentRole: OrganizationMemberRole,
  targetNextRole: OrganizationMemberRole
) {
  if (!isActiveCompanyMemberStatus(actorStatus)) {
    return false;
  }

  if (actorRole === "owner") {
    return true;
  }

  if (actorRole === "admin") {
    if (
      targetCurrentRole === "owner" ||
      targetCurrentRole === "admin" ||
      targetNextRole === "owner" ||
      targetNextRole === "admin"
    ) {
      return false;
    }

    return true;
  }

  return false;
}

export function getAssignableOrganizationRolesForMemberMutation(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus,
  targetCurrentRole: OrganizationMemberRole
): OrganizationMemberRole[] {
  if (!isActiveCompanyMemberStatus(actorStatus)) {
    return [];
  }

  if (actorRole === "owner") {
    return [...OWNER_ROLE_OPTIONS];
  }

  if (actorRole === "admin") {
    if (targetCurrentRole === "owner" || targetCurrentRole === "admin") {
      return [];
    }

    return [...ADMIN_MUTABLE_MEMBER_ROLES];
  }

  return [];
}

export function canMutateOrganizationMemberStatus(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus,
  targetRole: OrganizationMemberRole
) {
  if (!isActiveCompanyMemberStatus(actorStatus)) {
    return false;
  }

  if (actorRole === "owner") {
    return true;
  }

  if (actorRole === "admin") {
    return targetRole !== "owner" && targetRole !== "admin";
  }

  return false;
}

export function canRemoveOrganizationMember(
  actorRole: OrganizationMemberRole,
  actorStatus: OrganizationMemberStatus,
  targetRole: OrganizationMemberRole
) {
  return canMutateOrganizationMemberStatus(actorRole, actorStatus, targetRole);
}
