import Link from "next/link";
import { LayoutDashboard, PlusSquare, Rows3, TriangleAlert } from "lucide-react";

import { CompanyDashboardWorkspace } from "@/components/company/company-dashboard-workspace";
import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { ProviderInventoryMap } from "@/components/dashboard/provider-inventory-map";
import { ProviderManagedListingsList } from "@/components/dashboard/provider-managed-listings-list";
import { ProviderOverviewMetrics } from "@/components/dashboard/provider-overview-metrics";
import { ProviderUnreadLeadsPlaceholder } from "@/components/dashboard/provider-unread-leads-placeholder";
import { MainContainer } from "@/components/layout/main-container";
import { PageIntro, PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
        <PageState icon={LayoutDashboard} title="Dashboard unavailable" description={context.message} />
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
    listingCreationContext.reason === "company_workspace_selection_required" &&
    listingCreationContext.company
  ) {
    return (
      <MainContainer size="content" className="space-y-5">
        <CompanyWorkspaceSwitcher
          workspaceOptions={listingCreationContext.company.workspaceOptions}
          activeOrganizationId={listingCreationContext.company.activeOrganizationId}
          redirectTo="/dashboard"
          title="Choose the company workspace for dashboard operations"
          description="RoofHub needs one explicit active company workspace before it can load company dashboard, listing, and activity surfaces."
          submitLabel="Open selected dashboard"
        />
      </MainContainer>
    );
  }

  if (!listingCreationContext.ok && context.profile.provider_account_type === "company") {
    return (
      <MainContainer size="content">
        <PageState
          icon={LayoutDashboard}
          title="Company dashboard requires an active workspace"
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
          <PageState
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
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Provider workspace</Badge>}
          title="Control your property inventory and lifecycle states."
          description="Review listing volume, manage status transitions, and continue editing listings without leaving the provider dashboard."
          actions={
            <>
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
            </>
          }
        />

        {!overviewResult.ok ? (
          <PageState
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
          <PageState
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

        <PageSection
          eyebrow={<Badge variant="outline">Inventory focus</Badge>}
          title="Recent listings"
          description="Continue high-signal edits and workflow actions from the most recent listings in your scope."
          action={
            <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Open full list
            </Link>
          }
          contentClassName="pt-5"
        >
          {!recentListingsResult.ok ? (
            <PageState icon={Rows3} title="Recent listings unavailable" description={recentListingsResult.message} />
          ) : recentListingsResult.listings.length === 0 ? (
            <PageState
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
        </PageSection>

        <ProviderUnreadLeadsPlaceholder />
      </PageShell>
    </MainContainer>
  );
}
