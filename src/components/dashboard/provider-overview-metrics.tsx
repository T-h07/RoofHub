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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
              <card.icon className="size-3.5" aria-hidden="true" />
              {card.label}
            </div>
            <CardTitle className="text-2xl">{card.value}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">{card.detail}</CardContent>
        </Card>
      ))}

      <Card className="overflow-hidden">
        <CardHeader className="pb-2">
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            <MessagesSquare className="size-3.5" aria-hidden="true" />
            Unread leads
          </div>
          <CardTitle className="text-2xl">{metrics.unreadLeadsCount}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          New inbound messages from seeker conversations that still need a provider response.
        </CardContent>
      </Card>
    </div>
  );
}
