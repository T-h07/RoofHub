"use client";

import { ChevronRight, LoaderCircle, MessageSquareText } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { MessagingRealtimeHealth } from "@/lib/messaging/client-model";
import {
  formatConversationActivityLabel,
  formatConversationActivityTitle,
  type MessagingInboxLane,
} from "@/lib/messaging/presentation";
import type {
  MessagingConversationSummary,
  MessagingInboxContext,
} from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

type MessagesConversationListProps = {
  inbox: MessagingInboxContext;
  summaries: MessagingConversationSummary[];
  selectedConversationId: string | null;
  activeLane: MessagingInboxLane;
  unreadTotalCount: number;
  onOpenConversation: (conversationId: string) => void;
  onChangeLane: (lane: MessagingInboxLane) => void;
  realtimeHealth: MessagingRealtimeHealth;
  isRefreshing: boolean;
  onRefresh: () => void;
};

function getCounterpartLabel(summary: MessagingConversationSummary) {
  if (summary.counterpartDisplayName) {
    return summary.participantRole === "provider"
      ? `Seeker • ${summary.counterpartDisplayName}`
      : summary.counterpartDisplayName;
  }

  if (summary.participantRole === "provider") {
    return `Seeker #${summary.counterpartUserId.slice(0, 6)}`;
  }

  return "Listing provider";
}

function getListingContext(summary: MessagingConversationSummary) {
  if (!summary.listing) {
    return "Listing context is currently unavailable.";
  }

  if (summary.listing.neighborhood) {
    return `${summary.listing.neighborhood}, ${summary.listing.city}`;
  }

  return summary.listing.city;
}

function getListingTitle(summary: MessagingConversationSummary) {
  return summary.listing?.title ?? "Listing unavailable";
}

function getConversationLaneLabel(summary: MessagingConversationSummary) {
  if (!summary.companyRouting) {
    return null;
  }

  if (summary.companyRouting.routingStatus === "shared_queue") {
    return "Shared queue";
  }

  if (!summary.companyRouting.assignedMemberActive) {
    return summary.companyRouting.assignedMemberDisplayName
      ? `Handler inactive • ${summary.companyRouting.assignedMemberDisplayName}`
      : "Handler inactive";
  }

  return summary.companyRouting.assignedMemberDisplayName
    ? `Handled by ${summary.companyRouting.assignedMemberDisplayName}`
    : "Assigned thread";
}

type CompanyConversationSection = {
  id: "assigned" | "queue" | "other_assigned";
  title: string;
  description: string;
  summaries: MessagingConversationSummary[];
  emptyMessage: string;
};

