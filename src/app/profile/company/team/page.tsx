import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert, UsersRound } from "lucide-react";

import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { CompanyTeamManagement } from "@/components/company/company-team-management";
import {
  PageSection,
  PageShell,
  PageState,
  PageSummaryCard,
  PageSummaryRow,
} from "@/components/layout/page-shell";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
          <PageShell>
            <PageState
              icon={ShieldAlert}
              title="Team management access is restricted"
              description={workspaceResult.message}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
                    Back to company workspace
                  </Link>
                  <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Back to profile
                  </Link>
                </div>
              }
            />
          </PageShell>
        </MainContainer>
      );
    }

    return (
      <MainContainer size="content">
        <PageState
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
        <PageState
          icon={ShieldAlert}
          title="Team management access is restricted"
          description="Only owner or admin members can manage team membership."
        />
      </MainContainer>
    );
  }
  const activeMemberCount = workspaceResult.members.filter(
    (member) => member.member_status === "active"
  ).length;
  const pendingInviteCount = workspaceResult.pendingInvites.length;

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
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

        <PageSummaryRow>
          <PageSummaryCard
            label="Active members"
            value={new Intl.NumberFormat("en").format(activeMemberCount)}
            detail="Users with active access to this company workspace."
            tone="primary"
          />
          <PageSummaryCard
            label="Pending invites"
            value={new Intl.NumberFormat("en").format(pendingInviteCount)}
            detail="Invite tokens waiting for acceptance or expiry."
          />
          <PageSummaryCard
            label="Your governance role"
            value={viewerMembershipRole === "owner" ? "Owner" : "Admin"}
            detail="Determines which membership and invite controls you can perform."
          />
        </PageSummaryRow>

        <PageSection
          eyebrow={<Badge variant="outline">Team management</Badge>}
          title="Members and invite lifecycle"
          description="Manage workspace roles, pending invites, and member status in one governance surface."
          contentClassName="pt-4"
        >
          <CompanyTeamManagement
            organizationId={organization.id}
            viewerMembershipRole={viewerMembershipRole}
            members={workspaceResult.members}
            pendingInvites={workspaceResult.pendingInvites}
          />
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
