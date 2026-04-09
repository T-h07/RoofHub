"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareMore, RotateCcw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { MessagesConversationList } from "@/components/messages/messages-conversation-list";
import { MessagesThreadPanel } from "@/components/messages/messages-thread-panel";
import { EmptyState } from "@/components/ui/empty-state";
import {
  loadMessagingConversationSummariesAction,
  loadMessagingThreadAction,
  markConversationReadAction,
  sendConversationMessageAction,
} from "@/lib/messaging/actions";
import {
  createOptimisticMessageId,
  deriveViewerUserId,
  sortMessagesChronologically,
  toClientThread,
  toMessagingMessageRecordFromRow,
} from "@/lib/messaging/client-model";
import type {
  MessagingClientMessage,
  MessagingClientThread,
  MessagingRealtimeHealth,
} from "@/lib/messaging/client-model";
import type {
  MessagingConversationSummary,
  MessagingMessageRecord,
  MessagingThreadResult,
} from "@/lib/messaging/types";
import { toMessagePreview } from "@/lib/messaging/validation";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

const FALLBACK_REFRESH_INTERVAL_MS = 15_000;

type MessagesWorkspaceProps = {
  initialSummaries: MessagingConversationSummary[];
  selectedConversationId: string | null;
  initialThread: MessagingThreadResult | null;
  initialThreadError: string | null;
};

function getSummaryActivityTimestamp(summary: MessagingConversationSummary) {
  return summary.lastMessage?.created_at ?? summary.conversation.last_message_at;
}

function sortSummariesByRecentActivity(summaries: MessagingConversationSummary[]) {
  return [...summaries].sort((left, right) => {
    const leftTimestamp = Date.parse(getSummaryActivityTimestamp(left));
    const rightTimestamp = Date.parse(getSummaryActivityTimestamp(right));

    return rightTimestamp - leftTimestamp;
  });
}

