import Link from "next/link";
import { LayoutDashboard, PlusSquare, Rows3, TriangleAlert } from "lucide-react";

import { CompanyDashboardWorkspace } from "@/components/company/company-dashboard-workspace";
import { ProviderManagedListingsList } from "@/components/dashboard/provider-managed-listings-list";
import { ProviderOverviewMetrics } from "@/components/dashboard/provider-overview-metrics";
import { ProviderUnreadLeadsPlaceholder } from "@/components/dashboard/provider-unread-leads-placeholder";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadCompanyDashboardWorkspace } from "@/lib/company/dashboard-queries";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import {
  loadProviderListingOverviewMetrics,
  loadProviderManagedListings,
} from "@/lib/listings/provider-dashboard/queries";

export default async function DashboardPage() {
  const context = await getProviderRouteContext("/dashboard");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={LayoutDashboard} title="Dashboard unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return (
      <ProviderAccessRequired
        title="Provider dashboard requires provider role"
        description="Switch your profile role to provider to manage listing lifecycle states."
      />
    );
  }

  const listingCreationContext = await resolveProviderListingCreationContext(
    context.supabase,
    context.profile
  );

  if (
    !listingCreationContext.ok &&
    context.profile.provider_account_type === "company"
  ) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={LayoutDashboard}
          title="Company dashboard unavailable"
          description={listingCreationContext.message}
          action={
            <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
              Open company workspace
            </Link>
          }
        />
      </MainContainer>
    );
  }

  if (
    listingCreationContext.ok &&
    listingCreationContext.context.ownershipMode === "company"
  ) {
    const dashboardResult = await loadCompanyDashboardWorkspace(context.supabase);

    if (!dashboardResult.ok) {
      return (
        <MainContainer size="content">
          <EmptyState
            icon={LayoutDashboard}
            title="Company dashboard unavailable"
            description={dashboardResult.message}
            action={
              <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
                Open company workspace
              </Link>
            }
          />
        </MainContainer>
      );
    }

    const logoUrl = toCompanyLogoPublicUrl(
      context.supabase,
      dashboardResult.workspace.organization.logo_path
    );

    return (
      <MainContainer size="wide" className="space-y-5">
        <CompanyDashboardWorkspace workspace={dashboardResult.workspace} logoUrl={logoUrl} />
      </MainContainer>
    );
  }

  const organizationId =
    listingCreationContext.ok && listingCreationContext.context.ownershipMode === "company"
      ? listingCreationContext.context.organizationId
      : null;

  const [overviewResult, recentListingsResult] = await Promise.all([
    loadProviderListingOverviewMetrics(context.supabase, {
      userId: context.profile.id,
      organizationId,
    }),
    loadProviderManagedListings(context.supabase, {
      userId: context.profile.id,
      organizationId,
      statusFilter: "all",
      limit: 6,
    }),
  ]);

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Provider workspace</Badge>
        <h1 className="type-page-title max-w-4xl">Control your property inventory and lifecycle states.</h1>
        <p className="type-body-muted max-w-3xl">
          Review listing volume, manage status transitions, and continue editing listings without leaving the
          provider dashboard.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
            <PlusSquare className="size-4" aria-hidden="true" />
            New listing draft
          </Link>
          <Link href="/dashboard/listings" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Rows3 className="size-4" aria-hidden="true" />
            My listings
          </Link>
          <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Company workspace
          </Link>
        </div>
      </section>

      {!overviewResult.ok ? (
        <EmptyState
          icon={TriangleAlert}
          title="Overview metrics unavailable"
          description={overviewResult.message}
        />
      ) : (
        <ProviderOverviewMetrics metrics={overviewResult.metrics} />
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="type-section-title">Recent listings</h2>
          <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Open full list
          </Link>
        </div>

        {!recentListingsResult.ok ? (
          <EmptyState icon={Rows3} title="Recent listings unavailable" description={recentListingsResult.message} />
        ) : recentListingsResult.listings.length === 0 ? (
          <EmptyState
            icon={PlusSquare}
            title="No listings yet"
            description="Create your first draft to start managing listing statuses from this dashboard."
            action={
              <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
                Start listing wizard
              </Link>
            }
          />
        ) : (
          <ProviderManagedListingsList listings={recentListingsResult.listings} />
        )}
      </section>

      <ProviderUnreadLeadsPlaceholder />
    </MainContainer>
  );
}
