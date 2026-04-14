import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/types/database";

import { getCurrentUserCompanyContext } from "./context";
import type {
  CompanyInviteWithRelations,
  CompanyTeamMemberWithProfile,
  PendingCompanyInviteForViewer,
} from "./team-types";

type PendingInviteOrganizationSummary = Pick<Tables<"organizations">, "id" | "name" | "slug" | "status">;

type RawCompanyTeamMemberRow = Omit<CompanyTeamMemberWithProfile, "profile"> & {
  profile: CompanyTeamMemberWithProfile["profile"];
};

type RawCompanyInviteRow = Omit<CompanyInviteWithRelations, "invitedByProfile" | "targetProfile"> & {
  invitedByProfile: CompanyInviteWithRelations["invitedByProfile"];
  targetProfile: CompanyInviteWithRelations["targetProfile"];
};

type RawPendingInviteRow = Omit<PendingCompanyInviteForViewer, "invitedByProfile" | "organization"> & {
  invitedByProfile: PendingCompanyInviteForViewer["invitedByProfile"];
  organization: PendingInviteOrganizationSummary | null;
};

type RawCompanyInviteDetailRow = RawCompanyInviteRow & {
  organization: PendingInviteOrganizationSummary | null;
};

function normalizeTeamMembers(rows: RawCompanyTeamMemberRow[]) {
  return rows.map((row) => ({
    ...row,
    profile: row.profile,
  }));
}

function normalizeTeamInvites(rows: RawCompanyInviteRow[]) {
  return rows.map((row) => ({
    ...row,
    invitedByProfile: row.invitedByProfile,
    targetProfile: row.targetProfile,
  }));
}

function normalizePendingInvites(rows: RawPendingInviteRow[]) {
  return rows.map((row) => ({
    ...row,
    organization: row.organization,
    invitedByProfile: row.invitedByProfile,
  }));
}

export async function loadCompanyTeamWorkspaceDataForCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false as const,
      reason: "context_unavailable" as const,
      message: companyContextResult.message,
    };
  }

  const managementMembership = companyContextResult.company.managementMembership;
  if (!managementMembership?.organization) {
    return {
      ok: false as const,
      reason: "management_access_required" as const,
      message: "Only owner or admin members can access team management.",
      profile: companyContextResult.profile,
      company: companyContextResult.company,
    };
  }

  const organization = managementMembership.organization;

  const [{ data: memberRows, error: membersError }, { data: inviteRows, error: invitesError }] =
    await Promise.all([
      supabase
        .from("organization_members")
        .select(
          "id, organization_id, user_id, role, member_status, joined_at, created_at, updated_at, profile:profiles!organization_members_user_id_fkey(id, display_name, avatar_url)"
        )
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("organization_member_invites")
        .select(
          "id, organization_id, invite_email, target_user_id, invite_token, role, invite_status, expires_at, accepted_at, accepted_by_user_id, created_at, updated_at, invited_by_user_id, invitedByProfile:profiles!organization_member_invites_invited_by_user_id_fkey(id, display_name, avatar_url), targetProfile:profiles!organization_member_invites_target_user_id_fkey(id, display_name, avatar_url)"
        )
        .eq("organization_id", organization.id)
        .eq("invite_status", "pending")
        .order("created_at", { ascending: false }),
    ]);

  if (membersError || invitesError) {
    return {
      ok: false as const,
      reason: "query_failed" as const,
      message: "Team data could not be loaded right now.",
      profile: companyContextResult.profile,
      company: companyContextResult.company,
    };
  }

  const members = normalizeTeamMembers((memberRows ?? []) as RawCompanyTeamMemberRow[]);
  const pendingInvites = normalizeTeamInvites((inviteRows ?? []) as RawCompanyInviteRow[]);

  return {
    ok: true as const,
    profile: companyContextResult.profile,
    company: companyContextResult.company,
    organization,
    viewerMembership: managementMembership,
    members,
    pendingInvites,
  };
}

export async function loadPendingCompanyInvitesForCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false as const,
      message: companyContextResult.message,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const normalizedEmail = user?.email?.trim().toLowerCase() ?? null;

  const [{ data: byUserIdRows, error: byUserIdError }, byEmailResult] = await Promise.all([
    supabase
      .from("organization_member_invites")
      .select(
        "id, organization_id, invite_token, role, invite_status, expires_at, created_at, invite_email, organization:organizations(id, name, slug, status), invitedByProfile:profiles!organization_member_invites_invited_by_user_id_fkey(id, display_name, avatar_url)"
      )
      .eq("invite_status", "pending")
      .eq("target_user_id", companyContextResult.profile.id)
      .order("created_at", { ascending: false }),
    normalizedEmail
      ? supabase
          .from("organization_member_invites")
          .select(
            "id, organization_id, invite_token, role, invite_status, expires_at, created_at, invite_email, organization:organizations(id, name, slug, status), invitedByProfile:profiles!organization_member_invites_invited_by_user_id_fkey(id, display_name, avatar_url)"
          )
          .eq("invite_status", "pending")
          .is("target_user_id", null)
          .eq("invite_email", normalizedEmail)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const byEmailRows = byEmailResult.data ?? [];
  const byEmailError = byEmailResult.error;

  if (byUserIdError || byEmailError) {
    return {
      ok: false as const,
      message: "Pending invite status is currently unavailable.",
      profile: companyContextResult.profile,
      company: companyContextResult.company,
    };
  }

  const deduped = new Map<string, RawPendingInviteRow>();
  ([...(byUserIdRows ?? []), ...((byEmailRows ?? []) as RawPendingInviteRow[])] as RawPendingInviteRow[])
    .forEach((row) => {
      deduped.set(row.id, row);
    });

  const pendingInvites = normalizePendingInvites([...deduped.values()]).sort((left, right) =>
    left.created_at < right.created_at ? 1 : -1
  );

  return {
    ok: true as const,
    profile: companyContextResult.profile,
    company: companyContextResult.company,
    pendingInvites,
  };
}

export async function loadCompanyInviteByTokenForCurrentUser(inviteToken: string) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false as const,
      reason: "auth_required" as const,
      message: "Sign in to review this company invite.",
    };
  }

  const { data, error } = await supabase
    .from("organization_member_invites")
    .select(
      "id, organization_id, invite_email, target_user_id, invite_token, role, invite_status, expires_at, accepted_at, accepted_by_user_id, created_at, updated_at, invited_by_user_id, organization:organizations(id, name, slug, status), invitedByProfile:profiles!organization_member_invites_invited_by_user_id_fkey(id, display_name, avatar_url), targetProfile:profiles!organization_member_invites_target_user_id_fkey(id, display_name, avatar_url)"
    )
    .eq("invite_token", inviteToken)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      reason: "query_failed" as const,
      message: "Invite details are unavailable right now.",
    };
  }

  if (!data) {
    return {
      ok: false as const,
      reason: "not_found" as const,
      message: "Invite not found or no longer accessible from this account.",
    };
  }

  return {
    ok: true as const,
    invite: data as RawCompanyInviteDetailRow,
  };
}
