import Link from "next/link";
import { ListFilter, PlusSquare, Rows3, TriangleAlert } from "lucide-react";

import { ProviderManagedListingsList } from "@/components/dashboard/provider-managed-listings-list";
import { ProviderOverviewMetrics } from "@/components/dashboard/provider-overview-metrics";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  PROVIDER_LISTING_FILTER_LABELS,
} from "@/lib/listings/provider-dashboard/status";
import {
  isProviderListingStatusFilter,
  PROVIDER_LISTING_STATUS_FILTERS,
  type ProviderListingStatusFilter,
} from "@/lib/listings/provider-dashboard/types";
import {
  loadProviderListingOverviewMetrics,
  loadProviderManagedListings,
} from "@/lib/listings/provider-dashboard/queries";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { cn } from "@/lib/utils";

type DashboardListingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStatusFilter(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.status;

  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw[0] ?? "all";
  }

  return "all";
}

function buildFilterHref(filter: ProviderListingStatusFilter) {
  if (filter === "all") {
    return "/dashboard/listings";
  }

  return `/dashboard/listings?status=${filter}`;
}

function formatFilterCount(filter: ProviderListingStatusFilter, counts: {
  total: number;
  published: number;
  draft: number;
  paused: number;
  sold: number;
  rented: number;
  archived: number;
  hiddenByAdmin: number;
}) {
  switch (filter) {
    case "all":
      return counts.total;
    case "published":
      return counts.published;
    case "draft":
      return counts.draft;
    case "paused":
      return counts.paused;
    case "sold":
      return counts.sold;
    case "rented":
      return counts.rented;
    case "archived":
      return counts.archived;
    case "hidden_by_admin":
      return counts.hiddenByAdmin;
    default:
      return 0;
  }
}

export default async function DashboardListingsPage({ searchParams }: DashboardListingsPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = await getProviderRouteContext("/dashboard/listings");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <EmptyState icon={Rows3} title="My listings unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return (
      <ProviderAccessRequired
        title="Provider listings require provider role"
        description="Switch your profile role to provider to manage owned listings."
      />
    );
  }

  const rawStatusFilter = readStatusFilter(resolvedSearchParams);
  const statusFilter = isProviderListingStatusFilter(rawStatusFilter) ? rawStatusFilter : "all";

  const [overviewResult, listingsResult] = await Promise.all([
    loadProviderListingOverviewMetrics(context.supabase, {
      userId: context.profile.id,
    }),
    loadProviderManagedListings(context.supabase, {
      userId: context.profile.id,
      statusFilter,
      limit: 180,
    }),
  ]);

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">My listings</Badge>
        <h1 className="type-page-title max-w-4xl">Manage owned listings with status-aware lifecycle actions.</h1>
        <p className="type-body-muted max-w-3xl">
          Filter by listing state, continue edits, and update lifecycle status transitions with ownership-safe
          backend persistence.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
            <PlusSquare className="size-4" aria-hidden="true" />
            New listing draft
          </Link>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Back to dashboard
          </Link>
        </div>
      </section>

      {!overviewResult.ok ? (
        <EmptyState
          icon={TriangleAlert}
          title="Listing metrics unavailable"
          description={overviewResult.message}
        />
      ) : (
        <ProviderOverviewMetrics metrics={overviewResult.metrics} />
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <ListFilter className="size-3.5" aria-hidden="true" />
            Status filter
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          {PROVIDER_LISTING_STATUS_FILTERS.map((filter) => {
            const isActive = filter === statusFilter;
            const count = overviewResult.ok
              ? formatFilterCount(filter, overviewResult.metrics)
              : null;

            return (
              <Link
                key={filter}
                href={buildFilterHref(filter)}
                className={cn(
                  buttonVariants({ variant: isActive ? "default" : "outline", size: "sm" }),
                  "gap-1.5"
                )}
              >
                {PROVIDER_LISTING_FILTER_LABELS[filter]}
                {count !== null ? (
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] leading-none",
                      isActive
                        ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
                        : "border-border/70 bg-muted/40 text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      {!listingsResult.ok ? (
        <EmptyState icon={Rows3} title="Owned listings unavailable" description={listingsResult.message} />
      ) : listingsResult.listings.length === 0 ? (
        <EmptyState
          icon={Rows3}
          title="No listings in this state"
          description="Adjust filters or create a new listing draft to build your inventory."
          action={
            <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
              Start listing wizard
            </Link>
          }
        />
      ) : (
        <ProviderManagedListingsList listings={listingsResult.listings} />
      )}
    </MainContainer>
  );
}
