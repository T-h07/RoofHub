"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, SendHorizontal } from "lucide-react";

import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  areMessagesOnSameDay,
  formatMessageDayLabel,
  formatMessageTimeLabel,
} from "@/lib/messaging/presentation";
import type { MessagingClientThread } from "@/lib/messaging/client-model";
import { MESSAGE_BODY_MAX_LENGTH, normalizeMessageBody } from "@/lib/messaging/validation";
import { cn } from "@/lib/utils";

type MessagesThreadPanelProps = {
  thread: MessagingClientThread;
  viewerUserId: string;
  isSending: boolean;
  sendError: string | null;
  onSendMessage: (body: string) => Promise<boolean>;
  onUpdateRouting: (assigneeUserId: string | null) => Promise<boolean>;
  onBack: () => void;
  showBackButton: boolean;
};

function formatPrice(thread: MessagingClientThread) {
  if (!thread.listing) {
    return null;
  }

  const normalizedCurrency = thread.listing.currency_code?.toUpperCase() || "EUR";
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(thread.listing.price_amount);

  return thread.listing.listing_type === "rent" ? `${amount} / month` : amount;
}

function getCounterpartLabel(thread: MessagingClientThread) {
  if (thread.counterpartDisplayName) {
    return `Conversation with ${thread.counterpartDisplayName}`;
  }

  if (thread.participantRole === "provider") {
    return `Conversation with seeker #${thread.counterpartUserId.slice(0, 6)}`;
  }

  return "Conversation with listing provider";
}

function getLocationLabel(thread: MessagingClientThread) {
  if (!thread.listing) {
    return "Listing location unavailable";
  }

  if (thread.listing.neighborhood) {
    return `${thread.listing.neighborhood}, ${thread.listing.city}`;
  }

  return thread.listing.city;
}

function getRoutingStatusLabel(thread: MessagingClientThread) {
  if (!thread.companyRouting) {
    return null;
  }

  if (thread.companyRouting.routingStatus === "shared_queue") {
    return "Shared workspace queue";
  }

  if (!thread.companyRouting.assignedMemberActive) {
    return thread.companyRouting.assignedMemberDisplayName
      ? `Handler inactive • ${thread.companyRouting.assignedMemberDisplayName}`
      : "Handler inactive";
  }

  return thread.companyRouting.assignedMemberDisplayName
    ? `Handled by ${thread.companyRouting.assignedMemberDisplayName}`
    : "Assigned thread";
}

