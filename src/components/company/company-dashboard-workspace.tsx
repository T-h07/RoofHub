import type { ReactNode } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Clock3,
  FileClock,
  FileSearch,
  FileText,
  Megaphone,
  MessageSquareMore,
  PlusSquare,
  Rows3,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import { CompanyActivityFeed } from "@/components/company/company-activity-feed";
import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { ProviderInventoryMap } from "@/components/dashboard/provider-inventory-map";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { CompanyDashboardWorkspaceData } from "@/lib/company/dashboard-queries";
import type { ProviderInventoryMapListing } from "@/lib/listings/provider-dashboard/types";

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

type DashboardRoleMode = "agent" | "manager" | "owner_admin";

type FocusSignal = {
  label: string;
  value: number;
};

type DashboardNextStep = {
  title: string;
  detail: string;
  href: string;
  actionLabel: string;
  icon:
    | typeof PlusSquare
    | typeof FileSearch
    | typeof MessageSquareMore
    | typeof Megaphone
    | typeof Rows3;
};

function resolveDashboardRoleMode(workspace: CompanyDashboardWorkspaceData): DashboardRoleMode {
  if (workspace.membership.role === "agent") {
    return "agent";
  }

  if (workspace.membership.role === "manager") {
    return "manager";
  }

  return "owner_admin";
}

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

function buildRoleSummary(workspace: CompanyDashboardWorkspaceData, mode: DashboardRoleMode) {
  if (mode === "agent") {
    return {
      label: "Agent operations",
      title: "Listings and assigned inquiries are your daily workspace priorities.",
      description:
        "Keep drafts moving, resolve change requests, and stay current on assigned conversations without navigating through reviewer-only surfaces.",
      signals: [
        { label: "Draft", value: workspace.overview.draftCount },
        { label: "Needs changes", value: workspace.overview.needsChangesCount },
        {
          label: "Assigned conversations",
          value: workspace.messaging.assignedToViewerConversations,
        },
      ] satisfies FocusSignal[],
    };
  }

  if (mode === "manager") {
    return {
      label: "Manager operations",
      title: "Review queue and inquiry routing are the primary operational flow.",
      description:
        "Prioritize submissions waiting for approval, route incoming inquiries, and keep team workflow moving with minimal context switching.",
      signals: [
        { label: "Pending review", value: workspace.overview.pendingReviewCount },
        { label: "Shared queue", value: workspace.messaging.sharedQueueConversations },
        { label: "Unread shared", value: workspace.messaging.unreadSharedQueueMessages },
      ] satisfies FocusSignal[],
    };
  }

  return {
    label: "Owner operations",
    title: "Run company workflow execution from one operational command surface.",
    description:
      "Focus on pending reviews, routing load, and operational event flow. Governance tools remain available in Company but are intentionally de-emphasized here.",
    signals: [
      { label: "Pending review", value: workspace.overview.pendingReviewCount },
      { label: "Shared queue", value: workspace.messaging.sharedQueueConversations },
      { label: "Unread messages", value: workspace.messaging.unreadMessages },
    ] satisfies FocusSignal[],
  };
}

function buildHeaderActions(
  workspace: CompanyDashboardWorkspaceData,
  mode: DashboardRoleMode
): ReactNode {
  const nextPendingListing = workspace.pendingReviewQueue[0] ?? null;

  if (mode === "agent") {
    return (
      <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
        <PlusSquare className="size-4" aria-hidden="true" />
        Create listing
      </Link>
    );
  }

  return (
    <>
      {nextPendingListing ? (
        <Link
          href={`/dashboard/listings/${nextPendingListing.listingId}/workflow`}
          className={buttonVariants({ size: "sm" })}
        >
          <FileSearch className="size-4" aria-hidden="true" />
          Review next listing
        </Link>
      ) : (
        <Link href="#pending-review-queue" className={buttonVariants({ size: "sm" })}>
          Review queue
        </Link>
      )}
      {workspace.canViewInboxQueue ? (
        <Link
          href="/messages?section=outer_company&lane=queue"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Inbox routing
        </Link>
      ) : null}
    </>
  );
}

