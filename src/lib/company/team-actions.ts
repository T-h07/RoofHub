"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import type { CompanyWorkspaceSummary } from "@/lib/company/context";
import {
  COMPANY_TEAM_INVITE_IDLE_STATE,
  COMPANY_TEAM_MUTATION_IDLE_STATE,
  type CompanyTeamInviteActionState,
  type CompanyTeamMutationActionState,
} from "@/lib/company/team-types";
import {
  readCompanyTeamInviteInput,
  readInviteAcceptanceInput,
  readInviteRevocationInput,
  readMemberRemovalInput,
  readMembershipRoleChangeInput,
  readMembershipStatusInput,
  validateCompanyTeamInviteInput,
  validateInviteAcceptanceInput,
  validateInviteRevocationInput,
  validateMemberRemovalInput,
  validateMembershipRoleChangeInput,
  validateMembershipStatusInput,
} from "@/lib/company/team-validation";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database";

type CreateInviteRpcRow =
  Database["public"]["Functions"]["create_organization_member_invite"]["Returns"][number];
type AcceptInviteRpcRow =
  Database["public"]["Functions"]["accept_organization_member_invite"]["Returns"][number];
type RevokeInviteRpcRow =
  Database["public"]["Functions"]["revoke_organization_member_invite"]["Returns"][number];
type UpdateRoleRpcRow =
  Database["public"]["Functions"]["update_organization_member_role"]["Returns"][number];
type UpdateStatusRpcRow =
  Database["public"]["Functions"]["update_organization_member_status"]["Returns"][number];
type RemoveMemberRpcRow =
  Database["public"]["Functions"]["remove_organization_member"]["Returns"][number];

type TeamManagerContextResult =
  | {
      ok: true;
      profile: Tables<"profiles">;
      organization: CompanyWorkspaceSummary;
      membershipRole: "owner" | "admin";
    }
  | {
      ok: false;
      message: string;
    };

function toInviteValidationErrorState(
  errors: CompanyTeamInviteActionState["errors"]
): CompanyTeamInviteActionState {
  return {
    status: "error",
    message: "Review the invite fields and try again.",
    errors,
  };
}

function toGenericErrorState(message: string): CompanyTeamMutationActionState {
  return {
    status: "error",
    message,
  };
}

function mapInviteCreateError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already an active company member")) {
    return "This user is already an active member of the company workspace.";
  }

  if (normalized.includes("active invite already exists")) {
    return "An active invite already exists for this user.";
  }

  if (normalized.includes("cannot invite owner or admin roles")) {
    return "Admin members can only invite manager or agent roles.";
  }

  if (
    normalized.includes("only owner") ||
    normalized.includes("permission") ||
    normalized.includes("authentication")
  ) {
    return "You do not have permission to invite team members from this workspace.";
  }

  if (normalized.includes("email is invalid")) {
    return "Enter a valid email address before sending the invite.";
  }

  if (normalized.includes("roofhub user id is invalid")) {
    return "RoofHub user ID was not found.";
  }

  return "Invite could not be created right now. Please retry.";
}

function mapInviteAcceptError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("does not match") || normalized.includes("different roofhub user")) {
    return "This invite belongs to a different RoofHub account.";
  }

  if (normalized.includes("expired")) {
    return "This invite has expired. Ask a company owner or admin for a new invite.";
  }

  if (normalized.includes("revoked")) {
    return "This invite has been revoked by the company workspace.";
  }

  if (normalized.includes("already been accepted")) {
    return "This invite has already been accepted.";
  }

  if (normalized.includes("invalid") || normalized.includes("unavailable")) {
    return "Invite link is invalid or unavailable.";
  }

  return "Invite could not be accepted right now. Please retry.";
}

function mapInviteRevokeError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("only pending invites")) {
    return "Only pending invites can be revoked.";
  }

  if (normalized.includes("cannot revoke owner or admin invites")) {
    return "Admin members cannot revoke owner or admin invites.";
  }

  if (normalized.includes("owner or admin") || normalized.includes("permission")) {
    return "You do not have permission to revoke this invite.";
  }

  return "Invite could not be revoked right now. Please retry.";
}

function mapMemberRoleError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("at least one active owner")) {
    return "Role update blocked because at least one active owner must remain.";
  }

  if (normalized.includes("cannot assign owner or admin roles")) {
    return "Admin members can only assign manager or agent roles.";
  }

  if (normalized.includes("cannot modify owner or admin roles")) {
    return "Admin members cannot change owner or admin roles.";
  }

  if (normalized.includes("permission") || normalized.includes("owner or admin")) {
    return "You do not have permission to change this member role.";
  }

  return "Role update failed. Please retry.";
}

