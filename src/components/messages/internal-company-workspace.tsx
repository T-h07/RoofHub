"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  LoaderCircle,
  MessageSquareText,
  SendHorizontal,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import {
  loadInternalCompanyConversationSummariesAction,
  loadInternalCompanyThreadAction,
  markInternalCompanyConversationReadAction,
  sendInternalCompanyMessageAction,
} from "@/lib/messaging/actions";
import {
  sortMessagesChronologically,
  type MessagingRealtimeHealth,
} from "@/lib/messaging/client-model";
import {
  areMessagesOnSameDay,
  formatConversationActivityLabel,
  formatConversationActivityTitle,
  formatMessageDayLabel,
  formatMessageTimeLabel,
} from "@/lib/messaging/presentation";
import type {
  MessagingAssignableCompanyMember,
  MessagingInternalConversationSummary,
  MessagingInternalMessageRecord,
  MessagingInternalThreadResult,
} from "@/lib/messaging/types";
import {
  MESSAGE_BODY_MAX_LENGTH,
  normalizeMessageBody,
  toMessagePreview,
} from "@/lib/messaging/validation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { ComposeTeamMessageButton } from "@/components/messages/compose-team-message-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const FALLBACK_REFRESH_INTERVAL_MS = 8_000;

type InternalCompanyWorkspaceProps = {
  workspaceName: string;
  viewerUserId: string | null;
  initialSummaries: MessagingInternalConversationSummary[];
  initialMembers: MessagingAssignableCompanyMember[];
  selectedConversationId: string | null;
  initialThread: MessagingInternalThreadResult | null;
  initialThreadError: string | null;
};

function getConversationTitle(summary: MessagingInternalConversationSummary) {
  if (summary.conversation.kind === "group") {
    if (summary.conversation.title) {
      return summary.conversation.title;
    }

    if (summary.participantPreview.length > 0) {
      return summary.participantPreview.join(", ");
    }

    return "Internal group";
  }

  if (summary.counterpartDisplayName) {
    return summary.counterpartDisplayName;
  }

  if (summary.counterpartUserId) {
    return `Member ${summary.counterpartUserId.slice(0, 6)}`;
  }

  return "Direct conversation";
}

function getConversationMeta(summary: MessagingInternalConversationSummary) {
  if (summary.conversation.kind === "group") {
    return `${summary.participantCount} members`;
  }

  return "Direct message";
}

function sortSummariesByLatest(summaries: MessagingInternalConversationSummary[]) {
  return [...summaries].sort((left, right) => {
    const leftDate = Date.parse(left.conversation.last_message_at);
    const rightDate = Date.parse(right.conversation.last_message_at);
    return rightDate - leftDate;
  });
}

function updateSummaryForIncomingMessage(
  summary: MessagingInternalConversationSummary,
  message: MessagingInternalMessageRecord,
  viewerUserId: string,
  selectedConversationId: string | null
) {
  if (summary.conversation.id !== message.conversation_id) {
    return summary;
  }

  const isInbound = message.sender_user_id !== viewerUserId;
  const isOpenConversation = selectedConversationId === summary.conversation.id;
  const unreadCount = isInbound ? (isOpenConversation ? 0 : summary.unreadCount + 1) : 0;

  return {
    ...summary,
    conversation: {
      ...summary.conversation,
      last_message_at: message.created_at,
    },
    lastMessage: {
      ...message,
      body: toMessagePreview(message.body),
    },
    unreadCount,
  };
}

function toInternalMessageRecordFromRow(
  row: Database["public"]["Tables"]["company_internal_messages"]["Row"]
): MessagingInternalMessageRecord {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_user_id: row.sender_user_id,
    body: row.body,
    created_at: row.created_at,
  };
}

function upsertInternalThreadMessage(
  messages: MessagingInternalMessageRecord[],
  message: MessagingInternalMessageRecord
) {
  const existingIndex = messages.findIndex((candidate) => candidate.id === message.id);

  if (existingIndex >= 0) {
    const nextMessages = [...messages];
    nextMessages[existingIndex] = message;
    return sortMessagesChronologically(nextMessages);
  }

  return sortMessagesChronologically([...messages, message]);
}

