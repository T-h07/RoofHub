import Link from "next/link";
import { ListFilter, PlusSquare, Rows3, TriangleAlert } from "lucide-react";

import { CompanyWorkspaceSwitcher } from "@/components/company/company-workspace-switcher";
import { ProviderManagedListingsList } from "@/components/dashboard/provider-managed-listings-list";
import { ProviderAccessRequired } from "@/components/dashboard/provider-access-required";
import { MainContainer } from "@/components/layout/main-container";
import { PageIntro, PageSection, PageShell, PageState } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  ORGANIZATION_MEMBER_ROLE_LABELS,
  type OrganizationMemberRole,
} from "@/lib/company/team-types";
import { PROVIDER_LISTING_FILTER_LABELS } from "@/lib/listings/provider-dashboard/status";
import {
  isProviderListingStatusFilter,
  PROVIDER_LISTING_STATUS_FILTERS,
  type ProviderListingStatusFilter,
} from "@/lib/listings/provider-dashboard/types";
import {
  loadProviderListingOverviewMetrics,
  loadProviderManagedListings,
} from "@/lib/listings/provider-dashboard/queries";
import { resolveProviderListingCreationContext } from "@/lib/listings/ownership";
import { getProviderRouteContext } from "@/lib/listings/provider-wizard/access";
import { cn } from "@/lib/utils";

type DashboardListingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ListingsRoleMode =
  | "agent_primary"
  | "manager_secondary"
  | "owner_secondary"
  | "individual_primary";

function resolveListingsRoleMode(role: OrganizationMemberRole | null): ListingsRoleMode {
  if (role === "manager") {
    return "manager_secondary";
  }

  if (role === "owner" || role === "admin") {
    return "owner_secondary";
  }

  if (role === "agent") {
    return "agent_primary";
  }

  return "individual_primary";
}

function isSecondaryListingsMode(mode: ListingsRoleMode) {
  return mode === "manager_secondary" || mode === "owner_secondary";
}

function buildListingsIntroCopy(mode: ListingsRoleMode) {
  if (mode === "agent_primary") {
    return {
      title: "Listings is your primary daily work surface.",
      description:
        "Create drafts, continue edits, submit for review, and track review outcomes from one focused inventory workflow.",
    };
  }

  if (mode === "individual_primary") {
    return {
      title: "Listings is your primary inventory workflow.",
      description:
        "Create and manage listing drafts, update lifecycle state, and continue publishing work from a single queue.",
    };
  }

  return {
    title: "Listings is a secondary inventory surface for reviewer roles.",
    description:
      "Use dashboard as the primary review hub, then use listings for targeted inspection, context, and workflow continuation.",
  };
}

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

