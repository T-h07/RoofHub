import type { Database } from "@/types/database";

import type {
  MessagingConversationSummary,
  MessagingMessageRecord,
  MessagingThreadResult,
} from "./types";

export type MessagingRealtimeHealth = "connecting" | "live" | "degraded";
export type MessagingClientMessageState = "pending" | "failed";

export type MessagingClientMessage = MessagingMessageRecord & {
  clientId?: string;
  clientState?: MessagingClientMessageState;
};

export type MessagingClientThread = Omit<MessagingThreadResult, "messages"> & {
  messages: MessagingClientMessage[];
};

export const OPTIMISTIC_MESSAGE_PREFIX = "optimistic:";

export function createOptimisticMessageId(clientId: string) {
  return `${OPTIMISTIC_MESSAGE_PREFIX}${clientId}`;
}

export function isOptimisticMessageId(value: string) {
  return value.startsWith(OPTIMISTIC_MESSAGE_PREFIX);
}

export function toClientThread(thread: MessagingThreadResult): MessagingClientThread {
  return {
    ...thread,
    messages: [...thread.messages],
  };
}

export function toMessagingMessageRecordFromRow(
  row: Database["public"]["Tables"]["messages"]["Row"]
): MessagingMessageRecord {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    body: row.body,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

export function sortMessagesChronologically<TMessage extends { id: string; created_at: string }>(
  messages: TMessage[]
) {
  return [...messages].sort((left, right) => {
    const leftTimestamp = Date.parse(left.created_at);
    const rightTimestamp = Date.parse(right.created_at);

    if (leftTimestamp !== rightTimestamp) {
      return leftTimestamp - rightTimestamp;
    }

    const leftIsOptimistic = isOptimisticMessageId(left.id);
    const rightIsOptimistic = isOptimisticMessageId(right.id);
    if (leftIsOptimistic !== rightIsOptimistic) {
      return leftIsOptimistic ? 1 : -1;
    }

    return left.id.localeCompare(right.id);
  });
}

export function deriveViewerUserId(
  thread: MessagingClientThread | null,
  summaries: MessagingConversationSummary[],
  fallbackViewerUserId: string | null
) {
  if (thread) {
    return thread.inbox.viewerUserId;
  }

  if (fallbackViewerUserId) {
    return fallbackViewerUserId;
  }

  const firstSummary = summaries[0];
  if (!firstSummary) {
    return null;
  }

  return firstSummary.participantRole === "provider"
    ? firstSummary.conversation.provider_id
    : firstSummary.conversation.seeker_id;
}
