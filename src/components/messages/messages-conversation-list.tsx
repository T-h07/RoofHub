"use client";

import { ChevronRight, LoaderCircle, MessageSquareText } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import type { MessagingRealtimeHealth } from "@/lib/messaging/client-model";
import { formatConversationActivityLabel, formatConversationActivityTitle } from "@/lib/messaging/presentation";
import type { MessagingConversationSummary } from "@/lib/messaging/types";
import { cn } from "@/lib/utils";

type MessagesConversationListProps = {
  summaries: MessagingConversationSummary[];
  selectedConversationId: string | null;
  unreadTotalCount: number;
  onOpenConversation: (conversationId: string) => void;
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

export function MessagesConversationList({
  summaries,
  selectedConversationId,
  unreadTotalCount,
  onOpenConversation,
  realtimeHealth,
  isRefreshing,
  onRefresh,
}: MessagesConversationListProps) {
  if (summaries.length === 0) {
    return (
      <EmptyState
        icon={MessageSquareText}
        title="No conversations yet"
        description="Start from a listing detail page and use Contact to open your first listing-bound conversation."
      />
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="border-border/70 bg-card/45 flex items-center justify-between rounded-lg border px-3.5 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">Inbox</p>
          <p className="text-muted-foreground text-xs">
            {summaries.length} thread{summaries.length === 1 ? "" : "s"} • {unreadTotalCount} unread
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

      <ul className="space-y-2">
        {summaries.map((summary) => {
          const activityTimestamp = summary.lastMessage?.created_at ?? summary.conversation.last_message_at;
          const isSelected = summary.conversation.id === selectedConversationId;

          return (
            <li key={summary.conversation.id}>
              <button
                type="button"
                onClick={() => onOpenConversation(summary.conversation.id)}
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
    </div>
  );
}