export function MessagesThreadPanel({
  thread,
  viewerUserId,
  isSending,
  sendError,
  onSendMessage,
  onUpdateRouting,
  onBack,
  showBackButton,
}: MessagesThreadPanelProps) {
  const [draftBody, setDraftBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedAssigneeUserId, setSelectedAssigneeUserId] = useState(
    thread.companyRouting?.assignedMemberUserId ?? ""
  );
  const [isUpdatingRouting, setIsUpdatingRouting] = useState(false);
  const messageScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(thread.messages.length);
  const messageCountLabel = useMemo(() => {
    const count = thread.messages.length;
    return `${count} message${count === 1 ? "" : "s"}`;
  }, [thread.messages.length]);

  const normalizedDraft = normalizeMessageBody(draftBody);
  const characterCount = draftBody.trim().length;
  const listingHref = thread.listing?.slug ? `/listing/${thread.listing.slug}` : null;
  const priceLabel = formatPrice(thread);
  const routingStatusLabel = getRoutingStatusLabel(thread);
  const quickReplies = [
    "Thanks, I will follow up.",
    "Can you share a preferred viewing time?",
    "I will confirm availability.",
  ];

  useEffect(() => {
    const container = messageScrollContainerRef.current;
    if (!container) {
      previousMessageCountRef.current = thread.messages.length;
      return;
    }

    const previousCount = previousMessageCountRef.current;
    const nextCount = thread.messages.length;

    if (nextCount <= previousCount) {
      previousMessageCountRef.current = nextCount;
      return;
    }

    const lastMessage = thread.messages[nextCount - 1];
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const shouldStickToBottom = distanceFromBottom < 140 || lastMessage?.sender_id === viewerUserId;

    if (shouldStickToBottom) {
      window.requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }

    previousMessageCountRef.current = nextCount;
  }, [thread.messages, viewerUserId]);

  async function submitMessage() {
    const normalizedBody = normalizeMessageBody(draftBody);
    if (!normalizedBody) {
      setLocalError("Message must be between 1 and 2000 characters.");
      return;
    }

    setLocalError(null);
    const sent = await onSendMessage(normalizedBody);
    if (sent) {
      setDraftBody("");
    }
  }

  async function submitRoutingUpdate() {
    if (!thread.companyRouting?.canManageRouting || isUpdatingRouting) {
      return;
    }

    setIsUpdatingRouting(true);
    const ok = await onUpdateRouting(selectedAssigneeUserId || null);
    if (!ok) {
      setSelectedAssigneeUserId(thread.companyRouting.assignedMemberUserId ?? "");
    }
    setIsUpdatingRouting(false);
  }

  function appendQuickReplyToDraft(reply: string) {
    setDraftBody((currentDraft) => {
      if (currentDraft.length >= MESSAGE_BODY_MAX_LENGTH) {
        return currentDraft;
      }

      const withSpacing =
        currentDraft.length === 0 || /\s$/.test(currentDraft) ? currentDraft : `${currentDraft} `;
      const nextDraft = `${withSpacing}${reply}`;
      return nextDraft.slice(0, MESSAGE_BODY_MAX_LENGTH);
    });
  }

  return (
    <section className="border-border/75 bg-card/60 flex min-h-[68dvh] flex-col overflow-hidden rounded-xl border">
      <header className="border-border/70 bg-card/80 space-y-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {thread.listingCoverImageUrl ? (
              <div className="border-border/70 relative size-12 shrink-0 overflow-hidden rounded-lg border">
                <Image
                  src={thread.listingCoverImageUrl}
                  alt={
                    thread.listing?.title
                      ? `Cover image for ${thread.listing.title}`
                      : "Listing cover image"
                  }
                  fill
                  sizes="48px"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="border-border/70 bg-muted/35 text-muted-foreground grid size-12 shrink-0 place-items-center rounded-lg border text-[11px]">
                No image
              </div>
            )}

            <div className="min-w-0 space-y-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {thread.listing?.title ?? "Listing context unavailable"}
              </p>
              <p className="text-muted-foreground text-xs">{getCounterpartLabel(thread)}</p>
              <p className="text-muted-foreground truncate text-xs">
                {getLocationLabel(thread)}
                {priceLabel ? ` • ${priceLabel}` : ""}
              </p>
              {thread.companyRouting ? (
                <p className="text-muted-foreground truncate text-xs">
                  {thread.companyRouting.organizationName} owns this inquiry
                  {routingStatusLabel ? ` • ${routingStatusLabel}` : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {thread.listing ? (
              <ProviderListingStatusBadge status={thread.listing.listing_status} />
            ) : null}
            {listingHref ? (
              <Link
                href={listingHref}
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-7 px-2 text-xs")}
              >
                View listing
              </Link>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-7 gap-1 px-2.5 text-xs"
              )}
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </button>
          ) : (
            <div />
          )}

          <p className="text-muted-foreground text-xs">{messageCountLabel}</p>
        </div>

        {thread.companyRouting ? (
          <div className="border-border/60 bg-background/55 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-semibold">
                {thread.companyRouting.routingStatus === "shared_queue"
                  ? "Shared workspace queue"
                  : "Assigned handler"}
              </p>
              <p className="text-muted-foreground text-xs">
                {thread.companyRouting.routingStatus === "shared_queue"
                  ? "This inquiry belongs to the company queue until a member claims or is assigned to it."
                  : thread.companyRouting.assignedMemberDisplayName
                    ? `${thread.companyRouting.assignedMemberDisplayName} is the active handler for this inquiry while the company retains ownership.`
                    : "A company handler is attached to this inquiry."}
              </p>
              {!thread.companyRouting.assignedMemberActive &&
              thread.companyRouting.routingStatus === "assigned_member" ? (
                <p className="text-warning text-xs">
                  The current handler is no longer active in this workspace. Reassign this thread to
                  keep follow-up moving.
                </p>
              ) : null}
            </div>

            {thread.companyRouting.canManageRouting ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-72">
                <Select
                  value={selectedAssigneeUserId}
                  onChange={(event) => setSelectedAssigneeUserId(event.currentTarget.value)}
                  disabled={isUpdatingRouting}
                  className="h-9"
                >
                  <option value="">Shared company queue</option>
                  {thread.companyRouting.assignableMembers.map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.displayName} • {member.role}
                    </option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => void submitRoutingUpdate()}
                  disabled={
                    isUpdatingRouting ||
                    (thread.companyRouting.assignedMemberUserId ?? "") === selectedAssigneeUserId
                  }
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "h-9 justify-center text-xs"
                  )}
                >
                  {isUpdatingRouting ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Update handler
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div
        ref={messageScrollContainerRef}
        className="bg-background/60 flex-1 overflow-y-auto px-4 py-3 sm:px-5"
      >
        {thread.messages.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description="Start the conversation with a clear property question or availability request."
          />
        ) : (
          <ul className="space-y-3">
            {thread.messages.map((message, index) => {
              const previousMessage = thread.messages[index - 1];
              const showDayLabel =
                !previousMessage ||
                !areMessagesOnSameDay(previousMessage.created_at, message.created_at);
              const isOwnMessage = message.sender_id === viewerUserId;
              const isPending = message.clientState === "pending";

              return (
                <li key={message.id} className="space-y-2">
                  {showDayLabel ? (
                    <div className="flex justify-center">
                      <span className="border-border/70 bg-muted/32 text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]">
                        {formatMessageDayLabel(message.created_at)}
                      </span>
                    </div>
                  ) : null}

                  <div className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                    <article
                      className={cn(
                        "max-w-[min(38rem,88%)] rounded-2xl px-3.5 py-2.5",
                        isOwnMessage
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "border-border/70 bg-card/72 rounded-bl-sm border"
                      )}
                    >
                      <p className="text-sm leading-6 break-words whitespace-pre-wrap">
                        {message.body}
                      </p>
                      <div
                        className={cn(
                          "mt-1 inline-flex items-center gap-1 text-[11px]",
                          isOwnMessage ? "text-primary-foreground/78" : "text-muted-foreground"
                        )}
                      >
                        <span>{formatMessageTimeLabel(message.created_at)}</span>
                        {isPending ? (
                          <>
                            <span aria-hidden="true">•</span>
                            <LoaderCircle className="size-3 animate-spin" aria-hidden="true" />
                            <span>Sending</span>
                          </>
                        ) : null}
                      </div>
                    </article>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-border/70 bg-card/82 border-t px-4 py-3 sm:px-5">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submitMessage();
          }}
          className="space-y-2.5"
        >
          <Textarea
            value={draftBody}
            onChange={(event) => {
              setDraftBody(event.currentTarget.value);
              if (localError) {
                setLocalError(null);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            maxLength={MESSAGE_BODY_MAX_LENGTH}
            rows={3}
            placeholder="Write your message…"
            disabled={isSending}
            aria-invalid={Boolean(localError || sendError)}
          />

          {localError || sendError ? (
            <p className="text-destructive text-xs">{localError ?? sendError}</p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted-foreground text-[11px]">Quick reply</span>
              {quickReplies.map((reply) => (
                <button
                  key={reply}
                  type="button"
                  onClick={() => appendQuickReplyToDraft(reply)}
                  disabled={isSending}
                  className="border-border/70 hover:bg-accent/70 rounded-md border px-2 py-1 text-[11px] transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {reply}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={isSending || !normalizedDraft}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {isSending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Send
              <SendHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          </div>
          <p className="text-muted-foreground text-xs">
            {characterCount}/{MESSAGE_BODY_MAX_LENGTH}
          </p>
        </form>
      </footer>
    </section>
  );
}
