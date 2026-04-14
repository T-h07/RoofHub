import type { Enums, Tables } from "@/types/database";

export type OrganizationMemberRole = Enums<"organization_member_role">;
export type OrganizationMemberStatus = Enums<"organization_member_status">;
export type OrganizationInviteStatus = Enums<"organization_invite_status">;

export const ORGANIZATION_MEMBER_ROLE_VALUES: OrganizationMemberRole[] = [
  "owner",
  "admin",
  "manager",
  "agent",
];

export const ORGANIZATION_INVITABLE_ROLE_VALUES: OrganizationMemberRole[] = [
  "admin",
  "manager",
  "agent",
];

export const ORGANIZATION_MEMBER_ROLE_LABELS: Record<OrganizationMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  agent: "Agent",
};

export const ORGANIZATION_MEMBER_STATUS_LABELS: Record<OrganizationMemberStatus, string> = {
  active: "Active",
  invited: "Invited",
  inactive: "Suspended",
};

export const ORGANIZATION_INVITE_STATUS_LABELS: Record<OrganizationInviteStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  revoked: "Revoked",
  expired: "Expired",
};

export type CompanyTeamInviteMethod = "email" | "userId";

export type CompanyTeamInviteInput = {
  inviteMethod: CompanyTeamInviteMethod;
  inviteEmail: string | null;
  targetUserId: string | null;
  role: OrganizationMemberRole;
};

export type CompanyTeamInviteFieldName =
  | "inviteMethod"
  | "inviteEmail"
  | "targetUserId"
  | "role"
  | "form";

export type CompanyTeamInviteFormErrors = Partial<Record<CompanyTeamInviteFieldName, string>>;

export type CompanyTeamInviteActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: CompanyTeamInviteFormErrors;
  inviteLinkPath?: string;
};

export const COMPANY_TEAM_INVITE_IDLE_STATE: CompanyTeamInviteActionState = {
  status: "idle",
};

export type CompanyTeamMutationActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  redirectTo?: string;
};

export const COMPANY_TEAM_MUTATION_IDLE_STATE: CompanyTeamMutationActionState = {
  status: "idle",
};

export type CompanyTeamMemberWithProfile = Pick<
  Tables<"organization_members">,
  "id" | "organization_id" | "user_id" | "role" | "member_status" | "joined_at" | "created_at" | "updated_at"
> & {
  profile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
};

export type CompanyInviteWithRelations = Pick<
  Tables<"organization_member_invites">,
  | "id"
  | "organization_id"
  | "invite_email"
  | "target_user_id"
  | "invite_token"
  | "role"
  | "invite_status"
  | "expires_at"
  | "accepted_at"
  | "accepted_by_user_id"
  | "created_at"
  | "updated_at"
  | "invited_by_user_id"
> & {
  invitedByProfile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
  targetProfile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
};

export type PendingCompanyInviteForViewer = Pick<
  Tables<"organization_member_invites">,
  "id" | "organization_id" | "invite_token" | "role" | "invite_status" | "expires_at" | "created_at" | "invite_email"
> & {
  organization: Pick<Tables<"organizations">, "id" | "name" | "slug" | "status"> | null;
  invitedByProfile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
};
