import { redirect } from "next/navigation";
import { MessageSquareMore, TriangleAlert } from "lucide-react";

import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import {
  createOrGetConversationForListingAction,
  loadMessagingConversationSummariesQuery,
  loadMessagingThreadQuery,
} from "@/lib/messaging";
import {
  normalizeMessagingInboxLane,
  type MessagingInboxLane,
} from "@/lib/messaging/presentation";
import { isUuid } from "@/lib/messaging/validation";

type MessagesPageProps = {
  searchParams: Promise<{
    listingId?: string;
    conversationId?: string;
    lane?: string;
  }>;
};

function normalizeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildMessagesHref(input: {
  listingId?: string;
  conversationId?: string;
  lane?: MessagingInboxLane;
}) {
  const params = new URLSearchParams();

  if (input.listingId) {
    params.set("listingId", input.listingId);
  }

  if (input.conversationId) {
    params.set("conversationId", input.conversationId);
  }

  if (input.lane && input.lane !== "all") {
    params.set("lane", input.lane);
  }

  const queryString = params.toString();
  return queryString ? `/messages?${queryString}` : "/messages";
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const resolvedSearchParams = await searchParams;
  const listingId = normalizeParam(resolvedSearchParams.listingId);
  let conversationId = normalizeParam(resolvedSearchParams.conversationId);
  const requestedLane = normalizeMessagingInboxLane(
    normalizeParam(resolvedSearchParams.lane),
    "all"
  );
  let handoffErrorMessage: string | null = null;

  if (listingId) {
    const createResult = await createOrGetConversationForListingAction({ listingId });

    if (!createResult.ok) {
      if (createResult.requiresAuth) {
        redirect(
          toSignInPath(
            buildMessagesHref({
              listingId,
              lane: requestedLane,
            })
          )
        );
      }

      handoffErrorMessage = createResult.message;
    } else {
      redirect(
        buildMessagesHref({
          conversationId: createResult.data.conversation.id,
          lane: requestedLane,
        })
      );
    }
  }

  const summariesResult = await loadMessagingConversationSummariesQuery({
    limit: 120,
  });

  if (!summariesResult.ok) {
    if (summariesResult.requiresAuth) {
      redirect(toSignInPath("/messages"));
    }

    return (
      <MainContainer size="content">
        <EmptyState
          icon={TriangleAlert}
          title="Inbox unavailable"
          description={summariesResult.message}
        />
      </MainContainer>
    );
  }

  let threadError: string | null = null;
  let thread = null;
  const inbox = summariesResult.data.inbox;

  if (conversationId) {
    if (!isUuid(conversationId)) {
      threadError = "Conversation reference is invalid.";
      conversationId = "";
    } else {
      const threadResult = await loadMessagingThreadQuery({
        conversationId,
        limit: 400,
      });

      if (!threadResult.ok) {
        if (threadResult.requiresAuth) {
          redirect(
            toSignInPath(
              buildMessagesHref({
                conversationId,
                lane: requestedLane,
              })
            )
          );
        }

        threadError = threadResult.message;
      } else {
        thread = threadResult.data;
      }
    }
  }

  const initialLane: MessagingInboxLane =
    inbox.mode === "company_workspace"
      ? inbox.companyQueueAccess === "company_queue"
        ? normalizeMessagingInboxLane(
            normalizeParam(resolvedSearchParams.lane),
            "queue"
          )
        : "assigned"
      : "all";

  return (
    <MainContainer size="wide" className="space-y-4">
      <section className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Messages</Badge>
        <h1 className="type-page-title max-w-4xl">
          {inbox.mode === "company_workspace"
            ? inbox.companyQueueAccess === "company_queue"
              ? `${inbox.workspaceName} inbox with shared queue and assigned thread lanes.`
              : `${inbox.workspaceName} inbox for your assigned company threads.`
            : "Listing-bound conversations with protected participant access."}
        </h1>
        <p className="type-body-muted max-w-3xl">
          {inbox.mode === "company_workspace"
            ? inbox.companyQueueAccess === "company_queue"
              ? "Separate shared queue work from assigned follow-up so managers and owners can route inquiries without losing operational context."
              : "Focus on assigned conversations and respond directly from the right listing context without queue-management noise."
            : "Track listing inquiries, review message history, and respond in one inbox without leaving the marketplace workflow."}
        </p>
      </section>

      {handoffErrorMessage ? (
        <section className="border-destructive/35 bg-destructive/10 rounded-xl border px-4 py-3 text-sm">
          <p className="inline-flex items-center gap-1.5 font-semibold">
            <TriangleAlert className="size-4" aria-hidden="true" />
            Conversation handoff blocked
          </p>
          <p className="mt-1 text-xs text-destructive-foreground">{handoffErrorMessage}</p>
        </section>
      ) : null}

      {summariesResult.data.summaries.length === 0 ? (
        <EmptyState
          icon={MessageSquareMore}
          title="No conversations yet"
          description="Open a listing and use Contact to start a listing-bound thread. Your inbox will appear here."
        />
      ) : (
        <MessagesWorkspace
          key={`${initialLane}-${conversationId || "none"}-${summariesResult.data.summaries.length}-${summariesResult.data.summaries[0]?.conversation.id ?? "empty"}`}
          initialSummaries={summariesResult.data.summaries}
          initialInbox={inbox}
          initialLane={initialLane}
          selectedConversationId={conversationId || null}
          initialThread={thread}
          initialThreadError={threadError}
        />
      )}
    </MainContainer>
  );
}
