"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareMore, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { MessagesConversationList } from "@/components/messages/messages-conversation-list";
import { MessagesThreadPanel } from "@/components/messages/messages-thread-panel";
import { EmptyState } from "@/components/ui/empty-state";
import { sendConversationMessageAction } from "@/lib/messaging/actions";
import type { MessagingConversationSummary, MessagingThreadResult } from "@/lib/messaging/types";
import { toMessagePreview } from "@/lib/messaging/validation";
import { cn } from "@/lib/utils";

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

function getViewerUserIdForThread(thread: MessagingThreadResult | null) {
  if (!thread) {
    return null;
  }

  return thread.participantRole === "provider"
    ? thread.conversation.provider_id
    : thread.conversation.seeker_id;
}

export function MessagesWorkspace({
  initialSummaries,
  selectedConversationId,
  initialThread,
  initialThreadError,
}: MessagesWorkspaceProps) {
  const router = useRouter();
  const [summaries, setSummaries] = useState<MessagingConversationSummary[]>(initialSummaries);
  const [thread, setThread] = useState<MessagingThreadResult | null>(initialThread);
  const [threadError] = useState<string | null>(initialThreadError);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const viewerUserId = useMemo(() => getViewerUserIdForThread(thread), [thread]);
  const unreadTotalCount = useMemo(
    () => summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    [summaries]
  );
  const hasConversationSelection = Boolean(selectedConversationId);

  const showConversationListOnMobile = !hasConversationSelection;
  const showThreadOnMobile = hasConversationSelection;

  function openConversation(conversationId: string) {
    router.push(`/messages?conversationId=${conversationId}`);
  }

  function clearThreadSelection() {
    router.push("/messages");
  }

  async function handleSendMessage(body: string) {
    if (!thread) {
      return false;
    }

    setIsSending(true);
    setSendError(null);

    let sendResult: Awaited<ReturnType<typeof sendConversationMessageAction>>;
    try {
      sendResult = await sendConversationMessageAction({
        conversationId: thread.conversation.id,
        body,
      });
    } catch {
      setIsSending(false);
      setSendError("Message could not be sent right now.");
      toast.error("Message could not be sent right now.");
      return false;
    }

    if (!sendResult.ok) {
      setIsSending(false);
      setSendError(sendResult.message);
      toast.error(sendResult.message);
      return false;
    }

    const persistedMessage = sendResult.data.message;

    setThread((current) => {
      if (!current || current.conversation.id !== sendResult.data.conversationId) {
        return current;
      }

      const alreadyExists = current.messages.some((message) => message.id === persistedMessage.id);
      const nextMessages = alreadyExists ? current.messages : [...current.messages, persistedMessage];

      return {
        ...current,
        conversation: {
          ...current.conversation,
          last_message_at: persistedMessage.created_at,
        },
        messages: nextMessages,
      };
    });

    setSummaries((currentSummaries) =>
      sortSummariesByRecentActivity(
        currentSummaries.map((summary) => {
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

  return (
    <section className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={cn(showConversationListOnMobile ? "block" : "hidden", "lg:block")}>
          <MessagesConversationList
            summaries={summaries}
            selectedConversationId={selectedConversationId}
            unreadTotalCount={unreadTotalCount}
            onOpenConversation={openConversation}
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
