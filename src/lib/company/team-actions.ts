"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  canInviteOrganizationRole,
  canMutateOrganizationMemberRole,
  canMutateOrganizationMemberStatus,
  canRemoveOrganizationMember,
} from "@/lib/company/permissions";
import {
  getCompanyAdminClient,
  requireCurrentUserScopedCompanyAccess,
} from "@/lib/company/server-authorization";
import type { CompanyWorkspaceSummary } from "@/lib/company/context";
import {
  COMPANY_TEAM_INVITE_IDLE_STATE,
  COMPANY_TEAM_MUTATION_IDLE_STATE,
  type CompanyTeamInviteActionState,
  type CompanyTeamMutationActionState,
  type OrganizationMemberStatus,
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
import {
  notifyCompanyInviteAccepted,
  notifyCompanyInviteReceived,
  notifyCompanyMemberAdded,
  notifyCompanyMemberRemoved,
  notifyCompanyMemberRoleChanged,
  notifyCompanyMemberSuspended,
} from "@/lib/notifications";
import {
  createSchemaDriftMessage,
  isSupabaseSchemaDriftError,
} from "@/lib/supabase/schema-drift";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database";

type TeamMutationMembershipRow = Pick<
  Tables<"organization_members">,
  "id" | "organization_id" | "role" | "member_status" | "user_id"
>;

type TeamMutationInviteRow = Pick<
  Tables<"organization_member_invites">,
  "id" | "organization_id" | "role" | "invite_status" | "invite_email" | "target_user_id"
>;

type TeamInviteMutationResult = Pick<
  Tables<"organization_member_invites">,
  "id" | "organization_id" | "role" | "invite_status" | "invite_token" | "invite_email" | "target_user_id"
>;

type TeamInviteCreateRpcResult =
  Database["public"]["Functions"]["create_organization_member_invite"]["Returns"][number];

type TeamMembershipRoleMutationResult = Pick<
  Tables<"organization_members">,
  "id" | "organization_id" | "user_id" | "role"
>;

type TeamMembershipStatusMutationResult = Pick<
  Tables<"organization_members">,
  "id" | "organization_id" | "user_id" | "role" | "member_status"
>;

type TeamManagerContextResult =
  | {
      ok: true;
      profile: Tables<"profiles">;
      organization: CompanyWorkspaceSummary;
      membershipRole: "owner" | "admin";
      membershipStatus: OrganizationMemberStatus;
    }
  | {
      ok: false;
      message: string;
    };

function toTeamInviteMutationResult(
  row: TeamInviteCreateRpcResult
): TeamInviteMutationResult {
  return {
    id: row.invite_id,
    organization_id: row.organization_id,
    role: row.invite_role,
    invite_status: row.invite_status,
    invite_token: row.invite_token,
    invite_email: row.invite_email ?? null,
    target_user_id: row.target_user_id ?? null,
  };
}

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

  if (
    normalized.includes("schema cache") ||
    normalized.includes("undefined function") ||
    normalized.includes("could not find the function") ||
    (
      normalized.includes("create_organization_member_invite") &&
      (normalized.includes("does not exist") || normalized.includes("not found"))
    ) ||
    normalized.includes("relation") && normalized.includes("organization_member_invites")
  ) {
    return createSchemaDriftMessage("Company invite");
  }

  if (normalized.includes("already an active company member")) {
    return "This user is already an active member of the company workspace.";
  }

  if (normalized.includes("active invite already exists")) {
    return "An active invite already exists for this user.";
  }

  if (
    normalized.includes("organization_member_invites_pending_user_unique_idx") ||
    normalized.includes("organization_member_invites_pending_email_unique_idx") ||
    normalized.includes("duplicate key")
  ) {
    return "An active invite already exists for this user.";
  }

  if (normalized.includes("cannot invite owner or admin roles")) {
    return "Admin members can only invite manager or agent roles.";
  }

  if (
    normalized.includes("only owner") ||
    normalized.includes("permission") ||
    normalized.includes("authentication") ||
    normalized.includes("row-level security")
  ) {
    return "You do not have permission to invite team members from this workspace.";
  }

  if (normalized.includes("email is invalid")) {
    return "Enter a valid email address before sending the invite.";
  }

  if (normalized.includes("target requires email or roofhub user id")) {
    return "Choose either email or RoofHub user ID before sending the invite.";
  }

  if (normalized.includes("roofhub user id is invalid")) {
    return "RoofHub user ID was not found.";
  }

  if (
    normalized.includes("organization_member_invites_target_user_id_fkey") ||
    normalized.includes("foreign key constraint")
  ) {
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
  revalidatePath("/dashboard");
  revalidatePath(`/companies/${input.organizationSlug}`);
  revalidatePath("/companies/[slug]", "page");
}

async function loadTeamManagerContext(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId?: string | null
): Promise<TeamManagerContextResult> {
  const companyAccess = await requireCurrentUserScopedCompanyAccess(supabase, {
    organizationId,
    permission: "team_management",
    selectionRequiredMessage:
      "Select an active company workspace before managing team access.",
    membershipRequiredMessage: "Only owner or admin members can manage team access.",
    forbiddenMessage: "Only owner or admin members can manage team access.",
  });

  if (!companyAccess.ok) {
    return {
      ok: false,
      message: companyAccess.message,
    };
  }

  return {
    ok: true,
    profile: companyAccess.profile,
    organization: companyAccess.organization,
    membershipRole:
      companyAccess.membership.role === "owner" ? "owner" : "admin",
    membershipStatus: companyAccess.membership.member_status,
  };
}

async function loadScopedMembershipForTeamMutation(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    membershipId: string;
    organizationId: string;
  }
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("id, organization_id, role, member_status, user_id")
    .eq("id", input.membershipId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      row: null as TeamMutationMembershipRow | null,
    };
  }

  return {
    ok: true as const,
    row: data as TeamMutationMembershipRow,
  };
}