function renderConversationRows(input: {
  summaries: MessagingConversationSummary[];
  selectedConversationId: string | null;
  onOpenConversation: (conversationId: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {input.summaries.map((summary) => {
        const activityTimestamp = summary.lastMessage?.created_at ?? summary.conversation.last_message_at;
        const isSelected = summary.conversation.id === input.selectedConversationId;
        const laneLabel = getConversationLaneLabel(summary);

        return (
          <li key={summary.conversation.id}>
            <button
              type="button"
              onClick={() => input.onOpenConversation(summary.conversation.id)}
              className={cn(
                "border-border/75 bg-card/58 hover:border-border flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                "focus-visible:ring-ring/50 focus-visible:ring-2 focus-visible:outline-none",
                isSelected ? "border-primary/55 bg-primary/10" : ""
              )}
              aria-current={isSelected ? "page" : undefined}
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold tracking-tight">{getListingTitle(summary)}</p>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {summary.unreadCount > 0 ? (
                      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[11px] font-semibold">
                        {summary.unreadCount}
                      </span>
                    ) : null}
                    <time
                      className="text-muted-foreground text-xs"
                      title={formatConversationActivityTitle(activityTimestamp)}
                    >
                      {formatConversationActivityLabel(activityTimestamp)}
                    </time>
                  </div>
                </div>

                <p className="text-muted-foreground text-xs leading-5">
                  {getCounterpartLabel(summary)} • {getListingContext(summary)}
                </p>

                {laneLabel ? (
                  <p className="text-muted-foreground text-[11px] leading-5">{laneLabel}</p>
                ) : null}

                <p className="text-muted-foreground truncate text-sm">
                  {summary.lastMessage
                    ? summary.lastMessage.body
                    : "No messages yet. Open the thread to start the conversation."}
                </p>
              </div>

              <ChevronRight className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MessagesConversationList({
  inbox,
  summaries,
  selectedConversationId,
  activeLane,
  unreadTotalCount,
  onOpenConversation,
  onChangeLane,
  realtimeHealth,
  isRefreshing,
  onRefresh,
}: MessagesConversationListProps) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title={inbox.mode === "company_workspace" ? "No company inquiries yet" : "No conversations yet"}
        description={
          inbox.mode === "company_workspace"
            ? "New listing inquiries will land here and stay visible to the right RoofHub workspace queue."
            : "Start from a listing detail page and use Contact to open your first listing-bound conversation."
        }
      />
    );
  }

  const isCompanyQueueInbox =
    inbox.mode === "company_workspace" && inbox.companyQueueAccess === "company_queue";
  const isAssignedOnlyCompanyInbox =
    inbox.mode === "company_workspace" && inbox.companyQueueAccess === "assigned_only";

  const assignedToMe: MessagingConversationSummary[] = [];
  const sharedQueue: MessagingConversationSummary[] = [];
  const otherAssigned: MessagingConversationSummary[] = [];

  if (isCompanyQueueInbox) {
    for (const summary of summaries) {
      const companyRouting = summary.companyRouting;

      if (!companyRouting) {
        assignedToMe.push(summary);
        continue;
      }

      if (companyRouting.routingStatus === "shared_queue") {
        sharedQueue.push(summary);
        continue;
      }

      if (companyRouting.assignedMemberUserId === inbox.viewerUserId) {
        assignedToMe.push(summary);
        continue;
      }

      otherAssigned.push(summary);
    }
  }

  const laneCounts: Record<MessagingInboxLane, number> = {
    all: summaries.length,
    assigned: isCompanyQueueInbox ? assignedToMe.length : summaries.length,
    queue: isCompanyQueueInbox ? sharedQueue.length : 0,
  };

  const companySections: CompanyConversationSection[] = isCompanyQueueInbox
    ? [
        {
          id: "assigned",
          title: "Assigned to me",
          description: "Threads that need your direct follow-up now.",
          summaries: assignedToMe,
          emptyMessage: "No assigned threads right now.",
        },
        {
          id: "queue",
          title: "Shared queue",
          description: "Unassigned inquiries waiting for routing.",
          summaries: sharedQueue,
          emptyMessage: "No conversations are waiting in shared queue.",
        },
        {
          id: "other_assigned",
          title: "Assigned to teammates",
          description: "Active handlers are already set on these threads.",
          summaries: otherAssigned,
          emptyMessage: "No teammate-assigned threads currently visible.",
        },
      ]
    : [];

  let visibleCompanySections: CompanyConversationSection[] = [];
  if (isCompanyQueueInbox) {
    if (activeLane === "queue") {
      visibleCompanySections = [companySections[1], companySections[0], companySections[2]];
    } else if (activeLane === "assigned") {
      visibleCompanySections = [companySections[0], companySections[1], companySections[2]];
    } else {
      visibleCompanySections = [companySections[0], companySections[1], companySections[2]];
    }

    visibleCompanySections = visibleCompanySections.filter(
      (section) =>
        section.summaries.length > 0 ||
        (section.id === "assigned" && activeLane === "assigned") ||
        (section.id === "queue" && activeLane === "queue")
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="border-border/70 bg-card/45 flex items-center justify-between rounded-lg border px-3.5 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">
            {isCompanyQueueInbox
              ? "Company inbox"
              : inbox.mode === "company_workspace"
                ? "Assigned inbox"
                : "Inbox"}
          </p>
          <p className="text-muted-foreground text-xs">
            {summaries.length} thread{summaries.length === 1 ? "" : "s"} • {unreadTotalCount} unread
            {inbox.mode === "company_workspace" && inbox.workspaceName
              ? ` • ${isCompanyQueueInbox ? "queue + assigned lanes" : "assigned threads"}`
              : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              realtimeHealth === "live"
                ? "bg-success/14 text-success"
                : realtimeHealth === "connecting"
                  ? "bg-warning/14 text-warning"
                  : "bg-destructive/14 text-destructive"
            )}
          >
            {realtimeHealth === "live"
              ? "Live"
              : realtimeHealth === "connecting"
                ? "Connecting"
                : "Fallback"}
          </span>

          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className={cn(
              "border-border bg-card/65 hover:bg-accent/70 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70"
            )}
          >
            {isRefreshing ? (
              <span className="inline-flex items-center gap-1">
                <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                Sync
              </span>
            ) : (
              "Refresh"
            )}
          </button>
        </div>
      </div>

      {isCompanyQueueInbox ? (
        <>
          <div className="border-border/70 bg-card/45 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground mr-1 text-[11px] font-semibold tracking-wide uppercase">
              Focus
            </p>
            {(Object.keys(laneCounts) as MessagingInboxLane[]).map((lane) => (
              <button
                key={lane}
                type="button"
                onClick={() => onChangeLane(lane)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  activeLane === lane
                    ? "border-primary/55 bg-primary/12 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                {lane === "assigned"
                  ? "Assigned to me"
                  : lane === "queue"
                    ? "Shared queue"
                    : "All threads"}
                <span className="ml-1 text-[10px] opacity-80">
                  {new Intl.NumberFormat("en").format(laneCounts[lane])}
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {visibleCompanySections.map((section) => (
              <section
                key={section.id}
                className={cn(
                  "border-border/70 bg-card/50 space-y-2.5 rounded-xl border p-3",
                  (section.id === "assigned" && activeLane === "assigned") ||
                    (section.id === "queue" && activeLane === "queue")
                    ? "border-primary/40"
                    : ""
                )}
              >
                <header className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold tracking-tight">{section.title}</h2>
                    <span className="text-muted-foreground text-xs">
                      {section.summaries.length}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs leading-5">
                    {section.description}
                  </p>
                </header>

                {section.summaries.length === 0 ? (
                  <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
                    {section.emptyMessage}
                  </p>
                ) : (
                  renderConversationRows({
                    summaries: section.summaries,
                    selectedConversationId,
                    onOpenConversation,
                  })
                )}
              </section>
            ))}
          </div>
        </>
      ) : isAssignedOnlyCompanyInbox ? (
        <section className="border-border/70 bg-card/50 space-y-2.5 rounded-xl border p-3">
          <header className="space-y-1">
            <h2 className="text-sm font-semibold tracking-tight">Assigned to me</h2>
            <p className="text-muted-foreground text-xs leading-5">
              Company-owned threads currently assigned for your follow-up.
            </p>
          </header>
          {renderConversationRows({
            summaries,
            selectedConversationId,
            onOpenConversation,
          })}
        </section>
      ) : (
        renderConversationRows({
          summaries,
          selectedConversationId,
          onOpenConversation,
        })
      )}
    </div>
  );
}