function mapMemberStatusError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("at least one active owner")) {
    return "Status update blocked because at least one active owner must remain.";
  }

  if (normalized.includes("cannot suspend owner or admin members")) {
    return "Admin members cannot suspend owner or admin members.";
  }

  if (normalized.includes("permission") || normalized.includes("owner or admin")) {
    return "You do not have permission to update this member status.";
  }

  return "Member status update failed. Please retry.";
}

function mapMemberRemoveError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("at least one active owner")) {
    return "Removal blocked because at least one active owner must remain.";
  }

  if (normalized.includes("cannot remove owner or admin members")) {
    return "Admin members cannot remove owner or admin members.";
  }

  if (normalized.includes("permission") || normalized.includes("owner or admin")) {
    return "You do not have permission to remove this member.";
  }

  return "Member removal failed. Please retry.";
}

function revalidateCompanyTeamPaths(input: { organizationSlug: string }) {
  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/team");
  revalidatePath(`/companies/${input.organizationSlug}`);
  revalidatePath("/companies/[slug]", "page");
}

async function loadTeamManagerContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
): Promise<TeamManagerContextResult> {
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false,
      message: companyContextResult.message,
    };
  }

  const managementMembership = companyContextResult.company.managementMembership;
  if (!managementMembership?.organization) {
    return {
      ok: false,
      message: "Only owner or admin members can manage team access.",
    };
  }

  if (managementMembership.role !== "owner" && managementMembership.role !== "admin") {
    return {
      ok: false,
      message: "Only owner or admin members can manage team access.",
    };
  }

  return {
    ok: true,
    profile: companyContextResult.profile,
    organization: managementMembership.organization,
    membershipRole: managementMembership.role,
  };
}

async function enforceInviteCreateTrafficControl(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
}) {
  return enforceTrafficControl({
    supabase: input.supabase,
    rule: TRAFFIC_CONTROL_RULES.companyInviteCreatePerUser,
    identity: {
      userId: input.userId,
      includeIp: false,
    },
    throttledMessage: "Too many team invite attempts for this account. Please wait before retrying.",
    unavailableMessage: "Team invite creation is temporarily unavailable. Please retry shortly.",
  });
}

async function enforceMemberMutationTrafficControl(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
  scope: string;
}) {
  return enforceTrafficControl({
    supabase: input.supabase,
    rule: TRAFFIC_CONTROL_RULES.companyMemberMutatePerUser,
    identity: {
      userId: input.userId,
      scope: input.scope,
      includeIp: false,
    },
    throttledMessage: "Too many team management updates from this account. Please wait and retry.",
    unavailableMessage: "Team management updates are temporarily unavailable. Please retry shortly.",
  });
}

async function enforceInviteAcceptTrafficControl(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  userId: string;
}) {
  return enforceTrafficControl({
    supabase: input.supabase,
    rule: TRAFFIC_CONTROL_RULES.companyInviteAcceptPerUser,
    identity: {
      userId: input.userId,
      includeIp: true,
    },
    throttledMessage: "Too many invite acceptance attempts from this account. Please wait and retry.",
    unavailableMessage: "Invite acceptance is temporarily unavailable. Please retry shortly.",
  });
}

