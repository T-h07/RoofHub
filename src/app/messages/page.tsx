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
import { InternalCompanyWorkspace } from "@/components/messages/internal-company-workspace";
import { ComposeTeamMessageButton } from "@/components/messages/compose-team-message-button";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { toSignInPath } from "@/lib/auth/routing";
import {
  createOrGetConversationForListingAction,
  loadInternalCompanyConversationSummariesQuery,
  loadInternalCompanyMemberOptionsQuery,
  loadInternalCompanyThreadQuery,
  loadMessagingConversationSummariesQuery,
  loadMessagingThreadQuery,
} from "@/lib/messaging";
import {
  normalizeMessagingInboxLane,
  normalizeMessagingSection,
  type MessagingInboxLane,
  type MessagingSection,
} from "@/lib/messaging/presentation";
import { isUuid } from "@/lib/messaging/validation";
import { cn } from "@/lib/utils";

type MessagesPageProps = {
  searchParams: Promise<{
    listingId?: string;
    conversationId?: string;
    lane?: string;
    section?: string;
  }>;
};

function normalizeParam(value: string | string[] | undefined) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildMessagesHref(input: {
  section?: MessagingSection;
  listingId?: string;
  conversationId?: string;
  lane?: MessagingInboxLane;
}) {
  const params = new URLSearchParams();

  if (input.section) {
    params.set("section", input.section);
  }

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

function SectionLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number | null;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
      )}
    >
      {label}
      {typeof count === "number" ? (
        <span className="ml-1 opacity-80">{new Intl.NumberFormat("en").format(count)}</span>
      ) : null}
    </Link>
  );
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const resolvedSearchParams = await searchParams;
  const listingId = normalizeParam(resolvedSearchParams.listingId);
  let conversationId = normalizeParam(resolvedSearchParams.conversationId);
  const requestedLane = normalizeMessagingInboxLane(
    normalizeParam(resolvedSearchParams.lane),
    "all"
  );
  const requestedSection = normalizeMessagingSection(
    normalizeParam(resolvedSearchParams.section),
    "outer_company"
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
              section: "outer_company",
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
          section: "outer_company",
        })
      );
    }
  }

  const externalSummariesResult = await loadMessagingConversationSummariesQuery({
    limit: 120,
  });

  if (!externalSummariesResult.ok) {
    if (externalSummariesResult.requiresAuth) {
      redirect(toSignInPath("/messages"));
    }

    return (
      <MainContainer size="content">
        <PageState
          icon={TriangleAlert}
          title="Inbox unavailable"
          description={externalSummariesResult.message}
        />
      </MainContainer>
    );
  }

  const inbox = externalSummariesResult.data.inbox;
  const isCompanyWorkspace = inbox.mode === "company_workspace";
  const activeSection: MessagingSection = isCompanyWorkspace ? requestedSection : "outer_company";

  let internalSummariesResult: Awaited<
    ReturnType<typeof loadInternalCompanyConversationSummariesQuery>
  > | null = null;
  let internalMemberOptionsResult: Awaited<
    ReturnType<typeof loadInternalCompanyMemberOptionsQuery>
  > | null = null;

  if (isCompanyWorkspace) {
    [internalSummariesResult, internalMemberOptionsResult] = await Promise.all([
      loadInternalCompanyConversationSummariesQuery({
        limit: 120,
      }),
      loadInternalCompanyMemberOptionsQuery(),
    ]);
  }

  let externalThreadError: string | null = null;
  let externalThread = null;

  let internalThreadError: string | null = null;
  let internalThread = null;

  if (conversationId) {
    if (!isUuid(conversationId)) {
      if (activeSection === "in_company") {
        internalThreadError = "Conversation reference is invalid.";
      } else {
        externalThreadError = "Conversation reference is invalid.";
      }
      conversationId = "";
    } else if (activeSection === "in_company") {
      if (!isCompanyWorkspace) {
        internalThreadError =
          "Internal company conversations require an active RoofHub company context.";
      } else {
        const internalThreadResult = await loadInternalCompanyThreadQuery({
          conversationId,
          limit: 400,
        });

        if (!internalThreadResult.ok) {
          if (internalThreadResult.requiresAuth) {
            redirect(
              toSignInPath(
                buildMessagesHref({
                  conversationId,
                  section: "in_company",
                })
              )
            );
          }

          internalThreadError = internalThreadResult.message;
        } else {
          internalThread = internalThreadResult.data;
        }
      }
    } else {
      const externalThreadResult = await loadMessagingThreadQuery({
        conversationId,
        limit: 400,
      });

      if (!externalThreadResult.ok) {
        if (externalThreadResult.requiresAuth) {
          redirect(
            toSignInPath(
              buildMessagesHref({
                conversationId,
                lane: requestedLane,
                section: "outer_company",
              })
            )
          );
        }

        externalThreadError = externalThreadResult.message;
      } else {
        externalThread = externalThreadResult.data;
      }
    }
  }

  const initialOuterLane: MessagingInboxLane =
    inbox.mode === "company_workspace"
      ? inbox.companyQueueAccess === "company_queue"
        ? normalizeMessagingInboxLane(normalizeParam(resolvedSearchParams.lane), "queue")
        : "assigned"
      : "all";

  const outerDescription =
    inbox.mode === "company_workspace"
      ? inbox.companyQueueAccess === "company_queue"
        ? "Client Inbox keeps seeker and client inquiries clear with distinct queue and assigned lanes."
        : "Client Inbox keeps your assigned client and inquiry conversations focused and actionable."
      : "Track listing inquiries, review message history, and respond in one inbox without leaving the RoofHub workflow.";

  const introDescription =
    isCompanyWorkspace && activeSection === "in_company"
      ? "Team Chat is your internal collaboration space for direct messages and group conversations between active company members."
      : outerDescription;

  const outerCount = externalSummariesResult.data.summaries.length;
  const internalCount =
    internalSummariesResult && internalSummariesResult.ok
      ? internalSummariesResult.data.summaries.length
      : null;

  const sectionSwitcher = isCompanyWorkspace ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="border-border/75 bg-card/55 inline-flex flex-wrap items-center gap-1 rounded-lg border p-1">
        <SectionLink
          href={buildMessagesHref({
            section: "outer_company",
            conversationId: activeSection === "outer_company" ? conversationId : undefined,
            lane: initialOuterLane,
          })}
          label="Client Inbox"
          count={outerCount}
          active={activeSection === "outer_company"}
        />
        <SectionLink
          href={buildMessagesHref({
            section: "in_company",
            conversationId: activeSection === "in_company" ? conversationId : undefined,
          })}
          label="Team Chat"
          count={internalCount}
          active={activeSection === "in_company"}
        />
      </div>
      {internalMemberOptionsResult && internalMemberOptionsResult.ok ? (
        <ComposeTeamMessageButton members={internalMemberOptionsResult.data} />
      ) : null}
    </div>
  ) : null;

  return (
    <MainContainer size="wide" className="space-y-5">
      <PageShell>
        <PageIntro
          eyebrow={<Badge variant="primary">Messages</Badge>}
          title={
            isCompanyWorkspace
              ? activeSection === "in_company"
                ? `${inbox.workspaceName} team chat`
                : `${inbox.workspaceName} client inbox`
              : "Listing-bound conversations with protected participant access."
          }
          description={introDescription}
        >
          {sectionSwitcher}
        </PageIntro>

        {handoffErrorMessage ? (
          <PageNotice
            tone="danger"
            title="Conversation handoff blocked"
            description={handoffErrorMessage}
          />
        ) : null}

        {activeSection === "in_company" ? (
          <PageSection
            eyebrow={<Badge variant="outline">Team Chat</Badge>}
            title="Internal company communication"
            description="Direct and group collaboration threads for active RoofHub company members."
            action={
              internalMemberOptionsResult && internalMemberOptionsResult.ok ? (
                <ComposeTeamMessageButton members={internalMemberOptionsResult.data} />
              ) : null
            }
          >
            {!isCompanyWorkspace ? (
              <PageState
                icon={TriangleAlert}
                title="Internal conversations unavailable"
                description="Team Chat is available only inside an active company context."
              />
            ) : !internalSummariesResult ? (
              <PageState
                icon={TriangleAlert}
                title="Internal conversations unavailable"
                description="Internal company conversations could not be loaded right now."
              />
            ) : !internalSummariesResult.ok ? (
              <PageState
                icon={TriangleAlert}
                title="Internal conversations unavailable"
                description={internalSummariesResult.message}
              />
            ) : (
              <InternalCompanyWorkspace
                workspaceName={inbox.workspaceName ?? "Company"}
                viewerUserId={inbox.viewerUserId}
                initialSummaries={internalSummariesResult.data.summaries}
                initialMembers={internalSummariesResult.data.members}
                selectedConversationId={conversationId || null}
                initialThread={internalThread}
                initialThreadError={internalThreadError}
              />
            )}
          </PageSection>
        ) : (
          <PageSection
            eyebrow={<Badge variant="outline">Client Inbox</Badge>}
            title={
              isCompanyWorkspace ? "Client and inquiry communication" : "Conversation workload"
            }
            description={
              isCompanyWorkspace
                ? "Listing-linked client and seeker communication with role-aware routing."
                : "Open the right thread quickly, then continue from assigned handling or queue-routing context."
            }
          >
            {externalSummariesResult.data.summaries.length === 0 ? (
              <PageState
                icon={MessageSquareMore}
                title="No conversations yet"
                description="Open a listing and use Contact to start a listing-bound thread. Your inbox will appear here."
              />
            ) : (
              <MessagesWorkspace
                key={`${initialOuterLane}-${conversationId || "none"}-${externalSummariesResult.data.summaries.length}-${externalSummariesResult.data.summaries[0]?.conversation.id ?? "empty"}`}
                initialSummaries={externalSummariesResult.data.summaries}
                initialInbox={inbox}
                initialLane={initialOuterLane}
                messageSection={isCompanyWorkspace ? "outer_company" : null}
                selectedConversationId={conversationId || null}
                initialThread={externalThread}
                initialThreadError={externalThreadError}
              />
            )}
          </PageSection>
        )}
      </PageShell>
    </MainContainer>
  );
}
