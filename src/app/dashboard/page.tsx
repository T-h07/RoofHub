import Link from "next/link";
import { LayoutDashboard, PlusSquare, Rows3, TriangleAlert } from "lucide-react";

import { CompanyDashboardWorkspace } from "@/components/company/company-dashboard-workspace";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { ProviderInventoryMap } from "@/components/dashboard/provider-inventory-map";
import { ProviderManagedListingsList } from "@/components/dashboard/provider-managed-listings-list";
import { ProviderOverviewMetrics } from "@/components/dashboard/provider-overview-metrics";
import { ProviderUnreadLeadsPlaceholder } from "@/components/dashboard/provider-unread-leads-placeholder";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadCompanyDashboardWorkspace } from "@/lib/company/dashboard-queries";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";
import { getMapStyleUrl } from "@/lib/config/map";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import {
  loadProviderInventoryMapListings,
  loadProviderListingOverviewMetrics,
  loadProviderManagedListings,
} from "@/lib/listings/provider-dashboard/queries";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";

export default async function DashboardPage() {
  const mapStyleUrl = getMapStyleUrl();
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
    listingCreationContext.ok &&
    listingCreationContext.context.ownershipMode === "company"
  ) {
    const [dashboardResult, companyInventoryMapResult] = await Promise.all([
      loadCompanyDashboardWorkspace(context.supabase),
      loadProviderInventoryMapListings(context.supabase, {
        userId: context.profile.id,
        organizationId: listingCreationContext.context.organizationId,
        scope: "organization",
        limit: 280,
      }),
    ]);

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
        <CompanyDashboardWorkspace
          workspace={dashboardResult.workspace}
          logoUrl={logoUrl}
          mapStyleUrl={mapStyleUrl}
          inventoryMapResult={companyInventoryMapResult}
        />
      </MainContainer>
    );
  }

  const organizationId =
    listingCreationContext.ok && listingCreationContext.context.ownershipMode === "company"
      ? listingCreationContext.context.organizationId
      : null;

  const [overviewResult, recentListingsResult, inventoryMapResult] = await Promise.all([
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
    loadProviderInventoryMapListings(context.supabase, {
      userId: context.profile.id,
      organizationId,
      scope: "owner",
      limit: 280,
    }),
  ]);

  return (
    <MainContainer size="wide" className="space-y-5">
      {!listingCreationContext.ok && context.profile.provider_account_type === "company" ? (
        <EmptyState
          icon={TriangleAlert}
          title="Company context is temporarily unavailable"
          description={`${listingCreationContext.message} Your provider inventory is still available below.`}
          action={
            <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
              Open company workspace
            </Link>
          }
        />
      ) : null}

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

      {inventoryMapResult.ok ? (
        <ProviderInventoryMap
          mapStyleUrl={mapStyleUrl}
          listings={inventoryMapResult.listings}
          totalCount={inventoryMapResult.totalCount}
          title="Provider inventory map"
          description="Track where your in-scope listings are concentrated and jump directly into listing actions."
          emptyDescription="Listings with saved coordinates will appear here once you place map pins in the listing wizard."
          inventoryHref="/dashboard/listings"
        />
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title="Inventory map unavailable"
          description={inventoryMapResult.message}
          action={
            <Link href="/dashboard/listings" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open listing inventory
            </Link>
          }
        />
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