export async function createCompanyTeamInviteAction(
  previousState: CompanyTeamInviteActionState = COMPANY_TEAM_INVITE_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamInviteActionState> {
  void previousState;
  const input = readCompanyTeamInviteInput(formData);
  const validationErrors = validateCompanyTeamInviteInput(input);

  if (Object.keys(validationErrors).length > 0) {
    return toInviteValidationErrorState(validationErrors);
  }

  const supabase = await createServerSupabaseClient();
  const managerContext = await loadTeamManagerContext(supabase);
  if (!managerContext.ok) {
    return {
      status: "error",
      message: managerContext.message,
    };
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceInviteCreateTrafficControl({
    supabase,
    userId: managerContext.profile.id,
  });

  if (!trafficResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationInviteCreateFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization",
        targetId: managerContext.organization.id,
        metadata: {
          outcome: "rate_limited",
          membership_role: managerContext.membershipRole,
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: trafficResult.message,
    };
  }

  const { data, error } = await supabase
    .rpc("create_organization_member_invite", {
      p_organization_id: managerContext.organization.id,
      p_role: input.role,
      p_invite_email: input.inviteMethod === "email" ? (input.inviteEmail ?? undefined) : undefined,
      p_target_user_id: input.inviteMethod === "userId" ? (input.targetUserId ?? undefined) : undefined,
    })
    .single<CreateInviteRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationInviteCreateFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization",
        targetId: managerContext.organization.id,
        metadata: {
          outcome: "failed",
          membership_role: managerContext.membershipRole,
          invite_method: input.inviteMethod,
          invite_role: input.role,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_invite_create_error",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: mapInviteCreateError(error?.message ?? ""),
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteCreated,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_invite",
      targetId: data.invite_id,
      metadata: {
        organization_id: managerContext.organization.id,
        organization_slug: managerContext.organization.slug,
        membership_role: managerContext.membershipRole,
        invite_method: input.inviteMethod,
        invite_role: data.invite_role,
        invite_target_user_id: data.target_user_id,
        invite_target_email: data.invite_email,
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: "Team invite created. Share the secure link with the invited user.",
    inviteLinkPath: `/profile/company/invites/${data.invite_token}`,
  };
}

export async function revokeCompanyTeamInviteAction(
  previousState: CompanyTeamMutationActionState = COMPANY_TEAM_MUTATION_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamMutationActionState> {
  void previousState;

  const input = readInviteRevocationInput(formData);
  const validationError = validateInviteRevocationInput(input);
  if (validationError) {
    return toGenericErrorState(validationError);
  }
  const inviteId = input.inviteId!;

  const supabase = await createServerSupabaseClient();
  const managerContext = await loadTeamManagerContext(supabase);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceMemberMutationTrafficControl({
    supabase,
    userId: managerContext.profile.id,
    scope: `revoke-invite:${inviteId}`,
  });

  if (!trafficResult.ok) {
    return toGenericErrorState(trafficResult.message);
  }

  const { data, error } = await supabase
    .rpc("revoke_organization_member_invite", {
      p_invite_id: inviteId,
    })
    .single<RevokeInviteRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationInviteRevokeFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization_invite",
        targetId: inviteId,
        metadata: {
          outcome: "failed",
          membership_role: managerContext.membershipRole,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_invite_revoke_error",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapInviteRevokeError(error?.message ?? ""));
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteRevoked,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_invite",
      targetId: data.invite_id,
      metadata: {
        organization_id: data.organization_id,
        membership_role: managerContext.membershipRole,
        invite_role: data.invite_role,
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: "Invite revoked.",
  };
}

export async function updateCompanyTeamMemberRoleAction(
  previousState: CompanyTeamMutationActionState = COMPANY_TEAM_MUTATION_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamMutationActionState> {
  void previousState;

  const input = readMembershipRoleChangeInput(formData);
  const validationError = validateMembershipRoleChangeInput(input);
  if (validationError) {
    return toGenericErrorState(validationError);
  }
  const membershipId = input.membershipId!;

  const supabase = await createServerSupabaseClient();
  const managerContext = await loadTeamManagerContext(supabase);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceMemberMutationTrafficControl({
    supabase,
    userId: managerContext.profile.id,
    scope: `member-role:${membershipId}`,
  });

  if (!trafficResult.ok) {
    return toGenericErrorState(trafficResult.message);
  }

  const { data, error } = await supabase
    .rpc("update_organization_member_role", {
      p_membership_id: membershipId,
      p_new_role: input.newRole,
    })
    .single<UpdateRoleRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationMemberRoleChangeFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization_member",
        targetId: membershipId,
        metadata: {
          outcome: "failed",
          membership_role: managerContext.membershipRole,
          requested_role: input.newRole,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_member_role_update_error",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapMemberRoleError(error?.message ?? ""));
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationMemberRoleChanged,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_member",
      targetId: data.membership_id,
      metadata: {
        organization_id: data.organization_id,
        target_user_id: data.user_id,
        membership_role: managerContext.membershipRole,
        previous_role: data.previous_role,
        new_role: data.new_role,
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: "Member role updated.",
  };
}

export async function updateCompanyTeamMemberStatusAction(
  previousState: CompanyTeamMutationActionState = COMPANY_TEAM_MUTATION_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamMutationActionState> {
  void previousState;

  const input = readMembershipStatusInput(formData);
  const validationError = validateMembershipStatusInput(input);
  if (validationError) {
    return toGenericErrorState(validationError);
  }
  const membershipId = input.membershipId!;

  const supabase = await createServerSupabaseClient();
  const managerContext = await loadTeamManagerContext(supabase);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceMemberMutationTrafficControl({
    supabase,
    userId: managerContext.profile.id,
    scope: `member-status:${membershipId}`,
  });

  if (!trafficResult.ok) {
    return toGenericErrorState(trafficResult.message);
  }

  const { data, error } = await supabase
    .rpc("update_organization_member_status", {
      p_membership_id: membershipId,
      p_new_status: input.nextStatus,
    })
    .single<UpdateStatusRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationMemberStatusUpdateFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization_member",
        targetId: membershipId,
        metadata: {
          outcome: "failed",
          membership_role: managerContext.membershipRole,
          requested_status: input.nextStatus,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_member_status_update_error",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapMemberStatusError(error?.message ?? ""));
  }

  const eventType =
    data.new_status === "active"
      ? AUDIT_EVENT_TYPES.organizationMemberReactivated
      : AUDIT_EVENT_TYPES.organizationMemberSuspended;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_member",
      targetId: data.membership_id,
      metadata: {
        organization_id: data.organization_id,
        target_user_id: data.user_id,
        membership_role: managerContext.membershipRole,
        previous_status: data.previous_status,
        new_status: data.new_status,
        target_role: data.role,
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: data.new_status === "active" ? "Member reactivated." : "Member suspended.",
  };
}

export async function removeCompanyTeamMemberAction(
  previousState: CompanyTeamMutationActionState = COMPANY_TEAM_MUTATION_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamMutationActionState> {
  void previousState;

  const input = readMemberRemovalInput(formData);
  const validationError = validateMemberRemovalInput(input);
  if (validationError) {
    return toGenericErrorState(validationError);
  }
  const membershipId = input.membershipId!;

  const supabase = await createServerSupabaseClient();
  const managerContext = await loadTeamManagerContext(supabase);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceMemberMutationTrafficControl({
    supabase,
    userId: managerContext.profile.id,
    scope: `member-remove:${membershipId}`,
  });

  if (!trafficResult.ok) {
    return toGenericErrorState(trafficResult.message);
  }

  const { data, error } = await supabase
    .rpc("remove_organization_member", {
      p_membership_id: membershipId,
    })
    .single<RemoveMemberRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationMemberRemoveFailed,
        actorUserId: managerContext.profile.id,
        actorRole: managerContext.profile.role,
        targetType: "organization_member",
        targetId: membershipId,
        metadata: {
          outcome: "failed",
          membership_role: managerContext.membershipRole,
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_member_remove_error",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapMemberRemoveError(error?.message ?? ""));
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationMemberRemoved,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_member",
      targetId: data.membership_id,
      metadata: {
        organization_id: data.organization_id,
        target_user_id: data.user_id,
        membership_role: managerContext.membershipRole,
        removed_role: data.removed_role,
        removed_status: data.removed_status,
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: "Member removed from the company workspace.",
  };
}

export async function acceptCompanyTeamInviteAction(
  previousState: CompanyTeamMutationActionState = COMPANY_TEAM_MUTATION_IDLE_STATE,
  formData: FormData
): Promise<CompanyTeamMutationActionState> {
  void previousState;

  const input = readInviteAcceptanceInput(formData);
  const validationError = validateInviteAcceptanceInput(input);
  if (validationError) {
    return toGenericErrorState(validationError);
  }
  const inviteToken = input.inviteToken!;

  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return toGenericErrorState(profileResult.message);
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceInviteAcceptTrafficControl({
    supabase,
    userId: profileResult.profile.id,
  });

  if (!trafficResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationInviteAcceptFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "organization_invite",
        targetId: inviteToken,
        metadata: {
          outcome: "rate_limited",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(trafficResult.message);
  }

  const { data, error } = await supabase
    .rpc("accept_organization_member_invite", {
      p_invite_token: inviteToken,
    })
    .single<AcceptInviteRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationInviteAcceptFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "organization_invite",
        targetId: inviteToken,
        metadata: {
          outcome: "failed",
          error_code: error?.code ?? null,
          error_message: error?.message ?? "unknown_invite_accept_error",
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapInviteAcceptError(error?.message ?? ""));
  }

  const { data: organizationRow } = await supabase
    .from("organizations")
    .select("slug")
    .eq("id", data.organization_id)
    .maybeSingle();

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteAccepted,
      actorUserId: profileResult.profile.id,
      actorRole: profileResult.profile.role,
      targetType: "organization_invite",
      targetId: data.invite_id,
      metadata: {
        organization_id: data.organization_id,
        member_id: data.member_id,
        membership_role: data.membership_role,
        acceptance_outcome: data.acceptance_outcome,
        ...requestFingerprint,
      },
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/team");

  if (organizationRow?.slug) {
    revalidatePath(`/companies/${organizationRow.slug}`);
  }

  return {
    status: "success",
    message: "Company invite accepted.",
    redirectTo: "/profile/company?status=invite-accepted",
  };
}