function formatFilterCount(
  filter: ProviderListingStatusFilter,
  counts: {
    total: number;
    published: number;
    draft: number;
    submittedForReview: number;
    needsChanges: number;
    approved: number;
    unpublished: number;
    paused: number;
    sold: number;
    rented: number;
    archived: number;
    hiddenByAdmin: number;
  }
) {
  switch (filter) {
    case "all":
      return counts.total;
    case "published":
      return counts.published;
    case "draft":
      return counts.draft;
    case "submitted_for_review":
      return counts.submittedForReview;
    case "needs_changes":
      return counts.needsChanges;
    case "approved":
      return counts.approved;
    case "unpublished":
      return counts.unpublished;
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
        <PageState icon={Rows3} title="My listings unavailable" description={context.message} />
      </MainContainer>
    );
  }

  if (!context.isProvider) {
    return (
      <ProviderAccessRequired
        title="Listing workspace access required"
        description="Switch your profile role before managing owned listings."
      />
    );
  }

  const rawStatusFilter = readStatusFilter(resolvedSearchParams);
  const statusFilter = isProviderListingStatusFilter(rawStatusFilter) ? rawStatusFilter : "all";
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
          redirectTo="/dashboard/listings"
          title="Choose the company context for listing operations"
          description="Listing inventory is scoped to one active RoofHub company context. Select the company before filtering or managing company-owned listings."
          submitLabel="Open selected inventory"
        />
      </MainContainer>
    );
  }

  if (!listingCreationContext.ok && context.profile.provider_account_type === "company") {
    return (
      <MainContainer size="content">
        <PageState
          icon={Rows3}
          title="Company listing inventory requires an active workspace"
          description={listingCreationContext.message}
          action={
            <Link href="/profile/company" className={buttonVariants({ size: "sm" })}>
              Open company governance
            </Link>
          }
        />
      </MainContainer>
    );
  }

  const organizationId =
    listingCreationContext.ok && listingCreationContext.context.ownershipMode === "company"
      ? listingCreationContext.context.organizationId
      : null;
  const activeCompanyRole =
    listingCreationContext.ok && listingCreationContext.context.ownershipMode === "company"
      ? (listingCreationContext.company?.activeRole ?? null)
      : null;
  const listingsRoleMode = resolveListingsRoleMode(activeCompanyRole);
  const introCopy = buildListingsIntroCopy(listingsRoleMode);
  const isSecondaryMode = isSecondaryListingsMode(listingsRoleMode);

  const [overviewResult, listingsResult] = await Promise.all([
    loadProviderListingOverviewMetrics(context.supabase, {
      userId: context.profile.id,
      organizationId,
    }),
    loadProviderManagedListings(context.supabase, {
      userId: context.profile.id,
      organizationId,
      statusFilter,
      limit: 180,
    }),
  ]);

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={
            <>
              <Badge variant="primary">Listings workspace</Badge>
              {activeCompanyRole ? (
                <Badge variant="outline">
                  Active role: {ORGANIZATION_MEMBER_ROLE_LABELS[activeCompanyRole]}
                </Badge>
              ) : null}
            </>
          }
          title={introCopy.title}
          description={introCopy.description}
          actions={
            isSecondaryMode ? (
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                Back to review dashboard
              </Link>
            ) : (
              <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
                <PlusSquare className="size-4" aria-hidden="true" />
                Create listing draft
              </Link>
            )
          }
          meta={
            overviewResult.ok ? (
              <>
                <span className="border-border/70 bg-surface-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Draft</span>
                  <span className="font-semibold">{overviewResult.metrics.draft}</span>
                </span>
                <span className="border-border/70 bg-surface-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">In review</span>
                  <span className="font-semibold">{overviewResult.metrics.submittedForReview}</span>
                </span>
                <span className="border-border/70 bg-surface-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Needs changes</span>
                  <span className="font-semibold">{overviewResult.metrics.needsChanges}</span>
                </span>
                <span className="border-border/70 bg-surface-soft inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs">
                  <span className="text-muted-foreground">Active</span>
                  <span className="font-semibold">{overviewResult.metrics.published}</span>
                </span>
              </>
            ) : (
              <span className="text-muted-foreground text-xs">{overviewResult.message}</span>
            )
          }
        />

        <PageSection
          eyebrow={<Badge variant="outline">Workflow sequence</Badge>}
          title={
            isSecondaryMode
              ? "Use listings for inventory context and targeted workflow continuation"
              : "Follow one clean listing work sequence"
          }
          description={
            isSecondaryMode
              ? "Dashboard remains the primary queue for review roles. Listings is focused on inspection and direct row-level continuation."
              : "Scan status, continue edits, submit for review, then return to track outcomes without leaving this surface."
          }
        >
          <div className="grid gap-2.5 md:grid-cols-3">
            <Link
              href="/dashboard/listings?status=draft"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">
                  1. Edit draft inventory
                </span>
                <span className="text-muted-foreground block text-xs">
                  Continue listing details and media.
                </span>
              </span>
              <span className="text-sm font-semibold">
                {overviewResult.ok ? overviewResult.metrics.draft : "—"}
              </span>
            </Link>
            <Link
              href="/dashboard/listings?status=submitted_for_review"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">
                  2. Follow review queue state
                </span>
                <span className="text-muted-foreground block text-xs">
                  Track submitted listings through workflow decisions.
                </span>
              </span>
              <span className="text-sm font-semibold">
                {overviewResult.ok ? overviewResult.metrics.submittedForReview : "—"}
              </span>
            </Link>
            <Link
              href="/dashboard/listings?status=needs_changes"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">
                  3. Resolve change requests
                </span>
                <span className="text-muted-foreground block text-xs">
                  Apply reviewer feedback and resubmit.
                </span>
              </span>
              <span className="text-sm font-semibold">
                {overviewResult.ok ? overviewResult.metrics.needsChanges : "—"}
              </span>
            </Link>
          </div>
        </PageSection>

        {!overviewResult.ok ? (
          <PageState
            icon={TriangleAlert}
            title="Listing metrics unavailable"
            description={overviewResult.message}
          />
        ) : null}

        <PageSection
          eyebrow={
            <Badge variant="outline">
              <ListFilter className="size-3.5" aria-hidden="true" />
              Status filter
            </Badge>
          }
          title="Inventory filters"
          description="Filter by lifecycle state to keep inventory scanning fast and action priority clear."
        >
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
        </PageSection>

        <PageSection
          eyebrow={<Badge variant="outline">Managed inventory</Badge>}
          title="Listings in the current queue"
          description={
            isSecondaryMode
              ? "Inspect listings in the selected state and open targeted workflow continuation where needed."
              : "Review listings in the selected state and continue directly into the next relevant action."
          }
        >
          {!listingsResult.ok ? (
            <PageState
              icon={Rows3}
              title="Managed listings unavailable"
              description={listingsResult.message}
            />
          ) : listingsResult.listings.length === 0 ? (
            <PageState
              icon={Rows3}
              title="No listings in this state"
              description="Adjust filters or create a new listing draft to build your inventory."
              action={
                isSecondaryMode ? (
                  <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                    Back to operations dashboard
                  </Link>
                ) : (
                  <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
                    Start listing wizard
                  </Link>
                )
              }
            />
          ) : (
            <ProviderManagedListingsList
              listings={listingsResult.listings}
              roleMode={listingsRoleMode}
            />
          )}
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
