import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCompanyMembershipContextForUser } from "@/lib/company/context";
import type { Database, Tables } from "@/types/database";

export type ListingOwnershipMode = "individual" | "company";

type ProfileForListingOwnership = Pick<Tables<"profiles">, "id" | "provider_account_type">;

export type ProviderListingCreationContext = {
  ownershipMode: ListingOwnershipMode;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
};

export function getListingOwnershipMode(input: {
  organization_id: string | null;
}): ListingOwnershipMode {
  return input.organization_id ? "company" : "individual";
}

export function isCompanyOwnedListing(input: {
  organization_id: string | null;
}) {
  return getListingOwnershipMode(input) === "company";
}

export async function resolveProviderListingCreationContext(
  supabase: SupabaseClient<Database>,
  profile: ProfileForListingOwnership
): Promise<
  | {
      ok: true;
      context: ProviderListingCreationContext;
    }
  | {
      ok: false;
      message: string;
    }
> {
  if (profile.provider_account_type !== "company") {
    return {
      ok: true,
      context: {
        ownershipMode: "individual",
        organizationId: null,
        organizationName: null,
        organizationSlug: null,
      },
    };
  }

  const companyContextResult = await getCompanyMembershipContextForUser(supabase, profile.id);

  if (!companyContextResult.ok) {
    return {
      ok: false,
      message: companyContextResult.message,
    };
  }

  const primaryMembership = companyContextResult.primaryMembership;
  const primaryOrganization = companyContextResult.primaryOrganization;

  if (
    !primaryMembership ||
    primaryMembership.member_status !== "active" ||
    !primaryOrganization ||
    primaryOrganization.status !== "active"
  ) {
    return {
      ok: false,
      message:
        "Company provider mode requires an active company membership before creating listings.",
    };
  }

  return {
    ok: true,
    context: {
      ownershipMode: "company",
      organizationId: primaryOrganization.id,
      organizationName: primaryOrganization.name,
      organizationSlug: primaryOrganization.slug,
    },
  };
}
