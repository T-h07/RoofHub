import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import {
  createAdminSupabaseClient,
  isMissingSupabaseAdminUrlError,
  isMissingSupabaseServiceRoleError,
} from "@/lib/supabase/admin";
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

const ROLE_PRIORITY: Record<Tables<"organization_members">["role"], number> = {
  owner: 1,
  admin: 2,
  manager: 3,
  agent: 4,
};

function sortMembershipByRolePriority(left: CompanyMembershipSummary, right: CompanyMembershipSummary) {
  const leftPriority = ROLE_PRIORITY[left.role] ?? 99;
  const rightPriority = ROLE_PRIORITY[right.role] ?? 99;
  return leftPriority - rightPriority;
}

type CompanyMembershipContext =
  | {
      ok: true;
      memberships: CompanyMembershipSummary[];
      activeMemberships: CompanyMembershipSummary[];
      primaryMembership: CompanyMembershipSummary | null;
      primaryOrganization: CompanyWorkspaceSummary | null;
      ownerMembership: CompanyMembershipSummary | null;
      ownerOrganization: CompanyWorkspaceSummary | null;
      managementMembership: CompanyMembershipSummary | null;
      managementOrganization: CompanyWorkspaceSummary | null;
      hasMembership: boolean;
      ownsWorkspace: boolean;
      activeRole: Tables<"organization_members">["role"] | null;
      canManageTeam: boolean;
    }
  | {
      ok: false;
      message: string;
    };

type CurrentUserCompanyContextResult =
  | {
      ok: true;
      userId: string;
      profile: Tables<"profiles">;
      company: Extract<CompanyMembershipContext, { ok: true }>;
    }
  | {
      ok: false;
      message: string;
    };

type OrganizationMembershipQueryRow = Omit<CompanyMembershipSummary, "organization">;
type OrganizationProfileQueryRow = Partial<CompanyWorkspaceSummary>;

type QueryErrorLike = {
  message?: string;
};

const ORGANIZATION_PROFILE_SELECT_FULL =
  "id, name, slug, description, logo_path, contact_email, contact_phone, website_url, coverage_area, status, created_at, updated_at";
const ORGANIZATION_PROFILE_SELECT_LEGACY =
  "id, name, slug, description, logo_path, status, created_at, updated_at";
const MEMBERSHIP_SELECT_BASE =
  "id, organization_id, user_id, role, member_status, joined_at, created_at, updated_at";

function isMissingOrganizationProfileColumnsError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_email") ||
      normalized.includes("contact_phone") ||
      normalized.includes("website_url") ||
      normalized.includes("coverage_area"))
  );
}

function normalizeOrganizationSummary(
  organization: OrganizationProfileQueryRow | null
): CompanyWorkspaceSummary | null {
  if (!organization) {
    return null;
  }

  if (
    !organization.id ||
    !organization.name ||
    !organization.slug ||
    !organization.status ||
    !organization.created_at ||
    !organization.updated_at
  ) {
    return null;
  }

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    description: organization.description ?? null,
    logo_path: organization.logo_path ?? null,
    contact_email: organization.contact_email ?? null,
    contact_phone: organization.contact_phone ?? null,
    website_url: organization.website_url ?? null,
    coverage_area: organization.coverage_area ?? null,
    status: organization.status,
    created_at: organization.created_at,
    updated_at: organization.updated_at,
  };
}

function normalizeCompanyMembershipRows(
  rows: OrganizationMembershipQueryRow[],
  organizationsById: Map<string, CompanyWorkspaceSummary>
) {
  return rows.map((row) => ({
    ...row,
    invited_by_user_id: row.invited_by_user_id ?? null,
    organization: organizationsById.get(row.organization_id) ?? null,
  }));
}

function buildEmptyCompanyMembershipContext(): Extract<CompanyMembershipContext, { ok: true }> {
  return {
    ok: true,
    memberships: [],
    activeMemberships: [],
    primaryMembership: null,
    primaryOrganization: null,
    ownerMembership: null,
    ownerOrganization: null,
    managementMembership: null,
    managementOrganization: null,
    hasMembership: false,
    ownsWorkspace: false,
    activeRole: null,
    canManageTeam: false,
  };
}

function isRecoverableMembershipQueryError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("policy") ||
    normalized.includes("infinite recursion")
  );
}

async function canUseAdminFallbackForUser(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id === userId;
}

async function loadMembershipRowsWithAdminFallback(
  userId: string
): Promise<
  | { ok: true; rows: OrganizationMembershipQueryRow[] }
  | { ok: false }
> {
  try {
    const adminSupabase = createAdminSupabaseClient();
    const membershipQuery = await adminSupabase
      .from("organization_members")
      .select(`${MEMBERSHIP_SELECT_BASE}, invited_by_user_id`)
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    if (membershipQuery.error) {
      return { ok: false };
    }

    return {
      ok: true,
      rows: (membershipQuery.data ?? []) as OrganizationMembershipQueryRow[],
    };
  } catch (error) {
    if (isMissingSupabaseServiceRoleError(error) || isMissingSupabaseAdminUrlError(error)) {
      return { ok: false };
    }

    return { ok: false };
  }
}

async function loadOrganizationRowsWithAdminFallback(
  organizationIds: string[],
  selectClause: string
): Promise<
  | { ok: true; rows: OrganizationProfileQueryRow[] }
  | { ok: false; error: QueryErrorLike | null }
