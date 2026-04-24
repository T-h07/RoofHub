import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  Building2,
  ClipboardCheck,
  Clock3,
  FileClock,
  FileSearch,
  FileText,
  Gauge,
  Globe,
  Megaphone,
  MessageSquareMore,
  PlusSquare,
  Rows3,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";

import { CompanyActivityFeed } from "@/components/company/company-activity-feed";
import { ProviderInventoryMap } from "@/components/dashboard/provider-inventory-map";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  CompanyDashboardOverviewMetrics,
  CompanyDashboardWorkspaceData,
} from "@/lib/company/dashboard-queries";
import type { ProviderInventoryMapListing } from "@/lib/listings/provider-dashboard/types";
import { cn } from "@/lib/utils";

type CompanyDashboardWorkspaceProps = {
  workspace: CompanyDashboardWorkspaceData;
  logoUrl: string | null;
  mapStyleUrl: string;
  inventoryMapResult:
    | {
        ok: true;
        listings: ProviderInventoryMapListing[];
        totalCount: number;
        mappableCount: number;
      }
    | {
        ok: false;
        message: string;
        listings: ProviderInventoryMapListing[];
        totalCount: number;
        mappableCount: number;
      };
};

type OverviewMetricCard = {
  id: string;
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: typeof Gauge;
  variant?: "primary" | "outline";
};

type QuickAction = {
  href: string;
  label: string;
  detail: string;
  icon: typeof ArrowRight;
  variant?: "default" | "outline" | "ghost";
};