function buildNextStep(
  workspace: CompanyDashboardWorkspaceData,
  mode: DashboardRoleMode
): DashboardNextStep {
  if (mode === "agent") {
    if (workspace.overview.needsChangesCount > 0) {
      return {
        title: "Resolve reviewer feedback",
        detail: `${workspace.overview.needsChangesCount} listing${
          workspace.overview.needsChangesCount === 1 ? "" : "s"
        } need updates before approval can continue.`,
        href: "/dashboard/listings?status=needs_changes",
        actionLabel: "Open needs changes queue",
        icon: Megaphone,
      };
    }

    if (workspace.overview.draftCount > 0) {
      return {
        title: "Finish draft listings",
        detail: `${workspace.overview.draftCount} draft listing${
          workspace.overview.draftCount === 1 ? "" : "s"
        } are waiting for completion and submission.`,
        href: "/dashboard/listings?status=draft",
        actionLabel: "Continue draft inventory",
        icon: Rows3,
      };
    }

    if (workspace.messaging.unreadAssignedToViewerMessages > 0) {
      return {
        title: "Reply to assigned inquiries",
        detail: `${workspace.messaging.unreadAssignedToViewerMessages} unread message${
          workspace.messaging.unreadAssignedToViewerMessages === 1 ? "" : "s"
        } are waiting in your assigned inbox.`,
        href: "/messages?section=outer_company&lane=assigned",
        actionLabel: "Open assigned inbox",
        icon: MessageSquareMore,
      };
    }

    return {
      title: "Start your next listing",
      detail:
        "No urgent backlog is waiting. Start the next draft to keep inventory throughput strong.",
      href: "/dashboard/listings/new",
      actionLabel: "Create new draft",
      icon: PlusSquare,
    };
  }

  const nextPendingListing = workspace.pendingReviewQueue[0] ?? null;
  if (nextPendingListing) {
    return {
      title: "Review the next pending listing",
      detail: `${nextPendingListing.title} is waiting for workflow review and disposition.`,
      href: `/dashboard/listings/${nextPendingListing.listingId}/workflow`,
      actionLabel: "Open listing workflow",
      icon: FileSearch,
    };
  }

  if (workspace.canViewInboxQueue && workspace.messaging.unreadSharedQueueMessages > 0) {
    return {
      title: "Route shared queue inquiries",
      detail: `${workspace.messaging.unreadSharedQueueMessages} shared-queue unread message${
        workspace.messaging.unreadSharedQueueMessages === 1 ? "" : "s"
      } need assignment or reply.`,
      href: "/messages?section=outer_company&lane=queue",
      actionLabel: "Open inbox routing",
      icon: MessageSquareMore,
    };
  }

  if (workspace.overview.needsChangesCount > 0) {
    return {
      title: "Follow revision backlog",
      detail: `${workspace.overview.needsChangesCount} listing${
        workspace.overview.needsChangesCount === 1 ? "" : "s"
      } are waiting for agent revision and resubmission.`,
      href: "/dashboard/listings?status=needs_changes",
      actionLabel: "Open revision backlog",
      icon: Megaphone,
    };
  }

  return {
    title: "Check listing backlog",
    detail: "No urgent queue items are waiting. Review inventory flow and keep operations moving.",
    href: "/dashboard/listings",
    actionLabel: "Open listing backlog",
    icon: Rows3,
  };
}