function updateSummaryForIncomingMessage(
  summary: MessagingConversationSummary,
  message: MessagingMessageRecord,
  viewerUserId: string,
  selectedConversationId: string | null
) {
  if (summary.conversation.id !== message.conversation_id) {
    return summary;
  }

  const isInbound = message.sender_id !== viewerUserId;
  const isOpenConversation = selectedConversationId === summary.conversation.id;
  const unreadCount = isInbound ? (isOpenConversation ? 0 : summary.unreadCount + 1) : summary.unreadCount;

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

function clearSummaryUnreadCount(
  summaries: MessagingConversationSummary[],
  conversationId: string
) {
  return summaries.map((summary) => {
    if (summary.conversation.id !== conversationId) {
      return summary;
    }

    return {
      ...summary,
      unreadCount: 0,
    };
  });
}

function upsertThreadMessage(
  messages: MessagingClientMessage[],
  message: MessagingMessageRecord,
  viewerUserId: string
) {
  const existingIndex = messages.findIndex((candidate) => candidate.id === message.id);

  if (existingIndex >= 0) {
    const nextMessages = [...messages];
    nextMessages[existingIndex] = {
      ...nextMessages[existingIndex],
      ...message,
      clientId: undefined,
      clientState: undefined,
    };
    return sortMessagesChronologically(nextMessages);
  }

  if (message.sender_id === viewerUserId) {
    const optimisticIndex = messages.findIndex(
      (candidate) =>
        candidate.clientState === "pending" &&
        candidate.sender_id === message.sender_id &&
        candidate.body === message.body
    );

    if (optimisticIndex >= 0) {
      const nextMessages = [...messages];
      nextMessages[optimisticIndex] = {
        ...message,
      };
      return sortMessagesChronologically(nextMessages);
    }
  }

  return sortMessagesChronologically([...messages, message]);
}

function optimisticMessage(
  conversationId: string,
  senderId: string,
  body: string,
  clientId: string,
  createdAtIso: string
): MessagingClientMessage {
  return {
    id: createOptimisticMessageId(clientId),
    conversation_id: conversationId,
    sender_id: senderId,
    body,
    read_at: null,
    created_at: createdAtIso,
    clientId,
    clientState: "pending",
  };
}

export function MessagesWorkspace({
  initialSummaries,
  selectedConversationId,
  initialThread,
  initialThreadError,
}: MessagesWorkspaceProps) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);

  const [summaries, setSummaries] = useState<MessagingConversationSummary[]>(initialSummaries);
  const [thread, setThread] = useState<MessagingClientThread | null>(
    initialThread ? toClientThread(initialThread) : null
  );
  const [threadError] = useState<string | null>(initialThreadError);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [realtimeHealth, setRealtimeHealth] = useState<MessagingRealtimeHealth>("connecting");
  const [realtimeError, setRealtimeError] = useState<string | null>(null);
  const [isFallbackRefreshing, setIsFallbackRefreshing] = useState(false);
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);

  const refreshInFlightRef = useRef(false);
  const markReadInFlightRef = useRef(false);
  const shouldResyncOnReconnectRef = useRef(false);

  const viewerUserId = useMemo(() => deriveViewerUserId(thread, summaries), [thread, summaries]);
  const conversationIds = useMemo(
    () => Array.from(new Set(summaries.map((summary) => summary.conversation.id))).sort(),
    [summaries]
  );
  const conversationIdsSignature = useMemo(() => conversationIds.join(","), [conversationIds]);
  const unreadTotalCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    [summaries]
  );
  const hasConversationSelection = Boolean(selectedConversationId);

  const showConversationListOnMobile = !hasConversationSelection;
  const showThreadOnMobile = hasConversationSelection;

  const refreshWorkspaceFromServer = useCallback(
    async (mode: "manual" | "fallback" | "resync") => {
      if (refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;
      setIsFallbackRefreshing(mode !== "manual");

      try {
        const summariesResult = await loadMessagingConversationSummariesAction({
          limit: 120,
        });

        if (summariesResult.ok) {
          setSummaries(sortSummariesByRecentActivity(summariesResult.data.summaries));
        } else if (mode === "manual") {
          toast.error(summariesResult.message);
        }

        if (selectedConversationId) {
          const threadResult = await loadMessagingThreadAction({
            conversationId: selectedConversationId,
            limit: 400,
          });

          if (threadResult.ok) {
            setThread(toClientThread(threadResult.data));
          }
        }
      } catch {
        if (mode === "manual") {
          toast.error("Inbox refresh failed. Please retry.");
        }
      } finally {
        refreshInFlightRef.current = false;
        setIsFallbackRefreshing(false);
      }
    },
    [selectedConversationId]
  );

  const markCurrentConversationRead = useCallback(async () => {
    if (!selectedConversationId || markReadInFlightRef.current) {
      return;
    }

    markReadInFlightRef.current = true;

    try {
      const markResult = await markConversationReadAction({
        conversationId: selectedConversationId,
      });

      if (!markResult.ok) {
        return;
      }

      setSummaries((current) =>
        sortSummariesByRecentActivity(clearSummaryUnreadCount(current, selectedConversationId))
      );
      setThread((current) => {
        if (!current || current.conversation.id !== selectedConversationId) {
          return current;
        }

        return {
          ...current,
          unreadCount: 0,
        };
      });
    } finally {
      markReadInFlightRef.current = false;
    }
  }, [selectedConversationId]);

  const handleRealtimeMessageInsert = useCallback(
    (messageRow: Database["public"]["Tables"]["messages"]["Row"]) => {
      if (!viewerUserId) {
        return;
      }

      const incomingMessage = toMessagingMessageRecordFromRow(messageRow);

      setThread((current) => {
        if (!current || current.conversation.id !== incomingMessage.conversation_id) {
          return current;
        }

        return {
          ...current,
          conversation: {
            ...current.conversation,
            last_message_at: incomingMessage.created_at,
          },
          unreadCount: incomingMessage.sender_id === viewerUserId ? current.unreadCount : 0,
          messages: upsertThreadMessage(current.messages, incomingMessage, viewerUserId),
        };
      });

      setSummaries((current) =>
        sortSummariesByRecentActivity(
          current.map((summary) =>
            updateSummaryForIncomingMessage(
              summary,
              incomingMessage,
              viewerUserId,
              selectedConversationId
            )
          )
        )
      );

      if (
        selectedConversationId === incomingMessage.conversation_id &&
        incomingMessage.sender_id !== viewerUserId
      ) {
        void markCurrentConversationRead();
      }
    },
    [markCurrentConversationRead, selectedConversationId, viewerUserId]
  );

  const handleRealtimeMessageUpdate = useCallback(
    (messageRow: Database["public"]["Tables"]["messages"]["Row"]) => {
      if (!viewerUserId || !messageRow.read_at) {
        return;
      }

      const updatedMessage = toMessagingMessageRecordFromRow(messageRow);

      setThread((current) => {
        if (!current || current.conversation.id !== updatedMessage.conversation_id) {
          return current;
        }

        return {
          ...current,
          messages: current.messages.map((message) =>
            message.id === updatedMessage.id
              ? {
                  ...message,
                  read_at: updatedMessage.read_at,
                }
              : message
          ),
        };
      });

      if (updatedMessage.sender_id !== viewerUserId) {
        setSummaries((current) =>
          sortSummariesByRecentActivity(
            clearSummaryUnreadCount(current, updatedMessage.conversation_id)
          )
        );
      }
    },
    [viewerUserId]
  );

  useEffect(() => {
    if (!viewerUserId || !conversationIdsSignature) {
      setRealtimeHealth("degraded");
      setRealtimeError("Live updates are unavailable until conversations are loaded.");
      return;
    }

    setRealtimeHealth("connecting");
    setRealtimeError(null);

    let disposed = false;
    const conversationFilter = `conversation_id=in.(${conversationIdsSignature})`;

    const messagesChannel = supabase
      .channel(`messages-live-${viewerUserId}-${subscriptionVersion}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: conversationFilter,
        },
        (payload) =>
          handleRealtimeMessageInsert(
            payload.new as Database["public"]["Tables"]["messages"]["Row"]
          )
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: conversationFilter,
        },
        (payload) =>
          handleRealtimeMessageUpdate(
            payload.new as Database["public"]["Tables"]["messages"]["Row"]
          )
      );

    messagesChannel.subscribe((status) => {
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

    const conversationsChannel = supabase
      .channel(`conversations-live-${viewerUserId}-${subscriptionVersion}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `provider_id=eq.${viewerUserId}`,
        },
        () => {
          void refreshWorkspaceFromServer("resync");
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
          filter: `seeker_id=eq.${viewerUserId}`,
        },
        () => {
          void refreshWorkspaceFromServer("resync");
        }
      );

    conversationsChannel.subscribe();

    return () => {
      disposed = true;
      void supabase.removeChannel(messagesChannel);
      void supabase.removeChannel(conversationsChannel);
    };
  }, [
    conversationIdsSignature,
    handleRealtimeMessageInsert,
    handleRealtimeMessageUpdate,
    refreshWorkspaceFromServer,
    subscriptionVersion,
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

  function openConversation(conversationId: string) {
    router.push(`/messages?conversationId=${conversationId}`);
  }

  function clearThreadSelection() {
    router.push("/messages");
  }

  async function handleSendMessage(body: string) {
    if (!thread || !viewerUserId) {
      return false;
    }

    const clientId = crypto.randomUUID();
    const optimisticCreatedAt = new Date().toISOString();
    const optimistic = optimisticMessage(
      thread.conversation.id,
      viewerUserId,
      body,
      clientId,
      optimisticCreatedAt
    );

    setSendError(null);
    setIsSending(true);

    setThread((current) => {
      if (!current || current.conversation.id !== optimistic.conversation_id) {
        return current;
      }

      return {
        ...current,
        conversation: {
          ...current.conversation,
          last_message_at: optimistic.created_at,
        },
        messages: sortMessagesChronologically([...current.messages, optimistic]),
      };
    });

    setSummaries((current) =>
      sortSummariesByRecentActivity(
        current.map((summary) => {
          if (summary.conversation.id !== optimistic.conversation_id) {
            return summary;
          }

          return {
            ...summary,
            conversation: {
              ...summary.conversation,
              last_message_at: optimistic.created_at,
            },
            lastMessage: {
              ...optimistic,
              body: toMessagePreview(optimistic.body),
            },
            unreadCount: 0,
          };
        })
      )
    );

    let sendResult: Awaited<ReturnType<typeof sendConversationMessageAction>>;
    try {
      sendResult = await sendConversationMessageAction({
        conversationId: thread.conversation.id,
        body,
      });
    } catch {
      setThread((current) => {
        if (!current || current.conversation.id !== optimistic.conversation_id) {
          return current;
        }

        return {
          ...current,
          messages: current.messages.filter((message) => message.id !== optimistic.id),
        };
      });
      setIsSending(false);
      setSendError("Message could not be sent right now.");
      toast.error("Message could not be sent right now.");
      void refreshWorkspaceFromServer("manual");
      return false;
    }

    if (!sendResult.ok) {
      setThread((current) => {
        if (!current || current.conversation.id !== optimistic.conversation_id) {
          return current;
        }

        return {
          ...current,
          messages: current.messages.filter((message) => message.id !== optimistic.id),
        };
      });
      setIsSending(false);
      setSendError(sendResult.message);
      toast.error(sendResult.message);
      void refreshWorkspaceFromServer("manual");
      return false;
    }

    const persistedMessage = sendResult.data.message;

    setThread((current) => {
      if (!current || current.conversation.id !== sendResult.data.conversationId) {
        return current;
      }

      const messagesWithoutOptimistic = current.messages.filter(
        (message) => message.id !== optimistic.id
      );

      return {
        ...current,
        conversation: {
          ...current.conversation,
          last_message_at: persistedMessage.created_at,
        },
        messages: upsertThreadMessage(messagesWithoutOptimistic, persistedMessage, viewerUserId),
      };
    });

    setSummaries((current) =>
      sortSummariesByRecentActivity(
        current.map((summary) => {
          if (summary.conversation.id !== sendResult.data.conversationId) {
            return summary;
          }

          return {
            ...summary,
            conversation: {
              ...summary.conversation,
              last_message_at: persistedMessage.created_at,
            },
            lastMessage: {
              ...persistedMessage,
              body: toMessagePreview(persistedMessage.body),
            },
            unreadCount: 0,
          };
        })
      )
    );

    setIsSending(false);
    return true;
  }

  function retryLiveSync() {
    setRealtimeHealth("connecting");
    setRealtimeError(null);
    setSubscriptionVersion((current) => current + 1);
  }

  function refreshNow() {
    void refreshWorkspaceFromServer("manual");
  }

  return (
    <section className="space-y-3">
      {realtimeHealth === "degraded" ? (
        <section className="border-border/75 bg-card/58 flex flex-col gap-2 rounded-xl border px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold">
              <TriangleAlert className="size-3.5 text-amber-400" aria-hidden="true" />
              Live updates paused
            </p>
            <p className="text-muted-foreground text-xs">
              {realtimeError ?? "Using periodic sync until realtime reconnects."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={refreshNow}
              className={cn(
                "border-border bg-card/72 hover:bg-accent/70 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
              )}
            >
              Refresh now
            </button>
            <button
              type="button"
              onClick={retryLiveSync}
              className={cn(
                "border-border bg-card/72 hover:bg-accent/70 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors"
              )}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              Retry live sync
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(showConversationListOnMobile ? "block" : "hidden", "lg:block")}>
          <MessagesConversationList
            summaries={summaries}
            selectedConversationId={selectedConversationId}
            unreadTotalCount={unreadTotalCount}
            onOpenConversation={openConversation}
            realtimeHealth={realtimeHealth}
            isRefreshing={isFallbackRefreshing}
            onRefresh={refreshNow}
          />
        </div>

        <div className={cn(showThreadOnMobile ? "block" : "hidden", "lg:block")}>
          {hasConversationSelection && thread && viewerUserId ? (
            <MessagesThreadPanel
              key={thread.conversation.id}
              thread={thread}
              viewerUserId={viewerUserId}
              isSending={isSending}
              sendError={sendError}
              onSendMessage={handleSendMessage}
              onBack={clearThreadSelection}
              showBackButton={showThreadOnMobile}
            />
          ) : hasConversationSelection && threadError ? (
            <EmptyState
              icon={TriangleAlert}
              title="Thread unavailable"
              description={threadError}
              action={
                <button
                  type="button"
                  onClick={clearThreadSelection}
                  className={cn(
                    "border-border bg-card/60 hover:bg-accent/70 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  )}
                >
                  Back to inbox
                </button>
              }
            />
          ) : hasConversationSelection ? (
            <EmptyState
              icon={TriangleAlert}
              title="Thread unavailable"
              description="Conversation could not be loaded right now. Return to inbox and retry."
              action={
                <button
                  type="button"
                  onClick={clearThreadSelection}
                  className={cn(
                    "border-border bg-card/60 hover:bg-accent/70 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
                  )}
                >
                  Back to inbox
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={MessageSquareMore}
              title="Select a conversation"
              description="Choose a thread from the inbox to open listing context and message history."
            />
          )}
        </div>
      </div>
    </section>
  );
}
