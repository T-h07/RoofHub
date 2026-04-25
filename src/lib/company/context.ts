import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { canEditCompanyProfile, canManageCompanyTeam } from "@/lib/company/permissions";
import {
  createSchemaDriftMessage,
  isSupabaseSchemaDriftError,
  logSupabaseSchemaDrift,
} from "@/lib/supabase/schema-drift";
import type { Database, Tables } from "@/types/database";

export type CompanyWorkspaceSummary = Pick<
  Tables<"organizations">,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "logo_path"
  | "contact_email"
  | "contact_phone"
  | "website_url"
  | "coverage_area"
  | "status"
  | "created_at"
  | "updated_at"
>;

export type CompanyMembershipSummary = Pick<
  Tables<"organization_members">,
  | "id"
  | "organization_id"
  | "user_id"
  | "role"
  | "member_status"
  | "joined_at"
  | "created_at"
  | "updated_at"
> & {
  invited_by_user_id: string | null;
  organization: CompanyWorkspaceSummary | null;
};

export type CompanyWorkspaceOption = {
  organization: CompanyWorkspaceSummary;
  membership: CompanyMembershipSummary;
  isActive: boolean;
  isOwner: boolean;
  canManageTeam: boolean;
  canEditProfile: boolean;
};

export type CompanyWorkspaceState = "no_membership" | "selection_required" | "resolved";

export type CompanyMembershipContext = {
  ok: true;
  memberships: CompanyMembershipSummary[];
  activeMemberships: CompanyMembershipSummary[];
  workspaceOptions: CompanyWorkspaceOption[];
  workspaceState: CompanyWorkspaceState;
  activeSelectionSource: "profile" | "single_membership" | null;
  activeOrganizationId: string | null;
  activeOrganization: CompanyWorkspaceSummary | null;
  activeMembership: CompanyMembershipSummary | null;
  hasMembership: boolean;
  hasOwnedWorkspace: boolean;
  hasResolvedWorkspace: boolean;
  activeRole: Tables<"organization_members">["role"] | null;
  canManageTeam: boolean;
  canEditProfile: boolean;
};

export type CurrentUserCompanyContextResult =
  | {
      ok: true;
      userId: string;
      profile: Tables<"profiles">;
      company: CompanyMembershipContext;
    }
  | {
      ok: false;
      message: string;
    };

type OrganizationMembershipQueryRow = Omit<CompanyMembershipSummary, "organization">;
type OrganizationProfileQueryRow = CompanyWorkspaceSummary;

const MEMBERSHIP_SELECT =
  "id, organization_id, user_id, role, member_status, joined_at, created_at, updated_at, invited_by_user_id";
const ORGANIZATION_SELECT =
  "id, name, slug, description, logo_path, contact_email, contact_phone, website_url, coverage_area, status, created_at, updated_at";

const ROLE_PRIORITY: Record<Tables<"organization_members">["role"], number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  agent: 4,
};

function sortMemberships(left: CompanyMembershipSummary, right: CompanyMembershipSummary) {
  const roleDelta = (ROLE_PRIORITY[left.role] ?? 99) - (ROLE_PRIORITY[right.role] ?? 99);
  if (roleDelta !== 0) {
    return roleDelta;
  }

  return (
    left.organization?.name.localeCompare(right.organization?.name ?? "", undefined, {
      sensitivity: "base",
    }) ?? 0
  );
}

function buildEmptyCompanyMembershipContext(): CompanyMembershipContext {
  return {
    ok: true,
    memberships: [],
    activeMemberships: [],
    workspaceOptions: [],
    workspaceState: "no_membership",
    activeSelectionSource: null,
    activeOrganizationId: null,
    activeOrganization: null,
    activeMembership: null,
    hasMembership: false,
    hasOwnedWorkspace: false,
    hasResolvedWorkspace: false,
    activeRole: null,
    canManageTeam: false,
    canEditProfile: false,
  };
}