export function InternalCompanyWorkspace({
  workspaceName,
  viewerUserId,
  initialSummaries,
  initialMembers,
  selectedConversationId,
  initialThread,
  initialThreadError,
}: InternalCompanyWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [summaries, setSummaries] = useState<MessagingInternalConversationSummary[]>(
    sortSummariesByLatest(initialSummaries)
  );
  const [memberOptions, setMemberOptions] =
    useState<MessagingAssignableCompanyMember[]>(initialMembers);
  const [thread, setThread] = useState<MessagingInternalThreadResult | null>(initialThread);
  const [threadError, setThreadError] = useState<string | null>(initialThreadError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [realtimeHealth, setRealtimeHealth] =
    useState<MessagingRealtimeHealth>(viewerUserId ? "connecting" : "degraded");
  const [realtimeError, setRealtimeError] = useState<string | null>(
    viewerUserId ? null : "Live sync is unavailable until your company session loads."
  );

  const refreshInFlightRef = useRef(false);
  const markReadInFlightRef = useRef(false);
  const shouldResyncOnReconnectRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSummaries(sortSummariesByLatest(initialSummaries));
  }, [initialSummaries]);

  useEffect(() => {
    setMemberOptions(initialMembers);
  }, [initialMembers]);

  useEffect(() => {
    setThread(initialThread);
    setThreadError(initialThreadError);
    setSendError(null);
    setDraftBody("");
  }, [initialThread, initialThreadError, selectedConversationId]);

  const selectedSummary = useMemo(
    () =>
      selectedConversationId
        ? (summaries.find((summary) => summary.conversation.id === selectedConversationId) ?? null)
        : null,
    [selectedConversationId, summaries]
  );
  const showConversationListOnMobile = !selectedConversationId;
  const showThreadOnMobile = Boolean(selectedConversationId);
  const unreadCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    [summaries]
  );
  const threadParticipantNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    if (!thread) {
      return map;
    }

    for (const participant of thread.participants) {
      map.set(participant.userId, participant.displayName);
    }

    return map;
  }, [thread]);
  const normalizedDraft = normalizeMessageBody(draftBody);
  const quickReplies = [
    "Reviewed.",
    "I will take this.",
    "Needs a manager decision.",
    "Ready for follow-up.",
  ];
  const conversationIdsSignature = useMemo(
    () => Array.from(new Set(summaries.map((summary) => summary.conversation.id))).sort().join(","),
    [summaries]
  );

  function buildInCompanyHref(input?: { conversationId?: string | null }) {
    const params = new URLSearchParams();
    params.set("section", "in_company");

    if (input?.conversationId) {
      params.set("conversationId", input.conversationId);
    }

    return `/messages?${params.toString()}`;
  }

  function openConversation(conversationId: string) {
    router.push(
      buildInCompanyHref({
        conversationId,
      })
    );
  }

  function clearThreadSelection() {
    router.push(buildInCompanyHref());
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

  const refreshWorkspaceFromServer = useCallback(
    async (reason: "manual" | "fallback" | "resync" = "manual") => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      if (reason === "manual") {
        setIsRefreshing(true);
        setSendError(null);
        setThreadError(null);
      }

      try {
        const summariesResult = await loadInternalCompanyConversationSummariesAction({
          limit: 120,
        });

        if (!summariesResult.ok) {
          if (reason === "manual") {
            toast.error(summariesResult.message);
          } else {
            setRealtimeError(summariesResult.message);
          }
          return;
        }

        setSummaries(sortSummariesByLatest(summariesResult.data.summaries));
        setMemberOptions(summariesResult.data.members);
        setRealtimeError(null);

        if (!selectedConversationId) {
          setThread(null);
          setThreadError(null);
          return;
        }

        const threadResult = await loadInternalCompanyThreadAction({
          conversationId: selectedConversationId,
          limit: 400,
        });

        if (!threadResult.ok) {
          setThread(null);
          setThreadError(threadResult.message);
          return;
        }

        setThread(threadResult.data);
        setThreadError(null);
      } finally {
        refreshInFlightRef.current = false;
        if (reason === "manual") {
          setIsRefreshing(false);
        }
      }
    },
    [selectedConversationId]
  );

  const markConversationRead = useCallback(async (conversationId: string) => {
    if (markReadInFlightRef.current) {
      return;
    }

    markReadInFlightRef.current = true;

    try {
      const result = await markInternalCompanyConversationReadAction({
        conversationId,
      });

      if (!result.ok) {
        return;
      }

      const nowIso = new Date().toISOString();

      setThread((currentThread) => {
        if (!currentThread || currentThread.conversation.id !== conversationId) {
          return currentThread;
        }

        return {
          ...currentThread,
          unreadCount: 0,
          participants: currentThread.participants.map((participant) =>
            participant.isViewer
              ? {
                  ...participant,
                  lastReadAt: nowIso,
                }
              : participant
          ),
        };
      });

      setSummaries((currentSummaries) =>
        currentSummaries.map((summary) => {
          if (summary.conversation.id !== conversationId) {
            return summary;
          }

          return {
            ...summary,
            unreadCount: 0,
          };
        })
      );
    } finally {
      markReadInFlightRef.current = false;
    }
  }, []);

  const handleRealtimeMessageInsert = useCallback(
    (row: Database["public"]["Tables"]["company_internal_messages"]["Row"]) => {
      if (!viewerUserId) {
        return;
      }

      const incomingMessage = toInternalMessageRecordFromRow(row);
      const isOpenConversation = selectedConversationId === incomingMessage.conversation_id;
      const isInbound = incomingMessage.sender_user_id !== viewerUserId;

      setThread((currentThread) => {
        if (!currentThread || currentThread.conversation.id !== incomingMessage.conversation_id) {
          return currentThread;
        }

        return {
          ...currentThread,
          conversation: {
            ...currentThread.conversation,
            last_message_at: incomingMessage.created_at,
          },
          messages: upsertInternalThreadMessage(currentThread.messages, incomingMessage),
          unreadCount: isOpenConversation ? 0 : currentThread.unreadCount + (isInbound ? 1 : 0),
        };
      });

      setSummaries((currentSummaries) =>
        sortSummariesByLatest(
          currentSummaries.map((summary) =>
            updateSummaryForIncomingMessage(
              summary,
              incomingMessage,
              viewerUserId,
              selectedConversationId
            )
          )
        )
      );

      if (isOpenConversation && isInbound) {
        void markConversationRead(incomingMessage.conversation_id);
      }
    },
    [markConversationRead, selectedConversationId, viewerUserId]
  );

  const scheduleWorkspaceRefresh = useCallback(() => {
    if (refreshTimerRef.current !== null) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshWorkspaceFromServer("resync");
    }, 250);
  }, [refreshWorkspaceFromServer]);

  useEffect(() => {
    if (!thread || !selectedConversationId || thread.conversation.id !== selectedConversationId) {
      return;
    }

    if (thread.unreadCount === 0) {
      return;
    }

    void markConversationRead(selectedConversationId);
  }, [markConversationRead, selectedConversationId, thread]);

  useEffect(() => {
    if (!viewerUserId) {
      setRealtimeHealth("degraded");
      setRealtimeError("Live sync is unavailable until your company session loads.");
      return;
    }

    setRealtimeHealth("connecting");
    setRealtimeError(null);

    let disposed = false;

    const liveChannel = supabase
      .channel(`internal-company-live-${viewerUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "company_internal_conversation_participants",
          filter: `user_id=eq.${viewerUserId}`,
        },
        () => {
          scheduleWorkspaceRefresh();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "company_internal_conversation_participants",
          filter: `user_id=eq.${viewerUserId}`,
        },
        () => {
          scheduleWorkspaceRefresh();
        }
      );

    if (conversationIdsSignature) {
      liveChannel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "company_internal_messages",
          filter: `conversation_id=in.(${conversationIdsSignature})`,
        },
        (payload) =>
          handleRealtimeMessageInsert(
            payload.new as Database["public"]["Tables"]["company_internal_messages"]["Row"]
          )
      );
    }

    liveChannel.subscribe((status) => {
      if (disposed) {
        return;
      }

      if (status === "SUBSCRIBED") {
        setRealtimeHealth("live");
        setRealtimeError(null);

        if (shouldResyncOnReconnectRef.current) {
          shouldResyncOnReconnectRef.current = false;
          void refreshWorkspaceFromServer("resync");
        }
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeHealth("degraded");
        setRealtimeError("Live sync disconnected. Fallback refresh is active.");
        shouldResyncOnReconnectRef.current = true;
        return;
      }

      setRealtimeHealth("connecting");
    });

    return () => {
      disposed = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(liveChannel);
    };
  }, [
    conversationIdsSignature,
    handleRealtimeMessageInsert,
    refreshWorkspaceFromServer,
    scheduleWorkspaceRefresh,
    supabase,
    viewerUserId,
  ]);

  useEffect(() => {
    if (realtimeHealth !== "degraded") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshWorkspaceFromServer("fallback");
    }, FALLBACK_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [realtimeHealth, refreshWorkspaceFromServer]);

  async function handleSendMessage() {
    if (!thread || !normalizedDraft) {
      return;
    }

    setSendError(null);
    setIsSending(true);

    const sendResult = await sendInternalCompanyMessageAction({
      conversationId: thread.conversation.id,
      body: normalizedDraft,
    });

    if (!sendResult.ok) {
      setSendError(sendResult.message);
      setIsSending(false);
      return;
    }

    const sentMessage = sendResult.data.message;
    setThread((currentThread) => {
      if (!currentThread || currentThread.conversation.id !== sendResult.data.conversationId) {
        return currentThread;
      }

      return {
        ...currentThread,
        conversation: {
          ...currentThread.conversation,
          last_message_at: sentMessage.created_at,
        },
        messages: upsertInternalThreadMessage(currentThread.messages, sentMessage),
        unreadCount: 0,
      };
    });

    if (viewerUserId) {
      setSummaries((currentSummaries) =>
        sortSummariesByLatest(
          currentSummaries.map((summary) =>
            updateSummaryForIncomingMessage(
              summary,
              sentMessage,
              viewerUserId,
              selectedConversationId
            )
          )
        )
      );
    }

    setDraftBody("");
    setIsSending(false);
  }

  return (
    <section className="space-y-3">
      <div className="border-border/70 bg-card/45 flex flex-col gap-2 rounded-lg border px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">Team Chat</p>
          <p className="text-muted-foreground text-xs">
            {workspaceName} internal collaboration threads • {summaries.length} conversation
            {summaries.length === 1 ? "" : "s"} • {unreadCount} unread
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refreshWorkspaceFromServer("manual")}
            disabled={isRefreshing}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}
          >
            {isRefreshing ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Syncing
              </>
            ) : (
              "Refresh"
            )}
          </button>
          <ComposeTeamMessageButton members={memberOptions} />
        </div>
      </div>

      {realtimeHealth === "degraded" ? (
        <div className="border-amber-500/35 bg-amber-500/10 text-amber-100 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p>{realtimeError ?? "Live sync is reconnecting. Automatic fallback refresh is active."}</p>
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(showConversationListOnMobile ? "block" : "hidden", "lg:block")}>
          {summaries.length === 0 ? (
            <EmptyState
              icon={MessageSquareText}
              title="No internal conversations yet"
              description="Create a direct or group conversation with your active RoofHub company teammates."
              action={<ComposeTeamMessageButton members={memberOptions} />}
            />
          ) : (
            <div className="space-y-2">
              {summaries.map((summary) => {
                const conversationTitle = getConversationTitle(summary);
                const isSelected = summary.conversation.id === selectedConversationId;

                return (
                  <button
                    key={summary.conversation.id}
                    type="button"
                    onClick={() => openConversation(summary.conversation.id)}
                    className={cn(
                      "border-border/75 bg-card/58 hover:border-border flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      "focus-visible:ring-ring/45 focus-visible:ring-2 focus-visible:outline-none",
                      isSelected ? "border-primary/50 bg-primary/10" : ""
                    )}
                    aria-current={isSelected ? "page" : undefined}
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold tracking-tight">
                          {conversationTitle}
                        </p>
                        <span className="text-muted-foreground text-[11px]">
                          {getConversationMeta(summary)}
                        </span>
                      </div>
                      <p className="text-muted-foreground truncate text-xs">
                        {summary.lastMessage
                          ? summary.lastMessage.body
                          : "No messages yet. Open this thread to start the internal conversation."}
                      </p>
                    </div>

                    <div className="shrink-0 space-y-1 text-right">
                      {summary.unreadCount > 0 ? (
                        <span className="bg-primary text-primary-foreground inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold">
                          {summary.unreadCount}
                        </span>
                      ) : null}
                      <time
                        className="text-muted-foreground block text-[11px]"
                        title={formatConversationActivityTitle(
                          summary.conversation.last_message_at
                        )}
                      >
                        {formatConversationActivityLabel(summary.conversation.last_message_at)}
                      </time>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className={cn(showThreadOnMobile ? "block" : "hidden", "lg:block")}>
          {selectedConversationId && thread ? (
            <section className="border-border/75 bg-card/60 flex min-h-[68dvh] flex-col overflow-hidden rounded-xl border">
              <header className="border-border/70 bg-card/82 space-y-2 border-b px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm font-semibold tracking-tight">
                      {selectedSummary
                        ? getConversationTitle(selectedSummary)
                        : "Internal conversation"}
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {thread.conversation.kind === "group"
                        ? `${thread.participants.length} participants`
                        : "Direct teammate conversation"}
                    </p>
                  </div>
                  {showThreadOnMobile ? (
                    <button
                      type="button"
                      onClick={clearThreadSelection}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "sm" }),
                        "h-7 gap-1 px-2 text-xs"
                      )}
                    >
                      <ArrowLeft className="size-3.5" aria-hidden="true" />
                      Back
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {thread.participants.map((participant) => (
                    <span
                      key={participant.userId}
                      className={cn(
                        "border-border/70 bg-background/70 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
                        participant.isViewer
                          ? "border-primary/45 text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {participant.displayName}
                    </span>
                  ))}
                </div>
              </header>

              <div className="bg-background/60 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                {thread.messages.length === 0 ? (
                  <EmptyState
                    title="No messages yet"
                    description="Send the first internal message to start coordination with your team."
                  />
                ) : (
                  <ul className="space-y-3">
                    {thread.messages.map((message, index) => {
                      const previousMessage = thread.messages[index - 1];
                      const showDayLabel =
                        !previousMessage ||
                        !areMessagesOnSameDay(previousMessage.created_at, message.created_at);
                      const isOwnMessage =
                        viewerUserId !== null && message.sender_user_id === viewerUserId;
                      const senderLabel =
                        threadParticipantNameByUserId.get(message.sender_user_id) ??
                        `Member ${message.sender_user_id.slice(0, 6)}`;

                      return (
                        <li key={message.id} className="space-y-1.5">
                          {showDayLabel ? (
                            <div className="flex justify-center">
                              <span className="border-border/70 bg-muted/32 text-muted-foreground rounded-full border px-2.5 py-1 text-[11px]">
                                {formatMessageDayLabel(message.created_at)}
                              </span>
                            </div>
                          ) : null}

                          <div
                            className={cn("flex", isOwnMessage ? "justify-end" : "justify-start")}
                          >
                            <article
                              className={cn(
                                "max-w-[min(38rem,88%)] rounded-2xl px-3.5 py-2.5",
                                isOwnMessage
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "border-border/70 bg-card/72 rounded-bl-sm border"
                              )}
                            >
                              <p className="mb-1 text-[11px] font-semibold opacity-85">
                                {senderLabel}
                              </p>
                              <p className="text-sm leading-6 break-words whitespace-pre-wrap">
                                {message.body}
                              </p>
                              <p
                                className={cn(
                                  "mt-1 text-[11px]",
                                  isOwnMessage
                                    ? "text-primary-foreground/75"
                                    : "text-muted-foreground"
                                )}
                              >
                                {formatMessageTimeLabel(message.created_at)}
                              </p>
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
                  className="space-y-2.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendMessage();
                  }}
                >
                  <Textarea
                    value={draftBody}
                    onChange={(event) => {
                      setDraftBody(event.currentTarget.value);
                      if (sendError) {
                        setSendError(null);
                      }
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    maxLength={MESSAGE_BODY_MAX_LENGTH}
                    rows={3}
                    placeholder="Write an internal team message…"
                    disabled={isSending}
                    aria-invalid={Boolean(sendError)}
                  />

                  {sendError ? <p className="text-destructive text-xs">{sendError}</p> : null}

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
                    {draftBody.trim().length}/{MESSAGE_BODY_MAX_LENGTH}
                  </p>
                </form>
              </footer>
            </section>
          ) : selectedConversationId && threadError ? (
            <EmptyState
              title="Internal thread unavailable"
              description={threadError}
              action={
                <button
                  type="button"
                  onClick={clearThreadSelection}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Back to internal conversations
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={MessageSquareText}
              title="Select an internal conversation"
              description="Choose a direct or group thread from Team Chat to continue team coordination."
            />
          )}
        </div>
      </div>
    </section>
  );
}
