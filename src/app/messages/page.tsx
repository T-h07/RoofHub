import { redirect } from "next/navigation";
import { MessageSquareMore, TriangleAlert } from "lucide-react";
import Link from "next/link";

import {
  PageIntro,
  PageNotice,
  PageSection,
  PageShell,
  PageState,
} from "@/components/layout/page-shell";
import { MessagesWorkspace } from "@/components/messages/messages-workspace";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
        <PageState
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
  const inboxDescription =
    inbox.mode === "company_workspace"
      ? inbox.companyQueueAccess === "company_queue"
        ? "Separate shared queue work from assigned follow-up so managers and owners can route inquiries without losing operational context."
        : "Focus on assigned conversations and respond directly from the right listing context without queue-management noise."
      : "Track listing inquiries, review message history, and respond in one inbox without leaving the marketplace workflow.";
  const introActions =
    inbox.mode === "company_workspace" ? (
      <>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Dashboard
        </Link>
        <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Listings
        </Link>
      </>
    ) : inbox.mode === "individual_provider" ? (
      <>
        <Link href="/dashboard/listings" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Listings
        </Link>
        <Link href="/dashboard" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Dashboard
        </Link>
      </>
    ) : (
      <Link href="/favorites" className={buttonVariants({ variant: "outline", size: "sm" })}>
        Saved listings
      </Link>
    );

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Messages</Badge>}
          title={
            inbox.mode === "company_workspace"
              ? inbox.companyQueueAccess === "company_queue"
                ? `${inbox.workspaceName} inbox with shared queue and assigned thread lanes.`
                : `${inbox.workspaceName} inbox for your assigned company threads.`
              : "Listing-bound conversations with protected participant access."
          }
          description={inboxDescription}
          actions={introActions}
        />

        {handoffErrorMessage ? (
          <PageNotice
            tone="danger"
            title="Conversation handoff blocked"
            description={handoffErrorMessage}
          />
        ) : null}

        <PageSection
          eyebrow={<Badge variant="outline">Inbox</Badge>}
          title="Conversation workload"
          description="Open the right thread quickly, then continue from assigned handling or queue-routing context."
        >
          {summariesResult.data.summaries.length === 0 ? (
            <PageState
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
        </PageSection>
      </PageShell>
    </MainContainer>
  );
}