async function loadResolvedCompanyMembershipContext(
  supabase: SupabaseClient<Database>,
  profile: Tables<"profiles">
): Promise<CompanyMembershipContext | { ok: false; message: string }> {
  const membershipQuery = await supabase
    .from("organization_members")
    .select(MEMBERSHIP_SELECT)
    .eq("user_id", profile.id)
    .order("created_at", { ascending: true });

  if (membershipQuery.error) {
    if (
      isSupabaseSchemaDriftError(membershipQuery.error, ["organization_members", "member_status"])
    ) {
      logSupabaseSchemaDrift("company_context_memberships", membershipQuery.error, {
        user_id: profile.id,
      });
      return {
        ok: false,
        message: createSchemaDriftMessage("Company workspace"),
      };
    }

    return {
      ok: false,
      message: "Company workspace context could not be loaded.",
    };
  }

  const membershipRows = (membershipQuery.data ?? []) as OrganizationMembershipQueryRow[];
  const organizationIds = [...new Set(membershipRows.map((row) => row.organization_id))];

  let organizationRows: OrganizationProfileQueryRow[] = [];
  if (organizationIds.length > 0) {
    const organizationQuery = await supabase
      .from("organizations")
      .select(ORGANIZATION_SELECT)
      .in("id", organizationIds);

    if (organizationQuery.error) {
      if (
        isSupabaseSchemaDriftError(organizationQuery.error, [
          "organizations",
          "contact_email",
          "contact_phone",
          "website_url",
          "coverage_area",
        ])
      ) {
        logSupabaseSchemaDrift("company_context_organizations", organizationQuery.error, {
          user_id: profile.id,
          organization_ids_count: organizationIds.length,
        });
        return {
          ok: false,
          message: createSchemaDriftMessage("Company workspace"),
        };
      }

      return {
        ok: false,
        message: "Company workspace context could not be loaded.",
      };
    }

    organizationRows = (organizationQuery.data ?? []) as OrganizationProfileQueryRow[];
  }

  const organizationsById = new Map<string, CompanyWorkspaceSummary>(
    organizationRows.map((organization) => [organization.id, organization])
  );

  const memberships = membershipRows.map((row) => ({
    ...row,
    invited_by_user_id: row.invited_by_user_id ?? null,
    organization: organizationsById.get(row.organization_id) ?? null,
  }));

  const activeMemberships = memberships
    .filter(
      (membership) =>
        membership.member_status === "active" && membership.organization?.status === "active"
    )
    .sort(sortMemberships);

  if (activeMemberships.length === 0) {
    return buildEmptyCompanyMembershipContext();
  }

  let activeMembership =
    activeMemberships.find(
      (membership) => membership.organization_id === profile.active_organization_id
    ) ?? null;
  let activeSelectionSource: CompanyMembershipContext["activeSelectionSource"] = activeMembership
    ? "profile"
    : null;

  if (!activeMembership && activeMemberships.length === 1) {
    activeMembership = activeMemberships[0] ?? null;
    activeSelectionSource = activeMembership ? "single_membership" : null;
  }

  const workspaceOptions = activeMemberships
    .filter(
      (
        membership
      ): membership is CompanyMembershipSummary & { organization: CompanyWorkspaceSummary } =>
        membership.organization !== null
    )
    .map((membership) => ({
      organization: membership.organization,
      membership,
      isActive: membership.organization_id === activeMembership?.organization_id,
      isOwner: membership.role === "owner",
      canManageTeam: canManageCompanyTeam(membership.role, membership.member_status),
      canEditProfile: canEditCompanyProfile(membership.role, membership.member_status),
    }));

  return {
    ok: true,
    memberships,
    activeMemberships,
    workspaceOptions,
    workspaceState: activeMembership ? "resolved" : "selection_required",
    activeSelectionSource,
    activeOrganizationId: activeMembership?.organization_id ?? null,
    activeOrganization: activeMembership?.organization ?? null,
    activeMembership,
    hasMembership: true,
    hasOwnedWorkspace: activeMemberships.some((membership) => membership.role === "owner"),
    hasResolvedWorkspace: Boolean(activeMembership),
    activeRole: activeMembership?.role ?? null,
    canManageTeam: activeMembership
      ? canManageCompanyTeam(activeMembership.role, activeMembership.member_status)
      : false,
    canEditProfile: activeMembership
      ? canEditCompanyProfile(activeMembership.role, activeMembership.member_status)
      : false,
  };
}

export async function getCurrentUserCompanyContext(
  supabase: SupabaseClient<Database>
): Promise<CurrentUserCompanyContextResult> {
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  const companyContext = await loadResolvedCompanyMembershipContext(
    supabase,
    profileResult.profile
  );

  if (!companyContext.ok) {
    return companyContext;
  }

  return {
    ok: true,
    userId: profileResult.profile.id,
    profile: profileResult.profile,
    company: companyContext,
  };
}
