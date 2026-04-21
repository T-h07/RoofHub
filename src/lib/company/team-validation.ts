import type {
  CompanyTeamInviteFormErrors,
  CompanyTeamInviteInput,
  CompanyTeamInviteMethod,
  OrganizationMemberRole,
} from "@/lib/company/team-types";
import {
  ORGANIZATION_INVITABLE_ROLE_VALUES,
  ORGANIZATION_MEMBER_ROLE_VALUES,
} from "@/lib/company/team-types";

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const INVITE_EMAIL_MAX = 254;

function normalizeTrimmed(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: string) {
  return value.length > 0 ? value : null;
}

export function isUuid(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function normalizeInviteMethod(value: string): CompanyTeamInviteMethod {
  return value === "userId" ? "userId" : "email";
}

function normalizeRole(value: string): OrganizationMemberRole {
  if ((ORGANIZATION_MEMBER_ROLE_VALUES as string[]).includes(value)) {
    return value as OrganizationMemberRole;
  }

  return "agent";
}

export function readCompanyTeamInviteInput(formData: FormData): CompanyTeamInviteInput {
  const organizationId = toNullable(normalizeTrimmed(formData.get("organizationId")));
  const inviteMethod = normalizeInviteMethod(normalizeTrimmed(formData.get("inviteMethod")));
  const inviteEmail = toNullable(normalizeTrimmed(formData.get("inviteEmail")))?.toLowerCase() ?? null;
  const targetUserId = toNullable(normalizeTrimmed(formData.get("targetUserId")));
  const role = normalizeRole(normalizeTrimmed(formData.get("role")));

  return {
    organizationId,
    inviteMethod,
    inviteEmail,
    targetUserId,
    role,
  };
}

export function validateCompanyTeamInviteInput(input: CompanyTeamInviteInput) {
  const errors: CompanyTeamInviteFormErrors = {};

  if (!isUuid(input.organizationId)) {
    errors.organizationId = "Company workspace reference is invalid.";
  }

  if (!ORGANIZATION_INVITABLE_ROLE_VALUES.includes(input.role)) {
    errors.role = "Choose admin, manager, or agent for this invite.";
  }

  if (input.inviteMethod === "email") {
    if (!input.inviteEmail) {
      errors.inviteEmail = "Enter the staff member email address.";
    } else if (input.inviteEmail.length > INVITE_EMAIL_MAX || !EMAIL_PATTERN.test(input.inviteEmail)) {
      errors.inviteEmail = "Enter a valid email address.";
    }
  }

  if (input.inviteMethod === "userId") {
    if (!input.targetUserId) {
      errors.targetUserId = "Enter the RoofHub user ID.";
    } else if (!isUuid(input.targetUserId)) {
      errors.targetUserId = "RoofHub user ID must be a valid UUID.";
    }
  }

  return errors;
}

export function readMembershipRoleChangeInput(formData: FormData) {
  return {
    organizationId: toNullable(normalizeTrimmed(formData.get("organizationId"))),
    membershipId: toNullable(normalizeTrimmed(formData.get("membershipId"))),
    newRole: normalizeRole(normalizeTrimmed(formData.get("newRole"))),
  };
}

export function validateMembershipRoleChangeInput(input: {
  organizationId: string | null;
  membershipId: string | null;
  newRole: OrganizationMemberRole;
}) {
  if (!isUuid(input.organizationId)) {
    return "Company workspace reference is invalid.";
  }

  if (!input.membershipId || !isUuid(input.membershipId)) {
    return "Member reference is invalid.";
  }

  if (!ORGANIZATION_MEMBER_ROLE_VALUES.includes(input.newRole)) {
    return "Member role is invalid.";
  }

  return null;
}

export function readMembershipStatusInput(formData: FormData) {
  const nextStatusRaw = normalizeTrimmed(formData.get("nextStatus"));

  return {
    organizationId: toNullable(normalizeTrimmed(formData.get("organizationId"))),
    membershipId: toNullable(normalizeTrimmed(formData.get("membershipId"))),
    nextStatus: nextStatusRaw === "inactive" ? "inactive" : "active",
  } as const;
}

export function validateMembershipStatusInput(input: {
  organizationId: string | null;
  membershipId: string | null;
  nextStatus: "active" | "inactive";
}) {
  if (!isUuid(input.organizationId)) {
    return "Company workspace reference is invalid.";
  }

  if (!input.membershipId || !isUuid(input.membershipId)) {
    return "Member reference is invalid.";
  }

  if (input.nextStatus !== "active" && input.nextStatus !== "inactive") {
    return "Member status is invalid.";
  }

  return null;
}

export function readMemberRemovalInput(formData: FormData) {
  return {
    organizationId: toNullable(normalizeTrimmed(formData.get("organizationId"))),
    membershipId: toNullable(normalizeTrimmed(formData.get("membershipId"))),
  };
}

export function validateMemberRemovalInput(input: {
  organizationId: string | null;
  membershipId: string | null;
}) {
  if (!isUuid(input.organizationId)) {
    return "Company workspace reference is invalid.";
  }

  if (!input.membershipId || !isUuid(input.membershipId)) {
    return "Member reference is invalid.";
  }

  return null;
}

export function readInviteRevocationInput(formData: FormData) {
  return {
    organizationId: toNullable(normalizeTrimmed(formData.get("organizationId"))),
    inviteId: toNullable(normalizeTrimmed(formData.get("inviteId"))),
  };
}

export function validateInviteRevocationInput(input: {
  organizationId: string | null;
  inviteId: string | null;
}) {
  if (!isUuid(input.organizationId)) {
    return "Company workspace reference is invalid.";
  }

  if (!input.inviteId || !isUuid(input.inviteId)) {
    return "Invite reference is invalid.";
  }

  return null;
}

export function readInviteAcceptanceInput(formData: FormData) {
  return {
    inviteToken: toNullable(normalizeTrimmed(formData.get("inviteToken"))),
  };
}

export function validateInviteAcceptanceInput(input: { inviteToken: string | null }) {
  if (!input.inviteToken || !isUuid(input.inviteToken)) {
    return "Invite token is invalid.";
  }

  return null;
}
