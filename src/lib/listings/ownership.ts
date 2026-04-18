import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getCurrentUserCompanyContext, type CompanyMembershipContext } from "@/lib/company/context";
import type { Database, Tables } from "@/types/database";

export type ListingOwnershipMode = "individual" | "company";

type ProfileForListingOwnership = Pick<Tables<"profiles">, "id" | "provider_account_type">;

export type ProviderListingCreationContext = {
  ownershipMode: ListingOwnershipMode;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
};

type ProviderListingCreationFailureReason =
  | "company_context_unavailable"
  | "company_workspace_required"
  | "company_workspace_selection_required";

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
      company: CompanyMembershipContext | null;
    }
  | {
      ok: false;
      reason: ProviderListingCreationFailureReason;
      message: string;
      company: CompanyMembershipContext | null;
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
      company: null,
    };
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false,
      reason: "company_context_unavailable",
      message: companyContextResult.message,
      company: null,
    };
  }

  if (companyContextResult.company.workspaceState === "selection_required") {
    return {
      ok: false,
      reason: "company_workspace_selection_required",
      message: "Select an active company workspace before creating or managing company-owned listings.",
      company: companyContextResult.company,
    };
  }

  const activeMembership = companyContextResult.company.activeMembership;
  const activeOrganization = companyContextResult.company.activeOrganization;

  if (
    !activeMembership ||
    activeMembership.member_status !== "active" ||
    !activeOrganization ||
    activeOrganization.status !== "active"
  ) {
    return {
      ok: false,
      reason: "company_workspace_required",
      message:
        "Company provider mode requires an active company workspace before creating listings.",
      company: companyContextResult.company,
    };
  }

  return {
    ok: true,
    context: {
      ownershipMode: "company",
      organizationId: activeOrganization.id,
      organizationName: activeOrganization.name,
      organizationSlug: activeOrganization.slug,
    },
    company: companyContextResult.company,
  };
}