async function loadScopedInviteForTeamMutation(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    inviteId: string;
    organizationId: string;
  }
) {
  const { data, error } = await supabase
    .from("organization_member_invites")
    .select("id, organization_id, role, invite_status")
    .eq("id", input.inviteId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      row: null as TeamMutationInviteRow | null,
    };
  }

  return {
    ok: true as const,
    row: data as TeamMutationInviteRow,
  };
}

async function countActiveOrganizationOwners(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  organizationId: string;
  excludeMembershipId?: string;
}) {
  let query = input.supabase
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", input.organizationId)
    .eq("role", "owner")
    .eq("member_status", "active");

  if (input.excludeMembershipId) {
    query = query.neq("id", input.excludeMembershipId);
  }

  const { count, error } = await query;

  if (error) {
    return null;
  }

  return count ?? 0;
}

async function acceptCompanyInviteWithTrustedServerPath(input: {
  inviteToken: string;
  user: Tables<"profiles">;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}) {
  const adminSupabase = getCompanyAdminClient();
  const {
    data: { user: authUser },
    error: authUserError,
  } = await input.supabase.auth.getUser();

  if (authUserError || !authUser) {
    return {
      ok: false as const,
      errorMessage: "Authentication is required to accept an invite.",
    };
  }

  const { data: invite, error: inviteError } = await adminSupabase
    .from("organization_member_invites")
    .select(
      "id, organization_id, invite_email, target_user_id, invite_status, role, invited_by_user_id, accepted_by_user_id, accepted_at, expires_at"
    )
    .eq("invite_token", input.inviteToken)
    .maybeSingle();

  if (inviteError || !invite) {
    return {
      ok: false as const,
      errorMessage: "Invite is invalid or unavailable.",
    };
  }

  if (invite.target_user_id && invite.target_user_id !== input.user.id) {
    return {
      ok: false as const,
      errorMessage: "This invite was issued for a different RoofHub user account.",
    };
  }

  const normalizedUserEmail = authUser.email?.trim().toLowerCase() ?? null;
  const normalizedInviteEmail = invite.invite_email?.trim().toLowerCase() ?? null;

  if (
    invite.target_user_id === null &&
    (!normalizedInviteEmail || normalizedInviteEmail !== normalizedUserEmail)
  ) {
    return {
      ok: false as const,
      errorMessage: "This invite email does not match your signed-in account.",
    };
  }

  if (invite.invite_status === "accepted") {
    if (invite.accepted_by_user_id === input.user.id) {
      const { data: acceptedMembership } = await adminSupabase
        .from("organization_members")
        .select("id, organization_id, user_id, role, member_status")
        .eq("organization_id", invite.organization_id)
        .eq("user_id", input.user.id)
        .maybeSingle();

      return acceptedMembership
        ? {
            ok: true as const,
            inviteId: invite.id,
            organizationId: invite.organization_id,
            memberId: acceptedMembership.id,
            membershipRole: acceptedMembership.role,
            acceptanceOutcome: "already_accepted",
            invitedByUserId: invite.invited_by_user_id,
          }
        : {
            ok: false as const,
            errorMessage: "Invite has already been accepted.",
          };
    }

    return {
      ok: false as const,
      errorMessage: "Invite has already been accepted.",
    };
  }

  if (invite.invite_status === "revoked") {
    return {
      ok: false as const,
      errorMessage: "Invite has been revoked.",
    };
  }

  const expiresAt = invite.expires_at ? new Date(invite.expires_at) : null;
  if (invite.invite_status === "expired" || (expiresAt && expiresAt.getTime() <= Date.now())) {
    await adminSupabase
      .from("organization_member_invites")
      .update({ invite_status: "expired" })
      .eq("id", invite.id)
      .eq("invite_status", "pending");

    return {
      ok: false as const,
      errorMessage: "Invite has expired.",
    };
  }

  const { data: existingMembership, error: existingMembershipError } = await adminSupabase
    .from("organization_members")
    .select("id, organization_id, user_id, role, member_status, invited_by_user_id")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", input.user.id)
    .maybeSingle();

  if (existingMembershipError) {
    return {
      ok: false as const,
      errorMessage: existingMembershipError.message,
    };
  }

  let memberId: string;
  let membershipRole: Tables<"organization_members">["role"];
  let acceptanceOutcome = "joined";

  if (existingMembership) {
    memberId = existingMembership.id;
    membershipRole = existingMembership.role;

    if (existingMembership.member_status === "active") {
      acceptanceOutcome = "already_active_member";
    } else {
      const { data: reactivatedMembership, error: reactivatedMembershipError } = await adminSupabase
        .from("organization_members")
        .update({
          role: invite.role,
          member_status: "active",
          invited_by_user_id: invite.invited_by_user_id ?? existingMembership.invited_by_user_id,
          joined_at: new Date().toISOString(),
        })
        .eq("id", existingMembership.id)
        .select("id, role")
        .maybeSingle();

      if (reactivatedMembershipError || !reactivatedMembership) {
        return {
          ok: false as const,
          errorMessage:
            reactivatedMembershipError?.message ?? "Invite could not be accepted right now.",
        };
      }

      memberId = reactivatedMembership.id;
      membershipRole = reactivatedMembership.role;
      acceptanceOutcome = "reactivated_member";
    }
  } else {
    const { data: insertedMembership, error: insertedMembershipError } = await adminSupabase
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: input.user.id,
        role: invite.role,
        member_status: "active",
        invited_by_user_id: invite.invited_by_user_id,
      })
      .select("id, role")
      .maybeSingle();

    if (insertedMembershipError || !insertedMembership) {
      return {
        ok: false as const,
        errorMessage:
          insertedMembershipError?.message ?? "Invite could not be accepted right now.",
      };
    }

    memberId = insertedMembership.id;
    membershipRole = insertedMembership.role;
  }

  const { error: inviteUpdateError } = await adminSupabase
    .from("organization_member_invites")
    .update({
      target_user_id: invite.target_user_id ?? input.user.id,
      invite_status: "accepted",
      accepted_at: new Date().toISOString(),
      accepted_by_user_id: input.user.id,
    })
    .eq("id", invite.id)
    .eq("invite_status", "pending");

  if (inviteUpdateError) {
    return {
      ok: false as const,
      errorMessage: inviteUpdateError.message,
    };
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      role: input.user.role === "admin" ? "admin" : "provider",
      provider_account_type: "company",
      active_organization_id: invite.organization_id,
    })
    .eq("id", input.user.id);

  if (profileUpdateError) {
    return {
      ok: false as const,
      errorMessage: profileUpdateError.message,
    };
  }

  return {
    ok: true as const,
    inviteId: invite.id,
    organizationId: invite.organization_id,
    memberId,
    membershipRole,
    acceptanceOutcome,
    invitedByUserId: invite.invited_by_user_id,
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

async function findAuthUserIdByEmail(input: {
  adminSupabase: ReturnType<typeof getCompanyAdminClient>;
  normalizedEmail: string;
}) {
  const perPage = 200;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await input.adminSupabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      return null;
    }

    const users = data?.users ?? [];
    if (users.length === 0) {
      return null;
    }

    const matchedUser = users.find(
      (candidate) => candidate.email?.trim().toLowerCase() === input.normalizedEmail
    );

    if (matchedUser?.id) {
      return matchedUser.id;
    }

    if (users.length < perPage) {
      return null;
    }
  }

  return null;
}

