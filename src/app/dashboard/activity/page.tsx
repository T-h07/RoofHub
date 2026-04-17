import Link from "next/link";
import { Activity, ShieldAlert } from "lucide-react";

import { CompanyActivityFeed } from "@/components/company/company-activity-feed";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { loadCompanyDashboardWorkspace } from "@/lib/company/dashboard-queries";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";

export default async function DashboardActivityPage() {
  const context = await getProviderRouteContext("/dashboard/activity");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={Activity} title="Activity log unavailable" description={context.message} />
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

  if (!listingCreationContext.ok || listingCreationContext.context.ownershipMode !== "company") {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={ShieldAlert}
          title="Company activity log requires company provider mode"
          description={
            listingCreationContext.ok
              ? "Switch to a company provider workspace to view internal operational history."
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
        <EmptyState
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
        <EmptyState
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
            {workspace.isOwnerOrAdmin ? (
              <Link href="/profile/company/team" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Team
              </Link>
            ) : null}
          </>
        }
      />

      <Card className="border-border/80 bg-card/88">
        <CardHeader className="border-border/70 border-b pb-4">
          <div className="space-y-2">
            <Badge variant="outline">Activity timeline</Badge>
            <CardTitle className="text-xl">Operational history</CardTitle>
            <p className="type-body-muted">
              Persisted listing workflow, membership, invite, and company operations events for trusted
              reviewer roles.
            </p>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          {workspace.activityUnavailableMessage ? (
            <EmptyState
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
        </CardContent>
      </Card>
    </MainContainer>
  );
}