> {
  if (organizationIds.length === 0) {
    return {
      ok: true,
      rows: [],
    };
  }

  try {
    const adminSupabase = createAdminSupabaseClient();
    const query = await adminSupabase
      .from("organizations")
      .select(selectClause)
      .in("id", organizationIds);

    if (query.error) {
      return {
        ok: false,
        error: query.error,
      };
    }

    return {
      ok: true,
      rows: (query.data ?? []) as OrganizationProfileQueryRow[],
    };
  } catch (error) {
    if (isMissingSupabaseServiceRoleError(error) || isMissingSupabaseAdminUrlError(error)) {
      return {
        ok: false,
        error: null,
      };
    }

    return {
      ok: false,
      error: null,
    };
  }
}

export async function getCompanyMembershipContextForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyMembershipContext> {
  const directMembershipQuery = await supabase
    .from("organization_members")
    .select(`${MEMBERSHIP_SELECT_BASE}, invited_by_user_id`)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  let selectedRows = (directMembershipQuery.data ?? []) as OrganizationMembershipQueryRow[];

  if (directMembershipQuery.error) {
    const canUseAdminFallback =
      isRecoverableMembershipQueryError(directMembershipQuery.error.message) &&
      (await canUseAdminFallbackForUser(supabase, userId));

    if (canUseAdminFallback) {
      const adminFallback = await loadMembershipRowsWithAdminFallback(userId);
      if (adminFallback.ok) {
        selectedRows = adminFallback.rows;
      } else {
        return {
          ok: false,
          message: "Company workspace context could not be loaded.",
        };
      }
    } else {
      return {
        ok: false,
        message: "Company workspace context could not be loaded.",
      };
    }
  }

  const organizationIds = [...new Set(selectedRows.map((row) => row.organization_id))];
  let organizationRows: OrganizationProfileQueryRow[] = [];
  let organizationError: QueryErrorLike | null = null;

  if (organizationIds.length > 0) {
    const fullQuery = await supabase
      .from("organizations")
      .select(ORGANIZATION_PROFILE_SELECT_FULL)
      .in("id", organizationIds);

    organizationRows = (fullQuery.data ?? []) as OrganizationProfileQueryRow[];
    organizationError = fullQuery.error;
  }

  if (
    organizationError &&
    isMissingOrganizationProfileColumnsError(organizationError.message)
  ) {
    const legacyQuery = await supabase
      .from("organizations")
      .select(ORGANIZATION_PROFILE_SELECT_LEGACY)
      .in("id", organizationIds);

    organizationRows = (legacyQuery.data ?? []) as OrganizationProfileQueryRow[];
    organizationError = legacyQuery.error;
  }

  if (organizationError) {
    const canUseAdminFallback = await canUseAdminFallbackForUser(supabase, userId);

    if (canUseAdminFallback) {
      const fullFallback = await loadOrganizationRowsWithAdminFallback(
        organizationIds,
        ORGANIZATION_PROFILE_SELECT_FULL
      );

      if (fullFallback.ok) {
        organizationRows = fullFallback.rows;
        organizationError = null;
      } else if (
        isMissingOrganizationProfileColumnsError(fullFallback.error?.message)
      ) {
        const legacyFallback = await loadOrganizationRowsWithAdminFallback(
          organizationIds,
          ORGANIZATION_PROFILE_SELECT_LEGACY
        );

        if (legacyFallback.ok) {
          organizationRows = legacyFallback.rows;
          organizationError = null;
        } else {
          organizationError = legacyFallback.error;
        }
      }
    }
  }

  if (organizationError) {
    return {
      ok: false,
      message:
        isMissingOrganizationProfileColumnsError(organizationError.message)
          ? "Company workspace schema is out of date. Apply the latest Supabase migrations and retry."
          : "Company workspace context could not be loaded.",
    };
  }

  const organizationsById = new Map<string, CompanyWorkspaceSummary>();
  for (const organizationRow of organizationRows) {
    const organization = normalizeOrganizationSummary(organizationRow);
    if (organization) {
      organizationsById.set(organization.id, organization);
    }
  }

  const memberships = normalizeCompanyMembershipRows(
    selectedRows,
    organizationsById
  );
  const activeMemberships = memberships.filter(
    (membership) =>
      membership.member_status === "active" && membership.organization?.status === "active"
  );
  const sortedActiveMemberships = [...activeMemberships].sort(sortMembershipByRolePriority);
  const primaryMembership = sortedActiveMemberships[0] ?? null;
  const primaryOrganization = primaryMembership?.organization ?? null;
  const ownerMembership =
    activeMemberships.find((membership) => membership.role === "owner") ?? null;
  const ownerOrganization = ownerMembership?.organization ?? null;
  const managementMembership =
    activeMemberships.find(
      (membership) => membership.role === "owner" || membership.role === "admin"
    ) ?? null;
  const managementOrganization = managementMembership?.organization ?? null;

  return {
    ok: true,
    memberships,
    activeMemberships,
    primaryMembership,
    primaryOrganization,
    ownerMembership,
    ownerOrganization,
    managementMembership,
    managementOrganization,
    hasMembership: activeMemberships.length > 0,
    ownsWorkspace: Boolean(ownerMembership),
    activeRole: primaryMembership?.role ?? null,
    canManageTeam: Boolean(managementMembership),
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

  const companyContext = await getCompanyMembershipContextForUser(
    supabase,
    profileResult.profile.id
  );

  if (!companyContext.ok) {
    if (profileResult.profile.provider_account_type !== "company") {
      return {
        ok: true,
        userId: profileResult.profile.id,
        profile: profileResult.profile,
        company: buildEmptyCompanyMembershipContext(),
      };
    }

    return companyContext;
  }

  return {
    ok: true,
    userId: profileResult.profile.id,
    profile: profileResult.profile,
    company: companyContext,
  };
}
