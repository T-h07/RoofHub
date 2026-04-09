import { redirect } from "next/navigation";

import {
  createOrGetConversationForListingAction,
  loadMessagingConversationSummariesQuery,
  loadMessagingThreadQuery,
} from "@/lib/messaging";
import { PlaceholderScreen } from "@/components/layout/placeholder-screen";

type MessagesPageProps = {
  searchParams: Promise<{
    listingId?: string;
    conversationId?: string;
  }>;
};

function normalizeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const resolvedSearchParams = await searchParams;
  const listingId = normalizeParam(resolvedSearchParams.listingId);
  let conversationId = normalizeParam(resolvedSearchParams.conversationId);
  let handoffMessage = "Open or create a listing conversation from detail surfaces.";

  if (listingId) {
    const createResult = await createOrGetConversationForListingAction({
      listingId,
    });

    if (!createResult.ok) {
      return (
        <PlaceholderScreen
          eyebrow="Messaging backend"
          title="Conversation workspace is locked to authenticated listing participants."
          description={createResult.message}
          upcoming={[
            "Conversation list and unread state query helpers",
            "Thread pane composition with listing context",
            "Realtime message delivery and presence states",
          ]}
        />
      );
    }

    handoffMessage = createResult.data.created
      ? "New conversation created from listing contact flow."
      : "Existing conversation reopened from listing contact flow.";

    conversationId = createResult.data.conversation.id;

    if (resolvedSearchParams.conversationId !== conversationId) {
      redirect(`/messages?conversationId=${conversationId}`);
    }
  }

  const summariesResult = await loadMessagingConversationSummariesQuery({
    limit: 48,
  });

  const threadResult = conversationId
    ? await loadMessagingThreadQuery({
        conversationId,
        limit: 200,
      })
    : null;

  if (!summariesResult.ok) {
    return (
      <PlaceholderScreen
        eyebrow="Messaging backend"
        title="Conversation workspace is locked to authenticated listing participants."
        description={summariesResult.message}
        upcoming={[
          "Conversation list and unread state query helpers",
          "Thread pane composition with listing context",
          "Realtime message delivery and presence states",
        ]}
      />
    );
  }

  const upcoming = [
    handoffMessage,
    `${summariesResult.data.summaries.length} conversation(s) are now queryable for this account.`,
    `${summariesResult.data.unreadTotalCount} unread message(s) currently await review.`,
    threadResult && threadResult.ok
      ? `Active thread loaded with ${threadResult.data.messages.length} persisted message(s).`
      : "PT22 will replace this scaffold with the full inbox and thread workspace.",
  ];

  return (
    <PlaceholderScreen
      eyebrow="Messaging backend live"
      title="Conversation workspace is protected and backed by real thread persistence."
      description="PT21 establishes conversation creation, participant ownership checks, message persistence, and unread state foundations for PT22/PT23 UI + realtime delivery."
      upcoming={upcoming}
    />
  );
}