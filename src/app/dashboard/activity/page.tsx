import Link from "next/link";
import { Activity, ShieldAlert } from "lucide-react";

import { CompanyActivityFeed } from "@/components/company/company-activity-feed";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { loadCompanyDashboardWorkspace } from "@/lib/company/dashboard-queries";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";

export default async function DashboardActivityPage() {
  const context = await getProviderRouteContext("/dashboard/activity");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <PageState icon={Activity} title="Activity log unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return <ProviderAccessRequired />;
  }

  const listingCreationContext = await resolveProviderListingCreationContext(
    context.supabase,
    context.profile
  );

  if (
    !listingCreationContext.ok &&
    listingCreationContext.reason === "company_workspace_selection_required" &&
    listingCreationContext.company
  ) {
    return (
      <MainContainer size="content" className="space-y-5">
        <CompanyWorkspaceSwitcher
          workspaceOptions={listingCreationContext.company.workspaceOptions}
          activeOrganizationId={listingCreationContext.company.activeOrganizationId}
          redirectTo="/dashboard/activity"
          title="Choose the company workspace for activity history"
          description="Activity history is company-scoped. Select the active RoofHub workspace before opening the internal operational timeline."
          submitLabel="Open selected activity log"
        />
      </MainContainer>
    );
  }

  if (!listingCreationContext.ok || listingCreationContext.context.ownershipMode !== "company") {
    return (
      <MainContainer size="content">
        <PageState
          icon={ShieldAlert}
          title="Company activity log requires an active company workspace"
          description={
            listingCreationContext.ok
              ? "Switch to an active company workspace to view internal operational history."
              : listingCreationContext.message
          }
          action={
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Back to dashboard
            </Link>
          }
        />
      </MainContainer>
    );
  }

  const dashboardWorkspaceResult = await loadCompanyDashboardWorkspace(context.supabase, {
    pendingQueueLimit: 0,
    activityLimit: 96,
  });

  if (!dashboardWorkspaceResult.ok) {
    return (
      <MainContainer size="content">
        <PageState
          icon={Activity}
          title="Activity log unavailable"
          description={dashboardWorkspaceResult.message}
        />
      </MainContainer>
    );
  }

  const workspace = dashboardWorkspaceResult.workspace;
  const logoUrl = toCompanyLogoPublicUrl(context.supabase, workspace.organization.logo_path);

  if (!workspace.canViewActivityFeed) {
    return (
      <MainContainer size="content">
        <PageState
          icon={ShieldAlert}
          title="Activity visibility is role-limited"
          description={
            workspace.activityAccessMessage ??
            "Owner, admin, or manager role is required to view company activity history."
          }
          action={
            <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
              Back to dashboard
            </Link>
          }
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <CompanyIdentityHeader
          company={{
            name: workspace.organization.name,
            slug: workspace.organization.slug,
            description: workspace.organization.description,
            logoUrl,
            contactEmail: workspace.organization.contact_email,
            contactPhone: workspace.organization.contact_phone,
            websiteUrl: workspace.organization.website_url,
            coverageArea: workspace.organization.coverage_area,
          }}
          contextLabel="Company activity log"
          supportingLabel="Trace workflow decisions, publishing changes, and membership operations from one internal RoofHub timeline."
          listingCount={workspace.overview.publishedCount}
          actions={
            <>
              <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Dashboard
              </Link>
              <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Listings
              </Link>
              <Link href="/messages" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Inbox
              </Link>
            </>
          }
        />

        <PageSection
          eyebrow={<Badge variant="outline">Activity timeline</Badge>}
          title="Operational history"
          description="Persisted listing workflow, membership, invite, and company operations events for trusted reviewer roles."
        >
          {workspace.activityUnavailableMessage ? (
            <PageState
              icon={Activity}
              title="Activity log unavailable"
              description={workspace.activityUnavailableMessage}
            />
          ) : (
            <CompanyActivityFeed
              activity={workspace.activity}
              emptyTitle="No operational activity yet"
              emptyDescription="Events appear as listings move through workflow and company team actions are recorded."
              showSourceBadges
            />
          )}
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
