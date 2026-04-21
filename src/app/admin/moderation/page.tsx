import Link from "next/link";
import { EyeOff, ListFilter, ShieldCheck, TriangleAlert } from "lucide-react";

import { AdminAccessRequired } from "@/components/moderation/admin-access-required";
import { AdminModerationQueue } from "@/components/moderation/admin-moderation-queue";
import { MainContainer } from "@/components/layout/main-container";
import {
  PageIntro,
  PageSection,
  PageShell,
  PageState,
  PageSummaryCard,
  PageSummaryRow,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getAdminRouteContext } from "@/lib/moderation/access";
import {
  isModerationStatusFilter,
  MODERATION_STATUS_FILTER_OPTIONS,
} from "@/lib/moderation/reporting";
import { loadModerationOverviewMetrics, loadModerationReportQueue } from "@/lib/moderation/queries";
import type { ModerationStatusFilter } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

type AdminModerationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readStatusFilter(searchParams: Record<string, string | string[] | undefined>) {
  const raw = searchParams.status;

  if (typeof raw === "string") {
    return raw;
  }

  if (Array.isArray(raw)) {
    return raw[0] ?? "open";
  }

  return "open";
}

function buildFilterHref(filter: ModerationStatusFilter) {
  if (filter === "all") {
    return "/admin/moderation";
  }

  return `/admin/moderation?status=${filter}`;
}

function formatMetricValue(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

export default async function AdminModerationPage({
  searchParams,
}: AdminModerationPageProps) {
  const resolvedSearchParams = await searchParams;
  const context = await getAdminRouteContext("/admin/moderation");

  if (!context.ok) {
    return (
      <MainContainer size="content">
        <PageState
          icon={TriangleAlert}
          title="Moderation workspace unavailable"
          description={context.message}
        />
      </MainContainer>
    );
  }

  if (!context.isAdmin) {
    return (
      <AdminAccessRequired
        title="Moderation workspace is admin-only"
        description="Your account does not currently have admin moderation access."
      />
    );
  }

  const rawStatusFilter = readStatusFilter(resolvedSearchParams);
  const statusFilter = isModerationStatusFilter(rawStatusFilter) ? rawStatusFilter : "open";

  const [overviewResult, queueResult] = await Promise.all([
    loadModerationOverviewMetrics(context.supabase),
    loadModerationReportQueue(context.supabase, { statusFilter, limit: 120 }),
  ]);

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="destructive">Admin moderation</Badge>}
          title="Review safety reports and control listing visibility."
          description="Reported listings are reviewed here. Hide actions apply `hidden_by_admin` and remove public exposure across explore, map, and listing detail routes."
          actions={
            <>
              <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open explore
              </Link>
              <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
                Back to dashboard
              </Link>
            </>
          }
          tone="danger"
        />

        {overviewResult.ok ? (
          <PageSummaryRow>
            <PageSummaryCard
              label="Total reports"
              value={formatMetricValue(overviewResult.metrics.totalReports)}
              detail="All reports recorded across moderation states."
            />
            <PageSummaryCard
              label="Open / under review"
              value={formatMetricValue(
                overviewResult.metrics.openReports + overviewResult.metrics.underReviewReports
              )}
              detail="Active queue pressure still waiting on moderator action."
              tone="primary"
            />
            <PageSummaryCard
              label="Hidden by admin"
              value={formatMetricValue(overviewResult.metrics.hiddenListings)}
              detail="Listings currently removed from public discovery by moderation."
              icon={EyeOff}
              tone="danger"
            />
          </PageSummaryRow>
        ) : (
          <PageState
            icon={TriangleAlert}
            title="Moderation metrics unavailable"
            description={overviewResult.message}
          />
        )}

        <PageSection
          eyebrow={
            <Badge variant="outline">
              <ListFilter className="size-3.5" aria-hidden="true" />
              Report status
            </Badge>
          }
          title="Queue filters"
          description="Switch between moderation states without losing the operational context of the current queue."
        >
          <div className="flex flex-wrap gap-2">
            {MODERATION_STATUS_FILTER_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={buildFilterHref(option.value)}
                className={cn(
                  buttonVariants({
                    variant: option.value === statusFilter ? "default" : "outline",
                    size: "sm",
                  }),
                  "gap-1.5"
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </PageSection>

        {!queueResult.ok ? (
          <PageState icon={TriangleAlert} title="Moderation queue unavailable" description={queueResult.message} />
        ) : queueResult.reports.length === 0 ? (
          <PageState
            icon={ShieldCheck}
            title="No reports in this queue"
            description="No listings currently match this moderation filter."
          />
        ) : (
          <AdminModerationQueue reports={queueResult.reports} />
        )}
      </PageShell>
    </MainContainer>
  );
}
