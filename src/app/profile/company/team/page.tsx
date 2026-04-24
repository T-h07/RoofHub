import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, UsersRound } from "lucide-react";

import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { CompanyTeamManagement } from "@/components/company/company-team-management";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { loadCompanyTeamWorkspaceDataForCurrentUser } from "@/lib/company/team-queries";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function CompanyTeamPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile/company/team"));
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (companyContextResult.ok && companyContextResult.company.workspaceState === "selection_required") {
    return (
      <MainContainer size="content" className="space-y-5">
        <CompanyWorkspaceSwitcher
          workspaceOptions={companyContextResult.company.workspaceOptions}
          activeOrganizationId={companyContextResult.company.activeOrganizationId}
          redirectTo="/profile/company/team"
          title="Choose the workspace you want to manage"
          description="Team management is always scoped to one active RoofHub company workspace. Select the workspace before editing invites or membership."
        />
      </MainContainer>
    );
  }

  const workspaceResult = await loadCompanyTeamWorkspaceDataForCurrentUser();

  if (!workspaceResult.ok) {
    if (workspaceResult.reason === "management_access_required") {
      return (
        <MainContainer size="content" className="space-y-5">
          <section className="border-border bg-card rounded-3xl border p-5 sm:p-7">
            <div className="space-y-3">
              <Badge variant="outline">Company team</Badge>
              <h1 className="type-page-title">Team management access is restricted</h1>
              <p className="type-body-muted max-w-3xl">{workspaceResult.message}</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
                  Back to company workspace
                </Link>
                <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Back to profile
                </Link>
              </div>
            </div>
          </section>

          <EmptyState
            icon={ShieldAlert}
            title="Owner or admin role required"
            description="Company team management is available only to owner and admin membership roles."
          />
        </MainContainer>
      );
    }

    return (
      <MainContainer size="content">
        <EmptyState
          icon={UsersRound}
          title="Team workspace unavailable"
          description={workspaceResult.message}
        />
      </MainContainer>
    );
  }

  const organization = workspaceResult.organization;
  const logoUrl = toCompanyLogoPublicUrl(supabase, organization.logo_path);
  const viewerMembershipRole =
    workspaceResult.viewerMembership.role === "owner" || workspaceResult.viewerMembership.role === "admin"
      ? workspaceResult.viewerMembership.role
      : null;

  if (!viewerMembershipRole) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={ShieldAlert}
          title="Team management access is restricted"
          description="Only owner or admin members can manage team membership."
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <CompanyIdentityHeader
        company={{
          name: organization.name,
          slug: organization.slug,
          description: organization.description,
          logoUrl,
          contactEmail: organization.contact_email,
          contactPhone: organization.contact_phone,
          websiteUrl: organization.website_url,
          coverageArea: organization.coverage_area,
        }}
        contextLabel="Company team"
        supportingLabel="Invite staff, assign workspace roles, and manage active membership from the governance workspace."
        actions={
          <>
            <Link href="/profile/company" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to workspace
            </Link>
            <Link
              href={`/companies/${organization.slug}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              View public page
            </Link>
          </>
        }
      />

      <CompanyTeamManagement
        organizationId={organization.id}
        viewerMembershipRole={viewerMembershipRole}
        members={workspaceResult.members}
        pendingInvites={workspaceResult.pendingInvites}
      />
    </MainContainer>
  );
}