async function createInviteForKnownUserByEmailFallback(input: {
  organizationId: string;
  actorUserId: string;
  inviteRole: TeamInviteMutationResult["role"];
  inviteEmail: string;
}) {
  const adminSupabase = getCompanyAdminClient();
  const normalizedEmail = input.inviteEmail.trim().toLowerCase();

  if (!normalizedEmail) {
    return {
      ok: false as const,
      errorMessage: "Invite email is invalid.",
      errorCode: "P0001",
    };
  }

  const targetUserId = await findAuthUserIdByEmail({
    adminSupabase,
    normalizedEmail,
  });

  if (!targetUserId) {
    return {
      ok: false as const,
      errorMessage: createSchemaDriftMessage("Company invite"),
      errorCode: "SCHEMA_DRIFT_EMAIL_LOOKUP",
    };
  }

  const { data: existingMembership, error: existingMembershipError } = await adminSupabase
    .from("organization_members")
    .select("id, member_status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existingMembershipError) {
    return {
      ok: false as const,
      errorMessage: existingMembershipError.message,
      errorCode: existingMembershipError.code ?? null,
    };
  }

  if (existingMembership?.member_status === "active") {
    return {
      ok: false as const,
      errorMessage: "Target user is already an active company member.",
      errorCode: "P0001",
    };
  }

  const { data, error } = await adminSupabase
    .from("organization_member_invites")
    .insert({
      organization_id: input.organizationId,
      invited_by_user_id: input.actorUserId,
      invite_email: null,
      target_user_id: targetUserId,
      role: input.inviteRole,
      invite_status: "pending",
    })
    .select("id, organization_id, role, invite_status, invite_token, invite_email, target_user_id")
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      errorMessage: error?.message ?? "unknown_invite_create_error",
      errorCode: error?.code ?? null,
    };
  }

  return {
    ok: true as const,
    invite: data as TeamInviteMutationResult,
  };
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
  const managerContext = await loadTeamManagerContext(supabase, input.organizationId);
  if (!managerContext.ok) {
    return {
      status: "error",
      message: managerContext.message,
    };
  }

  if (
    !canInviteOrganizationRole(
      managerContext.membershipRole,
      managerContext.membershipStatus,
      input.role
    )
  ) {
    return {
      status: "error",
      message: "You do not have permission to invite this role.",
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

  const { data: createdInviteRows, error } = await supabase.rpc(
    "create_organization_member_invite",
    {
      p_organization_id: managerContext.organization.id,
      p_role: input.role,
      p_invite_email: input.inviteMethod === "email" ? (input.inviteEmail ?? undefined) : undefined,
      p_target_user_id: input.inviteMethod === "userId" ? (input.targetUserId ?? undefined) : undefined,
    }
  );

  const createdInviteRow = createdInviteRows?.[0] ?? null;
  let createdInvite: TeamInviteMutationResult | null = createdInviteRow
    ? toTeamInviteMutationResult(createdInviteRow)
    : null;

  if (error || !createdInvite) {
    const fallbackMessage = error?.message ?? "Invite mutation returned no row.";
    const shouldAttemptKnownUserFallback =
      input.inviteMethod === "email" &&
      input.inviteEmail !== null &&
      fallbackMessage.toLowerCase().includes("invite email is invalid");

    if (shouldAttemptKnownUserFallback) {
      const knownUserFallback = await createInviteForKnownUserByEmailFallback({
        organizationId: managerContext.organization.id,
        actorUserId: managerContext.profile.id,
        inviteRole: input.role,
        inviteEmail: input.inviteEmail!,
      });

      if (knownUserFallback.ok) {
        createdInvite = knownUserFallback.invite;
      } else {
        console.error("[Company][TeamInvite] email fallback failed", {
          organization_id: managerContext.organization.id,
          actor_user_id: managerContext.profile.id,
          membership_role: managerContext.membershipRole,
          invite_method: input.inviteMethod,
          invite_role: input.role,
          error_code: knownUserFallback.errorCode,
          error_message: knownUserFallback.errorMessage,
        });
      }
    }
  }

  if (!createdInvite) {
    const fallbackMessage = error?.message ?? "Invite mutation returned no row.";

    console.error("[Company][TeamInvite] create failed", {
      organization_id: managerContext.organization.id,
      actor_user_id: managerContext.profile.id,
      membership_role: managerContext.membershipRole,
      invite_method: input.inviteMethod,
      invite_role: input.role,
      error_code: error?.code ?? null,
      error_message: fallbackMessage,
      error_details: error?.details ?? null,
      error_hint: error?.hint ?? null,
    });

    const mappedErrorMessage = isSupabaseSchemaDriftError(
      {
        code: error?.code ?? null,
        message: fallbackMessage,
        details: error?.details ?? null,
        hint: error?.hint ?? null,
      },
      ["create_organization_member_invite", "organization_member_invites"]
    )
      ? createSchemaDriftMessage("Company invite")
      : mapInviteCreateError(fallbackMessage);

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
          error_message: fallbackMessage,
          error_details: error?.details ?? null,
          error_hint: error?.hint ?? null,
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: mappedErrorMessage,
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteCreated,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_invite",
      targetId: createdInvite.id,
      metadata: {
        organization_id: managerContext.organization.id,
        organization_slug: managerContext.organization.slug,
        membership_role: managerContext.membershipRole,
        invite_method: input.inviteMethod,
        invite_role: createdInvite.role,
        invite_target_user_id: createdInvite.target_user_id,
        invite_target_email: createdInvite.invite_email,
        ...requestFingerprint,
      },
    },
  });

  await notifyCompanyInviteReceived({
    recipientUserId: createdInvite.target_user_id,
    organizationId: managerContext.organization.id,
    organizationName: managerContext.organization.name,
    inviteId: createdInvite.id,
    inviteToken: createdInvite.invite_token,
    role: createdInvite.role,
    actorUserId: managerContext.profile.id,
  });

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message: "Team invite created. Share the secure link with the invited user.",
    inviteLinkPath: `/profile/company/invites/${createdInvite.invite_token}`,
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
  const managerContext = await loadTeamManagerContext(supabase, input.organizationId);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const scopedInvite = await loadScopedInviteForTeamMutation(supabase, {
    inviteId,
    organizationId: managerContext.organization.id,
  });

  if (!scopedInvite.ok || !scopedInvite.row) {
    return toGenericErrorState(
      "Invite not found in the current company workspace."
    );
  }

  if (
    !canInviteOrganizationRole(
      managerContext.membershipRole,
      managerContext.membershipStatus,
      scopedInvite.row.role
    )
  ) {
    return toGenericErrorState("You do not have permission to revoke this invite.");
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
    .from("organization_member_invites")
    .update({
      invite_status: "revoked",
    })
    .eq("id", inviteId)
    .eq("organization_id", managerContext.organization.id)
    .eq("invite_status", "pending")
    .select("id, organization_id, role, invite_status, invite_email, target_user_id")
    .maybeSingle();

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

  const revokedInvite = data as TeamMutationInviteRow;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteRevoked,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_invite",
      targetId: revokedInvite.id,
      metadata: {
        organization_id: revokedInvite.organization_id,
        membership_role: managerContext.membershipRole,
        invite_role: revokedInvite.role,
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
  const managerContext = await loadTeamManagerContext(supabase, input.organizationId);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const scopedMembership = await loadScopedMembershipForTeamMutation(supabase, {
    membershipId,
    organizationId: managerContext.organization.id,
  });

  if (!scopedMembership.ok || !scopedMembership.row) {
    return toGenericErrorState(
      "Member not found in the current company workspace."
    );
  }

  if (
    !canMutateOrganizationMemberRole(
      managerContext.membershipRole,
      managerContext.membershipStatus,
      scopedMembership.row.role,
      input.newRole
    )
  ) {
    return toGenericErrorState(
      "You do not have permission to change this member role."
    );
  }

  if (
    scopedMembership.row.role === "owner" &&
    input.newRole !== "owner" &&
    scopedMembership.row.member_status === "active"
  ) {
    const remainingOwnerCount = await countActiveOrganizationOwners({
      supabase,
      organizationId: managerContext.organization.id,
      excludeMembershipId: membershipId,
    });

    if (remainingOwnerCount !== null && remainingOwnerCount < 1) {
      return toGenericErrorState(
        "Role update blocked because at least one active owner must remain."
      );
    }
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

  const previousRole = scopedMembership.row.role;
  const { data, error } = await supabase
    .from("organization_members")
    .update({
      role: input.newRole,
    })
    .eq("id", membershipId)
    .eq("organization_id", managerContext.organization.id)
    .select("id, organization_id, user_id, role")
    .maybeSingle();

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

  const updatedMembershipRole = data as TeamMembershipRoleMutationResult;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationMemberRoleChanged,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_member",
      targetId: updatedMembershipRole.id,
      metadata: {
        organization_id: updatedMembershipRole.organization_id,
        target_user_id: updatedMembershipRole.user_id,
        membership_role: managerContext.membershipRole,
        previous_role: previousRole,
        new_role: updatedMembershipRole.role,
        ...requestFingerprint,
      },
    },
  });

  await notifyCompanyMemberRoleChanged({
    organizationId: managerContext.organization.id,
    organizationName: managerContext.organization.name,
    memberUserId: updatedMembershipRole.user_id,
    memberDisplayName: null,
    previousRole,
    nextRole: updatedMembershipRole.role,
    actorUserId: managerContext.profile.id,
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
  const managerContext = await loadTeamManagerContext(supabase, input.organizationId);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const scopedMembership = await loadScopedMembershipForTeamMutation(supabase, {
    membershipId,
    organizationId: managerContext.organization.id,
  });

  if (!scopedMembership.ok || !scopedMembership.row) {
    return toGenericErrorState(
      "Member not found in the current company workspace."
    );
  }

  if (
    !canMutateOrganizationMemberStatus(
      managerContext.membershipRole,
      managerContext.membershipStatus,
      scopedMembership.row.role
    )
  ) {
    return toGenericErrorState(
      "You do not have permission to update this member status."
    );
  }

  if (
    scopedMembership.row.role === "owner" &&
    scopedMembership.row.member_status === "active" &&
    input.nextStatus !== "active"
  ) {
    const remainingOwnerCount = await countActiveOrganizationOwners({
      supabase,
      organizationId: managerContext.organization.id,
      excludeMembershipId: membershipId,
    });

    if (remainingOwnerCount !== null && remainingOwnerCount < 1) {
      return toGenericErrorState(
        "Status update blocked because at least one active owner must remain."
      );
    }
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

  const previousStatus = scopedMembership.row.member_status;
  const { data, error } = await supabase
    .from("organization_members")
    .update({
      member_status: input.nextStatus,
    })
    .eq("id", membershipId)
    .eq("organization_id", managerContext.organization.id)
    .select("id, organization_id, user_id, role, member_status")
    .maybeSingle();

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

  const updatedMembershipStatus = data as TeamMembershipStatusMutationResult;

  const eventType =
    updatedMembershipStatus.member_status === "active"
      ? AUDIT_EVENT_TYPES.organizationMemberReactivated
      : AUDIT_EVENT_TYPES.organizationMemberSuspended;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType,
      actorUserId: managerContext.profile.id,
      actorRole: managerContext.profile.role,
      targetType: "organization_member",
      targetId: updatedMembershipStatus.id,
      metadata: {
        organization_id: updatedMembershipStatus.organization_id,
        target_user_id: updatedMembershipStatus.user_id,
        membership_role: managerContext.membershipRole,
        previous_status: previousStatus,
        new_status: updatedMembershipStatus.member_status,
        target_role: updatedMembershipStatus.role,
        ...requestFingerprint,
      },
    },
  });

  if (updatedMembershipStatus.member_status === "inactive") {
    await notifyCompanyMemberSuspended({
      organizationId: managerContext.organization.id,
      organizationName: managerContext.organization.name,
      memberUserId: updatedMembershipStatus.user_id,
      memberDisplayName: null,
      memberRole: updatedMembershipStatus.role,
      actorUserId: managerContext.profile.id,
    });
  }

  revalidateCompanyTeamPaths({ organizationSlug: managerContext.organization.slug });

  return {
    status: "success",
    message:
      updatedMembershipStatus.member_status === "active"
        ? "Member reactivated."
        : "Member suspended.",
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
  const managerContext = await loadTeamManagerContext(supabase, input.organizationId);
  if (!managerContext.ok) {
    return toGenericErrorState(managerContext.message);
  }

  const scopedMembership = await loadScopedMembershipForTeamMutation(supabase, {
    membershipId,
    organizationId: managerContext.organization.id,
  });

  if (!scopedMembership.ok || !scopedMembership.row) {
    return toGenericErrorState(
      "Member not found in the current company workspace."
    );
  }

  if (
    !canRemoveOrganizationMember(
      managerContext.membershipRole,
      managerContext.membershipStatus,
      scopedMembership.row.role
    )
  ) {
    return toGenericErrorState("You do not have permission to remove this member.");
  }

  if (
    scopedMembership.row.role === "owner" &&
    scopedMembership.row.member_status === "active"
  ) {
    const remainingOwnerCount = await countActiveOrganizationOwners({
      supabase,
      organizationId: managerContext.organization.id,
      excludeMembershipId: membershipId,
    });

    if (remainingOwnerCount !== null && remainingOwnerCount < 1) {
      return toGenericErrorState(
        "Removal blocked because at least one active owner must remain."
      );
    }
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

  const removedRole = scopedMembership.row.role;
  const removedStatus = scopedMembership.row.member_status;
  const removedUserId = scopedMembership.row.user_id;
  const { data, error } = await supabase
    .from("organization_members")
    .delete()
    .eq("id", membershipId)
    .eq("organization_id", managerContext.organization.id)
    .select("id")
    .maybeSingle();

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
      targetId: membershipId,
      metadata: {
        organization_id: managerContext.organization.id,
        target_user_id: removedUserId,
        membership_role: managerContext.membershipRole,
        removed_role: removedRole,
        removed_status: removedStatus,
        ...requestFingerprint,
      },
    },
  });

  await notifyCompanyMemberRemoved({
    organizationId: managerContext.organization.id,
    organizationName: managerContext.organization.name,
    memberUserId: removedUserId,
    memberDisplayName: null,
    memberRole: removedRole,
    actorUserId: managerContext.profile.id,
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

  const acceptedInvite = await acceptCompanyInviteWithTrustedServerPath({
    inviteToken,
    user: profileResult.profile,
    supabase,
  });

  if (!acceptedInvite.ok) {
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
          error_code: null,
          error_message: acceptedInvite.errorMessage,
          ...requestFingerprint,
        },
      },
    });

    return toGenericErrorState(mapInviteAcceptError(acceptedInvite.errorMessage));
  }

  const { data: organizationRow } = await supabase
    .from("organizations")
    .select("name, slug")
    .eq("id", acceptedInvite.organizationId)
    .maybeSingle();

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationInviteAccepted,
      actorUserId: profileResult.profile.id,
      actorRole: profileResult.profile.role,
      targetType: "organization_invite",
      targetId: acceptedInvite.inviteId,
      metadata: {
        organization_id: acceptedInvite.organizationId,
        member_id: acceptedInvite.memberId,
        membership_role: acceptedInvite.membershipRole,
        acceptance_outcome: acceptedInvite.acceptanceOutcome,
        ...requestFingerprint,
      },
    },
  });

  if (acceptedInvite.acceptanceOutcome !== "already_accepted") {
    await notifyCompanyInviteAccepted({
      organizationId: acceptedInvite.organizationId,
      organizationName: organizationRow?.name ?? "this company workspace",
      inviteId: acceptedInvite.inviteId,
      acceptedUserId: profileResult.profile.id,
      acceptedUserDisplayName: profileResult.profile.display_name,
      acceptedRole: acceptedInvite.membershipRole,
      actorUserId: profileResult.profile.id,
      invitedByUserId: acceptedInvite.invitedByUserId ?? null,
    });

    if (
      acceptedInvite.acceptanceOutcome === "joined" ||
      acceptedInvite.acceptanceOutcome === "reactivated_member"
    ) {
      await notifyCompanyMemberAdded({
        organizationId: acceptedInvite.organizationId,
        organizationName: organizationRow?.name ?? "this company workspace",
        memberUserId: profileResult.profile.id,
        memberDisplayName: profileResult.profile.display_name,
        memberRole: acceptedInvite.membershipRole,
        actorUserId: profileResult.profile.id,
        includeSelfNotification: true,
      });
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/team");
  revalidatePath("/dashboard");

  if (organizationRow?.slug) {
    revalidatePath(`/companies/${organizationRow.slug}`);
  }

  return {
    status: "success",
    message: "Company invite accepted.",
    redirectTo: "/profile/company?status=invite-accepted",
  };
}
