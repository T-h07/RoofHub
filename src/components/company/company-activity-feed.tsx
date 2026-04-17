import {
  Building2,
  ClipboardCheck,
  MessageSquareShare,
  ShieldCheck,
  Sparkles,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  describeCompanyActivityContext,
  getCompanyActivityEventLabel,
  type CompanyActivityItem,
} from "@/lib/company/activity-feed";
import { formatProviderListingStatus } from "@/lib/listings/provider-dashboard/status";
import { cn } from "@/lib/utils";

type CompanyActivityFeedProps = {
  activity: CompanyActivityItem[];
  emptyTitle: string;
  emptyDescription: string;
  showSourceBadges?: boolean;
  className?: string;
};

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleString();
}

function formatActivityContext(event: CompanyActivityItem) {
  if (event.fromStatus || event.toStatus) {
    const fromStatus = event.fromStatus ? formatProviderListingStatus(event.fromStatus) : "--";
    const toStatus = event.toStatus ? formatProviderListingStatus(event.toStatus) : "--";
    return `${fromStatus} -> ${toStatus}`;
  }

  return describeCompanyActivityContext(event);
}

function getActivitySourceLabel(source: CompanyActivityItem["source"]) {
  switch (source) {
    case "listing_workflow":
      return "Workflow";
    case "team_audit":
      return "Team";
    case "organization_audit":
      return "Company";
    case "messaging_routing":
      return "Routing";
    default:
      return "Activity";
  }
}

function getActivityIcon(event: CompanyActivityItem) {
  if (event.group === "listing_workflow") {
    return ClipboardCheck;
  }

  if (event.group === "team_invite") {
    return UserPlus;
  }

  if (event.group === "team_membership") {
    return UserCog;
  }

  if (event.group === "company_profile") {
    return Building2;
  }

  if (event.group === "messaging_routing") {
    return MessageSquareShare;
  }

  if (event.source === "team_audit") {
    return Users;
  }

  if (event.source === "organization_audit") {
    return ShieldCheck;
  }

  return Sparkles;
}

export function CompanyActivityFeed({
  activity,
  emptyTitle,
  emptyDescription,
  showSourceBadges = false,
  className,
}: CompanyActivityFeedProps) {
  if (activity.length === 0) {
    return <EmptyState icon={Sparkles} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className={cn("space-y-3", className)}>
      {activity.map((event) => {
        const Icon = getActivityIcon(event);
        const context = formatActivityContext(event);

        return (
          <li
            key={event.id}
            className="border-border/75 bg-surface-soft/78 rounded-xl border px-3.5 py-3.5"
          >
            <div className="flex items-start gap-3">
              <span className="bg-primary/14 text-primary mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-5">{getCompanyActivityEventLabel(event.eventType)}</p>
                    <p className="text-muted-foreground text-xs">
                      {event.actorDisplayName ?? "System"} • {event.targetLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {showSourceBadges ? (
                      <Badge variant="outline" className="px-2 py-0.5 text-[11px]">
                        {getActivitySourceLabel(event.source)}
                      </Badge>
                    ) : null}
                    <time className="text-muted-foreground text-[11px]">{formatDateTime(event.occurredAt)}</time>
                  </div>
                </div>

                {context ? <p className="text-muted-foreground text-xs">{context}</p> : null}

                {event.note ? (
                  <p className="border-border/70 bg-card/84 rounded-lg border px-2.5 py-2 text-xs text-foreground/90">
                    {event.note}
                  </p>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
