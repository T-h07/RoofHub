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
  | "invited_by_user_id"
  | "joined_at"
  | "created_at"
  | "updated_at"
> & {
  organization: CompanyWorkspaceSummary | null;
};

type CompanyMembershipContext =
  | {
      ok: true;
      memberships: CompanyMembershipSummary[];
      activeMemberships: CompanyMembershipSummary[];
      ownerMembership: CompanyMembershipSummary | null;
      ownerOrganization: CompanyWorkspaceSummary | null;
      hasMembership: boolean;
      ownsWorkspace: boolean;
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
  organization: CompanyWorkspaceSummary | null;
};

function normalizeCompanyMembershipRows(rows: OrganizationMembershipQueryRow[]) {
  return rows.map((row) => ({
    ...row,
    organization: row.organization,
  }));
}

export async function getCompanyMembershipContextForUser(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<CompanyMembershipContext> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, organization_id, user_id, role, member_status, invited_by_user_id, joined_at, created_at, updated_at, organization:organizations(id, name, slug, description, logo_path, contact_email, contact_phone, website_url, coverage_area, status, created_at, updated_at)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false,
      message: "Company workspace context could not be loaded.",
    };
  }

  const memberships = normalizeCompanyMembershipRows(
    (data ?? []) as OrganizationMembershipQueryRow[]
  );
  const activeMemberships = memberships.filter(
    (membership) =>
      membership.member_status === "active" && membership.organization?.status === "active"
  );
  const ownerMembership =
    activeMemberships.find((membership) => membership.role === "owner") ?? null;
  const ownerOrganization = ownerMembership?.organization ?? null;

  return {
    ok: true,
    memberships,
    activeMemberships,
    ownerMembership,
    ownerOrganization,
    hasMembership: activeMemberships.length > 0,
    ownsWorkspace: Boolean(ownerMembership),
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
