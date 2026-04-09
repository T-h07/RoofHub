"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, LoaderCircle, SendHorizontal } from "lucide-react";

import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
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

export function MessagesThreadPanel({
  thread,
  viewerUserId,
  isSending,
  sendError,
  onSendMessage,
  onBack,
  showBackButton,
}: MessagesThreadPanelProps) {
  const [draftBody, setDraftBody] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
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
    const shouldStickToBottom =
      distanceFromBottom < 140 || lastMessage?.sender_id === viewerUserId;

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

  return (
    <section className="border-border/75 bg-card/60 flex min-h-[68dvh] flex-col overflow-hidden rounded-xl border">
      <header className="border-border/70 bg-card/80 space-y-3 border-b px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {thread.listingCoverImageUrl ? (
              <div className="border-border/70 relative size-12 shrink-0 overflow-hidden rounded-lg border">
                <Image
                  src={thread.listingCoverImageUrl}
                  alt={thread.listing?.title ? `Cover image for ${thread.listing.title}` : "Listing cover image"}
                  fill
                  unoptimized
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
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-7 gap-1 px-2.5 text-xs")}
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back
            </button>
          ) : (
            <div />
          )}

          <p className="text-muted-foreground text-xs">{messageCountLabel}</p>
        </div>
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
                      <p className="text-sm leading-6 whitespace-pre-wrap break-words">{message.body}</p>
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
            <p className="text-muted-foreground text-xs">
              {characterCount}/{MESSAGE_BODY_MAX_LENGTH}
            </p>
            <button
              type="submit"
              disabled={isSending || !normalizedDraft}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {isSending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Send
              <SendHorizontal className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </form>
      </footer>
    </section>
  );
}