function renderPendingQueue(workspace: CompanyDashboardWorkspaceData) {
  return (
    <Card id="pending-review-queue" className="border-border/80 bg-card/88">
      <CardHeader className="border-border/70 border-b pb-4">
        <div className="space-y-2">
          <Badge variant="primary">Pending review queue</Badge>
          <CardTitle className="text-xl">Listings awaiting reviewer action</CardTitle>
          <p className="type-body-muted">
            Move submitted listings through approval and publish decisions with clear queue
            ownership.
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-5">
        {workspace.pendingQueueUnavailableMessage ? (
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

                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
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
  );
}

function renderActivityCard(workspace: CompanyDashboardWorkspaceData) {
  return (
    <Card className="border-border/80 bg-card/88">
      <CardHeader className="border-border/70 border-b pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <Badge variant="outline">Activity</Badge>
            <CardTitle className="text-xl">Recent operational events</CardTitle>
            <p className="type-body-muted">
              Workflow, routing, and team events from persisted RoofHub records.
            </p>
          </div>
          {workspace.canViewActivityFeed ? (
            <Link
              href="/dashboard/activity"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Full activity
            </Link>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="pt-5">
        {!workspace.canViewActivityFeed ? (
          <EmptyState
            icon={ShieldAlert}
            title="Activity visibility is role-limited"
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
            activity={workspace.activity.slice(0, 6)}
            emptyTitle="No activity yet"
            emptyDescription="Activity appears as listings move through workflow and routing operations."
          />
        )}
      </CardContent>
    </Card>
  );
}

function renderAgentPanels(workspace: CompanyDashboardWorkspaceData) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
      <Card className="border-border/80 bg-card/88">
        <CardHeader className="border-border/70 border-b pb-4">
          <div className="space-y-2">
            <Badge variant="outline">Listing workload</Badge>
            <CardTitle className="text-xl">Continue listing work</CardTitle>
            <p className="type-body-muted">
              Keep inventory moving from draft to review-ready states with one consistent
              operational flow.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-5">
          <Link
            href="/dashboard/listings?status=draft"
            className={
              buttonVariants({ variant: "ghost", size: "sm" }) +
              " h-auto w-full justify-between px-3.5 py-3"
            }
          >
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight">Draft listings</span>
              <span className="text-muted-foreground block text-xs">
                Complete listing details and media.
              </span>
            </span>
            <span className="text-sm font-semibold">{workspace.overview.draftCount}</span>
          </Link>

          <Link
            href="/dashboard/listings?status=needs_changes"
            className={
              buttonVariants({ variant: "ghost", size: "sm" }) +
              " h-auto w-full justify-between px-3.5 py-3"
            }
          >
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight">Needs changes</span>
              <span className="text-muted-foreground block text-xs">
                Resolve reviewer feedback and resubmit.
              </span>
            </span>
            <span className="text-sm font-semibold">{workspace.overview.needsChangesCount}</span>
          </Link>

          <Link
            href="/dashboard/listings?status=submitted_for_review"
            className={
              buttonVariants({ variant: "ghost", size: "sm" }) +
              " h-auto w-full justify-between px-3.5 py-3"
            }
          >
            <span className="text-left">
              <span className="block text-sm font-semibold tracking-tight">Awaiting review</span>
              <span className="text-muted-foreground block text-xs">
                Submitted listings currently in reviewer queue.
              </span>
            </span>
            <span className="text-sm font-semibold">{workspace.overview.pendingReviewCount}</span>
          </Link>

          <div className="pt-1">
            <Link href="/dashboard/listings/new" className={buttonVariants({ size: "sm" })}>
              <PlusSquare className="size-4" aria-hidden="true" />
              Create listing draft
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/88">
        <CardHeader className="border-border/70 border-b pb-4">
          <div className="space-y-2">
            <Badge variant="outline">Assigned inbox</Badge>
            <CardTitle className="text-xl">Inquiry follow-up workload</CardTitle>
            <p className="type-body-muted">
              Keep assigned conversations moving with timely responses from your queue.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Assigned conversations
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {workspace.messaging.assignedToViewerConversations}
            </p>
          </div>

          <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
            <p className="text-muted-foreground text-xs tracking-wide uppercase">
              Unread assigned messages
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {workspace.messaging.unreadAssignedToViewerMessages}
            </p>
          </div>

          {workspace.messagingUnavailableMessage ? (
            <p className="text-muted-foreground text-xs">{workspace.messagingUnavailableMessage}</p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Link
              href="/messages?section=outer_company&lane=assigned"
              className={buttonVariants({ size: "sm" })}
            >
              <MessageSquareMore className="size-4" aria-hidden="true" />
              Open assigned inbox
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function renderReviewerPanels(workspace: CompanyDashboardWorkspaceData, mode: DashboardRoleMode) {
  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      {renderPendingQueue(workspace)}

      <div className="space-y-5">
        <Card className="border-border/80 bg-card/88">
          <CardHeader className="border-border/70 border-b pb-4">
            <div className="space-y-2">
              <Badge variant="outline">Inbox routing</Badge>
              <CardTitle className="text-xl">
                {mode === "manager"
                  ? "Shared queue and assignment"
                  : "Operational routing workload"}
              </CardTitle>
              <p className="type-body-muted">
                {mode === "manager"
                  ? "Triage shared conversations and route inquiries to the right handler quickly."
                  : "Monitor shared queue pressure and keep inquiry routing healthy across the workspace."}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Shared queue
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {workspace.messaging.sharedQueueConversations}
                </p>
              </div>
              <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Unread shared messages
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {workspace.messaging.unreadSharedQueueMessages}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Assigned to you
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {workspace.messaging.assignedToViewerConversations}
                </p>
              </div>
              <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">
                  Assigned to others
                </p>
                <p className="mt-1 text-xl font-semibold tracking-tight">
                  {workspace.messaging.assignedToOtherConversations}
                </p>
              </div>
            </div>

            {workspace.messagingUnavailableMessage ? (
              <p className="text-muted-foreground text-xs">
                {workspace.messagingUnavailableMessage}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {workspace.canViewInboxQueue ? (
                <Link
                  href="/messages?section=outer_company&lane=queue"
                  className={buttonVariants({ size: "sm" })}
                >
                  <MessageSquareMore className="size-4" aria-hidden="true" />
                  Open inbox routing
                </Link>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/88">
          <CardHeader className="border-border/70 border-b pb-4">
            <div className="space-y-2">
              <Badge variant="outline">Backlog signals</Badge>
              <CardTitle className="text-xl">Operational status at a glance</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-5">
            <Link
              href="/dashboard/listings?status=needs_changes"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto w-full justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">Needs changes</span>
                <span className="text-muted-foreground block text-xs">
                  Listings returned for revision.
                </span>
              </span>
              <span className="text-sm font-semibold">{workspace.overview.needsChangesCount}</span>
            </Link>

            <Link
              href="/dashboard/listings?status=draft"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto w-full justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">Draft inventory</span>
                <span className="text-muted-foreground block text-xs">
                  Listings still in edit phase.
                </span>
              </span>
              <span className="text-sm font-semibold">{workspace.overview.draftCount}</span>
            </Link>

            <Link
              href="/dashboard/listings?status=published"
              className={
                buttonVariants({ variant: "ghost", size: "sm" }) +
                " h-auto w-full justify-between px-3.5 py-3"
              }
            >
              <span className="text-left">
                <span className="block text-sm font-semibold tracking-tight">
                  Published listings
                </span>
                <span className="text-muted-foreground block text-xs">Live public inventory.</span>
              </span>
              <span className="text-sm font-semibold">{workspace.overview.publishedCount}</span>
            </Link>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export function CompanyDashboardWorkspace({
  workspace,
  logoUrl,
  mapStyleUrl,
  inventoryMapResult,
}: CompanyDashboardWorkspaceProps) {
  const mode = resolveDashboardRoleMode(workspace);
  const roleSummary = buildRoleSummary(workspace, mode);
  const nextStep = buildNextStep(workspace, mode);

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
        supportingLabel={
          mode === "agent"
            ? "Operational focus is intentionally narrowed to listing throughput and assigned conversations."
            : "Operational focus is intentionally centered on review queue, routing, and workflow execution."
        }
        listingCount={workspace.overview.publishedCount}
        actions={buildHeaderActions(workspace, mode)}
      />

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="border-border/80 bg-card/88">
          <CardHeader className="border-border/70 border-b pb-4">
            <div className="space-y-2">
              <Badge variant="primary">{roleSummary.label}</Badge>
              <CardTitle className="text-xl">{roleSummary.title}</CardTitle>
              <p className="type-body-muted">{roleSummary.description}</p>
            </div>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-2">
              {roleSummary.signals.map((signal) => (
                <span
                  key={signal.label}
                  className="border-border/70 bg-surface-soft inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                >
                  <span className="text-muted-foreground">{signal.label}</span>
                  <span className="font-semibold">{signal.value}</span>
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/88">
          <CardHeader className="border-border/70 border-b pb-4">
            <div className="space-y-2">
              <Badge variant="outline">Next action</Badge>
              <CardTitle className="text-xl">{nextStep.title}</CardTitle>
              <p className="type-body-muted">{nextStep.detail}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5 pt-5">
            <Link
              href={nextStep.href}
              className={buttonVariants({ size: "sm" }) + " w-full justify-start"}
            >
              <nextStep.icon className="size-4" aria-hidden="true" />
              {nextStep.actionLabel}
            </Link>

            <p className="type-body-muted">
              Secondary workflow surfaces stay below in their role-specific sections so this panel
              keeps one operational next step.
            </p>
          </CardContent>
        </Card>
      </section>

      {mode === "agent" ? renderAgentPanels(workspace) : renderReviewerPanels(workspace, mode)}

      {mode === "agent" || mode === "owner_admin" ? (
        inventoryMapResult.ok ? (
          <ProviderInventoryMap
            mapStyleUrl={mapStyleUrl}
            listings={inventoryMapResult.listings}
            totalCount={inventoryMapResult.totalCount}
            title={mode === "agent" ? "My listing coverage map" : "Company inventory footprint"}
            description={
              mode === "agent"
                ? "Track where your in-scope listings are active and continue listing edits from one operational view."
                : "Monitor where live and in-flight company listings are concentrated across your operating footprint."
            }
            emptyDescription="Listings with saved coordinates appear here after map placement in the listing workflow."
            inventoryHref="/dashboard/listings"
          />
        ) : (
          <EmptyState
            icon={FileText}
            title="Inventory map unavailable"
            description={inventoryMapResult.message}
          />
        )
      ) : null}

      {mode !== "agent" ? renderActivityCard(workspace) : null}

      {mode === "agent" && workspace.overview.pendingReviewCount > 0 ? (
        <Card className="border-border/80 bg-card/88">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-muted-foreground text-sm">
              <span className="text-foreground font-semibold">
                {workspace.overview.pendingReviewCount}
              </span>{" "}
              listing
              {workspace.overview.pendingReviewCount === 1 ? " is" : "s are"} currently in reviewer
              queue.
            </p>
            <Link
              href="/dashboard/listings?status=submitted_for_review"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Track submitted listings
            </Link>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
