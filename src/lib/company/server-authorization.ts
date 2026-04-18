import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyMembershipContext,
  CompanyMembershipSummary,
  CompanyWorkspaceSummary,
} from "@/lib/company/context";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

import {
  canAccessCompanyDashboard,
  canAccessCompanyWorkspace,
  canEditCompanyProfile,
  canManageCompanyTeam,
  canPublishCompanyListingWorkflow,
  canReviewCompanyListingWorkflow,
  canViewCompanyActivityFeed,
  canViewCompanyPendingQueue,
} from "./permissions";

export type ScopedCompanyAccessResult =
  | {
      ok: true;
      profile: Tables<"profiles">;
      company: CompanyMembershipContext;
      organization: CompanyWorkspaceSummary;
      membership: CompanyMembershipSummary;
    }
  | {
      ok: false;
      message: string;
    };

export type ScopedCompanyPermission =
  | "workspace"
  | "dashboard"
  | "team_management"
  | "company_profile_edit"
  | "pending_queue"
  | "activity_feed"
  | "workflow_review"
  | "workflow_publish";

export function getCompanyAdminClient() {
  return createAdminSupabaseClient();
}

function permissionAllowed(
  permission: ScopedCompanyPermission,
  membership: Tables<"organization_members">
) {
  switch (permission) {
    case "workspace":
      return canAccessCompanyWorkspace(membership.role, membership.member_status);
    case "dashboard":
      return canAccessCompanyDashboard(membership.role, membership.member_status);
    case "team_management":
      return canManageCompanyTeam(membership.role, membership.member_status);
    case "company_profile_edit":
      return canEditCompanyProfile(membership.role, membership.member_status);
    case "pending_queue":
      return canViewCompanyPendingQueue(membership.role, membership.member_status);
    case "activity_feed":
      return canViewCompanyActivityFeed(membership.role, membership.member_status);
    case "workflow_review":
      return canReviewCompanyListingWorkflow(membership.role, membership.member_status);
    case "workflow_publish":
      return canPublishCompanyListingWorkflow(membership.role, membership.member_status);
    default:
      return false;
  }
}

export async function requireCurrentUserScopedCompanyAccess(
  supabase: SupabaseClient<Database>,
  input?: {
    organizationId?: string | null;
    permission?: ScopedCompanyPermission;
    selectionRequiredMessage?: string;
    membershipRequiredMessage?: string;
    forbiddenMessage?: string;
  }
): Promise<ScopedCompanyAccessResult> {
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false,
      message: companyContextResult.message,
    };
  }

  const membership = input?.organizationId
    ? companyContextResult.company.activeMemberships.find(
        (candidate) => candidate.organization_id === input.organizationId
      ) ?? null
    : companyContextResult.company.activeMembership;
  const organization =
    membership?.organization ??
    (input?.organizationId
      ? companyContextResult.company.workspaceOptions.find(
          (option) => option.organization.id === input.organizationId
        )?.organization ?? null
      : companyContextResult.company.activeOrganization);

  if (!membership || !organization) {
    return {
      ok: false,
      message:
        companyContextResult.company.workspaceState === "selection_required"
          ? input?.selectionRequiredMessage ??
            "Select an active company workspace before continuing."
          : input?.membershipRequiredMessage ??
            "An active company membership is required for this workspace.",
    };
  }

  if (input?.permission && !permissionAllowed(input.permission, membership)) {
    return {
      ok: false,
      message:
        input.forbiddenMessage ??
        "You do not have permission to access this company action.",
    };
  }

  return {
    ok: true,
    profile: companyContextResult.profile,
    company: companyContextResult.company,
    organization,
    membership,
  };
}
