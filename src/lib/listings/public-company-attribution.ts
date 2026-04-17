import type { SupabaseClient } from "@supabase/supabase-js";

import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import type { Database, Tables } from "@/types/database";

export type PublicListingCompanyRow = Pick<
  Tables<"organizations">,
  "id" | "name" | "slug" | "logo_path" | "status"
>;

export type PublicListingAssignedAgentRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url"
>;

export type PublicListingCompanyAttribution = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
};

export type PublicListingAssignedAgentAttribution = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

export const PUBLIC_LISTING_COMPANY_RELATION_SELECT = `
  organization:organizations!listings_organization_id_fkey(
    id,
    name,
    slug,
    logo_path,
    status
  )
`;

export const PUBLIC_LISTING_ASSIGNED_AGENT_RELATION_SELECT = `
  assignedAgentProfile:profiles!listings_assigned_agent_user_id_fkey(
    id,
    display_name,
    avatar_url
  )
`;

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizePublicListingCompanyAttribution(
  supabase: SupabaseClient<Database>,
  row: PublicListingCompanyRow | null | undefined
): PublicListingCompanyAttribution | null {
  if (!row || row.status !== "active") {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: toCompanyLogoPublicUrl(supabase, row.logo_path),
  };
}

export function normalizePublicListingAssignedAgent(
  row: PublicListingAssignedAgentRow | null | undefined
): PublicListingAssignedAgentAttribution | null {
  if (!row) {
    return null;
  }

  const displayName = normalizeOptionalText(row.display_name);
  if (!displayName) {
    return null;
  }

  return {
    id: row.id,
    displayName,
    avatarUrl: normalizeOptionalText(row.avatar_url),
  };
}
