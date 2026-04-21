import type { ComponentType } from "react";
import {
  Building2,
  CircleCheckBig,
  CirclePause,
  ClipboardList,
  ClipboardPenLine,
  LockKeyhole,
  MessagesSquare,
  RefreshCw,
} from "lucide-react";

import { PageSummaryCard, PageSummaryRow } from "@/components/layout/page-shell";
import type { ProviderListingOverviewMetrics } from "@/lib/listings/provider-dashboard/types";

type ProviderOverviewMetricsProps = {
  metrics: ProviderListingOverviewMetrics;
};

type OverviewMetricCard = {
  id: string;
  label: string;
  value: number;
  detail: string;
  icon: ComponentType<{ className?: string }>;
};

export function ProviderOverviewMetrics({ metrics }: ProviderOverviewMetricsProps) {
  const cards: OverviewMetricCard[] = [
    {
      id: "total",
      label: "Total listings",
      value: metrics.total,
      detail: "All owned listings across lifecycle states.",
      icon: Building2,
    },
    {
      id: "published",
      label: "Active",
      value: metrics.published,
      detail: "Currently visible in public discovery.",
      icon: CircleCheckBig,
    },
    {
      id: "draft",
      label: "Drafts",
      value: metrics.draft,
      detail: "Still in creation or revision workflow.",
      icon: ClipboardList,
    },
    {
      id: "submitted",
      label: "In review",
      value: metrics.submittedForReview,
      detail: "Submitted and waiting for reviewer action.",
      icon: ClipboardPenLine,
    },
    {
      id: "needs-changes",
      label: "Needs changes",
      value: metrics.needsChanges,
      detail: "Returned for agent revisions with reviewer feedback.",
      icon: RefreshCw,
    },
    {
      id: "approved",
      label: "Approved",
      value: metrics.approved,
      detail: "Approved internally and ready for explicit publish.",
      icon: CircleCheckBig,
    },
    {
      id: "unpublished",
      label: "Unpublished",
      value: metrics.unpublished,
      detail: "Previously public listings that were intentionally removed.",
      icon: LockKeyhole,
    },
    {
      id: "paused",
      label: "Paused",
      value: metrics.paused,
      detail: "Temporarily inactive and hidden from public browse.",
      icon: CirclePause,
    },
    {
      id: "archived",
      label: "Archived",
      value: metrics.archived,
      detail: "Retained for record but not active in inventory.",
      icon: LockKeyhole,
    },
    {
      id: "terminal",
      label: "Closed",
      value: metrics.sold + metrics.rented,
      detail: `${metrics.sold} sold • ${metrics.rented} rented`,
      icon: Building2,
    },
    {
      id: "hidden-by-admin",
      label: "Hidden by admin",
      value: metrics.hiddenByAdmin,
      detail: "Admin-moderated listings hidden from public discovery.",
      icon: LockKeyhole,
    },
  ];

  return (
    <PageSummaryRow className="xl:grid-cols-4">
      {cards.map((card) => (
        <PageSummaryCard
          key={card.id}
          label={card.label}
          value={card.value}
          detail={card.detail}
          icon={card.icon}
        />
      ))}

      <PageSummaryCard
        label="Unread leads"
        value={metrics.unreadLeadsCount}
        detail="New inbound messages from seeker conversations that still need a provider response."
        icon={MessagesSquare}
      />
    </PageSummaryRow>
  );
}