function formatFreshness(value: string | null) {
  if (!value) {
    return "Submitted time unavailable";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Submitted time unavailable";
  }

  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildOverviewCards(
  metrics: CompanyDashboardOverviewMetrics,
  isReviewer: boolean,
  isOwnerOrAdmin: boolean
): OverviewMetricCard[] {
  const cards: OverviewMetricCard[] = [
    {
      id: "draft",
      label: "Draft listings",
      value: metrics.draftCount,
      detail: "Still in workspace editing.",
      href: "/dashboard/listings?status=draft",
      icon: FileText,
      variant: "outline",
    },
    {
      id: "pending",
      label: "Pending review",
      value: metrics.pendingReviewCount,
      detail: isReviewer
        ? "Waiting for reviewer action."
        : "Review queue is handled by reviewer roles.",
      href: isReviewer ? "#pending-review-queue" : "/dashboard/listings?status=submitted_for_review",
      icon: FileClock,
      variant: "primary",
    },
    {
      id: "published",
      label: "Published",
      value: metrics.publishedCount,
      detail: "Visible in RoofHub discovery.",
      href: "/dashboard/listings?status=published",
      icon: BadgeCheck,
      variant: "outline",
    },
    {
      id: "members",
      label: "Active members",
      value: metrics.activeMemberCount,
      detail:
        isOwnerOrAdmin && metrics.pendingInviteCount > 0
          ? `${metrics.pendingInviteCount} pending invite${metrics.pendingInviteCount === 1 ? "" : "s"}`
          : "Current active company team size.",
      href: isOwnerOrAdmin ? "/profile/company/team" : "/profile/company",
      icon: Users,
      variant: "outline",
    },
  ];

  if (metrics.needsChangesCount > 0) {
    cards.push({
      id: "needs-changes",
      label: "Needs changes",
      value: metrics.needsChangesCount,
      detail: "Listings returned for revision.",
      href: "/dashboard/listings?status=needs_changes",
      icon: Megaphone,
      variant: "outline",
    });
  }

  return cards;
}

function buildQuickActions(workspace: CompanyDashboardWorkspaceData): QuickAction[] {
  const actions: QuickAction[] = [];
  const nextPendingListing = workspace.pendingReviewQueue[0];

  if (workspace.isReviewer && nextPendingListing) {
    actions.push({
      href: `/dashboard/listings/${nextPendingListing.listingId}/workflow`,
      label: "Review next pending listing",
      detail: `Jump into ${nextPendingListing.title}.`,
      icon: FileSearch,
      variant: "default",
    });
  }

  if (workspace.isReviewer) {
    actions.push(
      {
        href: "#pending-review-queue",
        label: "Open pending queue",
        detail: "Focus on submitted listings awaiting review.",
        icon: Rows3,
        variant: "outline",
      },
      {
        href: "/dashboard/listings?status=needs_changes",
        label: "View revision backlog",
        detail: "Track listings marked needs changes.",
        icon: Megaphone,
        variant: "ghost",
      }
    );
  }

  if (workspace.canViewActivityFeed) {
    actions.push({
      href: "/dashboard/activity",
      label: "Open activity log",
      detail: "Review membership, workflow, and publishing history.",
      icon: Activity,
      variant: "outline",
    });
  }

  actions.push(
    {
      href: "/dashboard/listings/new",
      label: "Create listing",
      detail: "Start a new company listing draft.",
      icon: PlusSquare,
      variant: workspace.isReviewer ? "ghost" : "default",
    },
    {
      href: "/dashboard/listings",
      label: "Open inventory",
      detail: "Go to full listing management.",
      icon: Rows3,
      variant: "outline",
    },
    {
      href: "/messages",
      label: "Open workspace inbox",
      detail: "Continue inquiry response and thread routing.",
      icon: MessageSquareMore,
      variant: "ghost",
    }
  );

  if (workspace.isOwnerOrAdmin) {
    actions.push(
      {
        href: "/profile/company",
        label: "Open governance workspace",
        detail: "Manage branding, company profile, and governance settings.",
        icon: Building2,
        variant: "ghost",
      },
      {
        href: "/profile/company/team",
        label: "Manage team and invites",
        detail: "Invite staff and adjust membership roles.",
        icon: Users,
        variant: "outline",
      }
    );
  }

  return actions;
}

export function CompanyDashboardWorkspace({
  workspace,
  logoUrl,
  mapStyleUrl,
  inventoryMapResult,
}: CompanyDashboardWorkspaceProps) {
  const overviewCards = buildOverviewCards(
    workspace.overview,
    workspace.isReviewer,
    workspace.isOwnerOrAdmin
  );
  const quickActions = buildQuickActions(workspace);

  return (
    <div className="space-y-5">
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
        contextLabel="Company operations dashboard"
        supportingLabel="Track review workload, listing health, team presence, and recent activity from one internal RoofHub workspace."
        listingCount={workspace.overview.publishedCount}
        actions={
          <>
            <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
              <PlusSquare className="size-4" aria-hidden="true" />
              New listing
            </Link>
            <Link
              href="/dashboard/listings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Inventory
            </Link>
            <Link
              href="/messages"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Inbox
            </Link>
            {workspace.isReviewer ? (
              <Link href="#pending-review-queue" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Review queue
              </Link>
            ) : null}
            {workspace.isOwnerOrAdmin ? (
              <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Governance
              </Link>
            ) : null}
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {overviewCards.map((card) => (
          <Link key={card.id} href={card.href} className="group block">
            <Card
              className={cn(
                "h-full border-border/75 transition-colors duration-200 hover:border-primary/55",
                card.variant === "primary"
                  ? "bg-[linear-gradient(138deg,color-mix(in_oklch,var(--primary)_16%,var(--card))_0%,color-mix(in_oklch,var(--primary)_4%,var(--card))_100%)]"
                  : "bg-card/85"
              )}
            >
              <CardHeader className="pb-2">
                <p className="text-muted-foreground inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                  <card.icon className="size-3.5" aria-hidden="true" />
                  {card.label}
                </p>
                <CardTitle className="text-[1.65rem] leading-none tracking-tight">{card.value}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 text-xs text-muted-foreground">
                <p className="leading-5">{card.detail}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-primary">
                  Open
                  <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </section>

      {inventoryMapResult.ok ? (
        <ProviderInventoryMap
          mapStyleUrl={mapStyleUrl}
          listings={inventoryMapResult.listings}
          totalCount={inventoryMapResult.totalCount}
          title="Company inventory map"
          description="Map company-owned listings in this workspace scope and move directly into workflow actions."
          emptyDescription="Company listings with saved coordinates will appear here after listing-location setup."
          inventoryHref="/dashboard/listings"
        />
      ) : (
        <EmptyState
          icon={Globe}
          title="Company inventory map unavailable"
          description={inventoryMapResult.message}
        />
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <Card id="pending-review-queue" className="border-border/80 bg-card/88">
          <CardHeader className="border-border/70 border-b pb-4">
            <div className="space-y-2">
              <Badge variant={workspace.isReviewer ? "primary" : "outline"}>
                {workspace.isReviewer ? "Pending review queue" : "Review visibility"}
              </Badge>
              <CardTitle className="text-xl">
                {workspace.isReviewer
                  ? "Listings awaiting internal review"
                  : "Company review queue status"}
              </CardTitle>
              <p className="type-body-muted">
                {workspace.isReviewer
                  ? "Prioritize submitted listings and move them through approval with minimal context switching."
                  : "Reviewer actions are available to owner, admin, and manager roles. You still see company-level queue signal in the KPI row."}
              </p>
            </div>
          </CardHeader>

          <CardContent className="space-y-3 pt-5">
            {!workspace.isReviewer ? (
              <EmptyState
                icon={ClipboardCheck}
                title="Reviewer role required for queue actions"
                description="You can still create and maintain listings while reviewer roles handle approval and publish decisions."
              />
            ) : workspace.pendingQueueUnavailableMessage ? (
              <EmptyState
                icon={FileClock}
                title="Pending queue unavailable"
                description={workspace.pendingQueueUnavailableMessage}
              />
            ) : workspace.pendingReviewQueue.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title="No listings waiting for review"
                description="Submitted listings will appear here as soon as agents send them for review."
              />
            ) : (
              <ol className="space-y-3">
                {workspace.pendingReviewQueue.map((item) => (
                  <li
                    key={item.listingId}
                    className="border-border/70 bg-surface-soft/86 space-y-3 rounded-xl border px-4 py-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold tracking-tight">{item.title}</p>
                        <p className="text-muted-foreground text-xs">
                          {item.neighborhood ? `${item.neighborhood}, ${item.city}` : item.city}
                        </p>
                      </div>
                      <ProviderListingStatusBadge status={item.listingStatus} />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5" aria-hidden="true" />
                        Submitted {formatFreshness(item.submittedAt)}
                      </span>
                      <span>•</span>
                      <span>Creator: {item.createdByDisplayName ?? "Unknown member"}</span>
                      <span>•</span>
                      <span>Agent: {item.assignedAgentDisplayName ?? "Unassigned"}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/listings/${item.listingId}/workflow`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Review workflow
                      </Link>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-border/80 bg-card/88">
            <CardHeader className="border-border/70 border-b pb-4">
              <div className="space-y-2">
                <Badge variant="outline">Quick actions</Badge>
                <CardTitle className="text-xl">Workspace shortcuts</CardTitle>
                <p className="type-body-muted">
                  High-signal actions tuned to your company role and current operational state.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5 pt-5">
              {quickActions.map((action) => (
                <Link
                  key={`${action.href}:${action.label}`}
                  href={action.href}
                  className={cn(
                    buttonVariants({ variant: action.variant ?? "ghost", size: "sm" }),
                    "h-auto w-full items-start justify-between gap-3 px-3.5 py-3 text-left"
                  )}
                >
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold tracking-tight">{action.label}</span>
                    <span className="text-muted-foreground block text-xs leading-5">{action.detail}</span>
                  </span>
                  <action.icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/88">
            <CardHeader className="border-border/70 border-b pb-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <Badge variant="outline">Activity feed</Badge>
                  <CardTitle className="text-xl">Recent workspace events</CardTitle>
                  <p className="type-body-muted">
                    Workflow and membership events captured from persisted RoofHub records.
                  </p>
                </div>
                {workspace.canViewActivityFeed ? (
                  <Link href="/dashboard/activity" className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    Full activity log
                  </Link>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {!workspace.canViewActivityFeed ? (
                <EmptyState
                  icon={ShieldAlert}
                  title="Activity feed is role-limited"
                  description={
                    workspace.activityAccessMessage ??
                    "Owner, admin, or manager role is required for company activity visibility."
                  }
                />
              ) : workspace.activityUnavailableMessage ? (
                <EmptyState
                  icon={Sparkles}
                  title="Activity feed unavailable"
                  description={workspace.activityUnavailableMessage}
                />
              ) : (
                <CompanyActivityFeed
                  activity={workspace.activity.slice(0, 7)}
                  emptyTitle="No activity yet"
                  emptyDescription="Activity appears when listings move through workflow, publishing, and team operations."
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
