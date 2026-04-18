import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUserProfile } from "@/lib/auth/profile";
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

type OrganizationMembershipQueryRow = Omit<CompanyMembershipSummary, "organization"> & {
  organization: Partial<CompanyWorkspaceSummary> | null;
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
  organization: OrganizationMembershipQueryRow["organization"]
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

function normalizeCompanyMembershipRows(rows: OrganizationMembershipQueryRow[]) {
  return rows.map((row) => ({
    ...row,
    invited_by_user_id: row.invited_by_user_id ?? null,
    organization: normalizeOrganizationSummary(row.organization),
  }));
}

export async function getCompanyMembershipContextForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyMembershipContext> {
  const fullQuery = await supabase
    .from("organization_members")
    .select(
      `${MEMBERSHIP_SELECT_BASE}, organization:organizations(${ORGANIZATION_PROFILE_SELECT_FULL})`
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  let selectedRows = (fullQuery.data ?? []) as OrganizationMembershipQueryRow[];
  let error = fullQuery.error;

  if (error && isMissingOrganizationProfileColumnsError(error.message)) {
    const legacyQuery = await supabase
      .from("organization_members")
      .select(
        `${MEMBERSHIP_SELECT_BASE}, organization:organizations(${ORGANIZATION_PROFILE_SELECT_LEGACY})`
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true });

    selectedRows = (legacyQuery.data ?? []) as unknown as OrganizationMembershipQueryRow[];
    error = legacyQuery.error;
  }

  if (error) {
    return {
      ok: false,
      message:
        isMissingOrganizationProfileColumnsError(error.message)
          ? "Company workspace schema is out of date. Apply the latest Supabase migrations and retry."
          : "Company workspace context could not be loaded.",
    };
  }

  const memberships = normalizeCompanyMembershipRows(
    selectedRows
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
    return companyContext;
  }

  return {
    ok: true,
    userId: profileResult.profile.id,
    profile: profileResult.profile,
    company: companyContext,
  };
}
