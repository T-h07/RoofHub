import Link from "next/link";
import { EyeOff, ListFilter, ShieldCheck, TriangleAlert } from "lucide-react";

import { AdminAccessRequired } from "@/components/moderation/admin-access-required";
import { AdminModerationQueue } from "@/components/moderation/admin-moderation-queue";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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
        <EmptyState
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
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="destructive">Admin moderation</Badge>
        <h1 className="type-page-title max-w-4xl">Review safety reports and control listing visibility.</h1>
        <p className="type-body-muted max-w-3xl">
          Reported listings are reviewed here. Hide actions apply `hidden_by_admin` and remove public exposure across
          explore, map, and listing detail routes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Open explore
          </Link>
          <Link href="/dashboard" className={buttonVariants({ size: "sm" })}>
            Back to dashboard
          </Link>
        </div>
      </section>

      {overviewResult.ok ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="border-border/70 bg-card/52 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Total reports</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatMetricValue(overviewResult.metrics.totalReports)}
            </p>
          </article>

          <article className="border-border/70 bg-card/52 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Open / under review</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {formatMetricValue(
                overviewResult.metrics.openReports + overviewResult.metrics.underReviewReports
              )}
            </p>
          </article>

          <article className="border-border/70 bg-card/52 rounded-xl border p-4">
            <p className="text-muted-foreground text-xs">Hidden by admin</p>
            <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <EyeOff className="text-destructive size-5" aria-hidden="true" />
              {formatMetricValue(overviewResult.metrics.hiddenListings)}
            </p>
          </article>
        </section>
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title="Moderation metrics unavailable"
          description={overviewResult.message}
        />
      )}

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            <ListFilter className="size-3.5" aria-hidden="true" />
            Report status
          </Badge>
        </div>
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
      </section>

      {!queueResult.ok ? (
        <EmptyState icon={TriangleAlert} title="Moderation queue unavailable" description={queueResult.message} />
      ) : queueResult.reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No reports in this queue"
          description="No listings currently match this moderation filter."
        />
      ) : (
        <AdminModerationQueue reports={queueResult.reports} />
      )}
    </MainContainer>
  );
}
