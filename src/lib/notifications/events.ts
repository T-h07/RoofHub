import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { createNotifications } from "./service";
import { NOTIFICATION_TYPES } from "./types";

function trimTo(value: string, maxLength: number) {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function toRoleLabel(role: string) {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "agent":
      return "Agent";
    default:
      return role;
  }
}

async function loadActiveOrganizationUserIds(input: {
  organizationId: string;
  roles?: Array<"owner" | "admin" | "manager" | "agent">;
}) {
  const adminSupabase = createAdminSupabaseClient();
  let query = adminSupabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", input.organizationId)
    .eq("member_status", "active");

  if (input.roles && input.roles.length > 0) {
    query = query.in("role", input.roles);
  }

  const { data, error } = await query;
  if (error || !data) {
    return [];
  }

  return data.map((row) => row.user_id);
}

function uniqueRecipients(recipientIds: Array<string | null | undefined>, actorUserId?: string | null) {
  const deduped = new Set<string>();

  for (const recipientId of recipientIds) {
    if (!recipientId || recipientId === actorUserId) {
      continue;
    }

    deduped.add(recipientId);
  }

  return [...deduped];
}

type KnownNotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

export async function notifyConversationMessageReceived(input: {
  conversationId: string;
  listingId: string;
  ownerMode: "individual_provider" | "company_workspace";
  organizationId: string | null;
  providerUserId: string;
  seekerUserId: string;
  assignedMemberUserId: string | null;
  senderUserId: string;
  senderDisplayName: string | null;
  messageId: string;
  messageBody: string;
}) {
  try {
    const senderLabel = trimTo(input.senderDisplayName ?? "A user", 60) || "A user";
    let recipients: string[] = [];

    if (input.ownerMode === "company_workspace") {
      if (input.senderUserId === input.seekerUserId) {
        if (input.assignedMemberUserId) {
          recipients = [input.assignedMemberUserId];
        } else if (input.organizationId) {
          recipients = await loadActiveOrganizationUserIds({
            organizationId: input.organizationId,
            roles: ["owner", "admin", "manager"],
          });
        }
      } else {
        recipients = [input.seekerUserId];
      }
    } else {
      recipients = [input.providerUserId, input.seekerUserId];
    }

    const targetRecipients = uniqueRecipients(recipients, input.senderUserId);
    if (targetRecipients.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    const preview = trimTo(input.messageBody, 120);
    const body = preview ? `${senderLabel}: ${preview}` : `${senderLabel} sent a new message.`;

    return createNotifications({
      notifications: targetRecipients.map((recipientId) => ({
        userId: recipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.messageReceived,
        title: "New message received",
        body,
        entityType: "conversation",
        entityId: input.conversationId,
        actionUrl: `/messages?conversationId=${input.conversationId}`,
        priority: 2,
        actorUserId: input.senderUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          message_id: input.messageId,
          owner_mode: input.ownerMode,
        },
      })),
    });
  } catch {
    return { ok: false as const, message: "notification_message_delivery_failed" };
  }
}

export async function notifyCompanyInviteReceived(input: {
  recipientUserId: string | null;
  organizationId: string;
  organizationName: string;
  inviteId: string;
  inviteToken: string;
  role: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
}) {
  try {
    if (!input.recipientUserId) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: [
        {
          userId: input.recipientUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.companyInviteReceived,
          title: "Company invite received",
          body: `You were invited to join ${input.organizationName} as ${toRoleLabel(input.role)}.`,
          entityType: "organization_invite",
          entityId: input.inviteId,
          actionUrl: `/profile/company/invites/${input.inviteToken}`,
          priority: 2,
          actorUserId: input.actorUserId,
          metadata: {
            organization_id: input.organizationId,
            invite_id: input.inviteId,
            invite_role: input.role,
          },
        },
      ],
    });
  } catch {
    return { ok: false as const, message: "notification_invite_delivery_failed" };
  }
}

export async function notifyConversationRoutingChanged(input: {
  conversationId: string;
  listingId: string;
  organizationId: string;
  actorUserId: string;
  previousAssigneeUserId: string | null;
  nextAssigneeUserId: string | null;
  eventType:
    | "messaging.conversation.assigned"
    | "messaging.conversation.reassigned"
    | "messaging.conversation.unassigned";
}) {
  try {
    let recipients: string[] = [];
    let type: KnownNotificationType = NOTIFICATION_TYPES.conversationAssigned;
    let title = "Conversation assigned";
    let body = "A company conversation was assigned to you.";

    if (input.eventType === "messaging.conversation.unassigned") {
      recipients = input.previousAssigneeUserId ? [input.previousAssigneeUserId] : [];
      type = NOTIFICATION_TYPES.conversationUnassigned;
      title = "Conversation unassigned";
      body = "A company conversation was moved back to the shared queue.";
    } else if (input.eventType === "messaging.conversation.reassigned") {
      recipients = uniqueRecipients(
        [input.previousAssigneeUserId, input.nextAssigneeUserId],
        input.actorUserId
      );
      type = NOTIFICATION_TYPES.conversationReassigned;
      title = "Conversation reassigned";
      body = "A company conversation assignment was updated.";
    } else {
      recipients = input.nextAssigneeUserId ? [input.nextAssigneeUserId] : [];
      type = NOTIFICATION_TYPES.conversationAssigned;
      title = "Conversation assigned";
      body = "A new company conversation was assigned to you.";
    }

    const targetRecipients = uniqueRecipients(recipients, input.actorUserId);
    if (targetRecipients.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: targetRecipients.map((recipientUserId) => ({
        userId: recipientUserId,
        organizationId: input.organizationId,
        type,
        title,
        body,
        entityType: "conversation",
        entityId: input.conversationId,
        actionUrl: `/messages?conversationId=${input.conversationId}`,
        priority: 2,
        actorUserId: input.actorUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          previous_assignee_user_id: input.previousAssigneeUserId,
          next_assignee_user_id: input.nextAssigneeUserId,
          event_type: input.eventType,
        },
      })),
    });
  } catch {
    return { ok: false as const, message: "notification_routing_delivery_failed" };
  }
}

export async function notifyListingWorkflowTransition(input: {
  listingId: string;
  organizationId: string;
  action: "submit_for_review" | "needs_changes" | "approve" | "publish" | "unpublish";
  actorUserId: string;
  createdByUserId: string;
  assignedAgentUserId: string | null;
}) {
  try {
    let recipients: string[] = [];

    if (input.action === "submit_for_review") {
      recipients = await loadActiveOrganizationUserIds({
        organizationId: input.organizationId,
        roles: ["owner", "admin", "manager"],
      });
    } else {
      recipients = [input.createdByUserId, input.assignedAgentUserId].filter(
        (value): value is string => Boolean(value)
      );
    }

    const targetRecipients = uniqueRecipients(recipients, input.actorUserId);
    if (targetRecipients.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    const typeByAction = {
      submit_for_review: NOTIFICATION_TYPES.listingSubmittedForReview,
      needs_changes: NOTIFICATION_TYPES.listingNeedsChanges,
      approve: NOTIFICATION_TYPES.listingApproved,
      publish: NOTIFICATION_TYPES.listingPublished,
      unpublish: NOTIFICATION_TYPES.listingUnpublished,
    } as const;

    const titleByAction = {
      submit_for_review: "Listing submitted for review",
      needs_changes: "Listing needs changes",
      approve: "Listing approved",
      publish: "Listing published",
      unpublish: "Listing unpublished",
    } as const;

    const bodyByAction = {
      submit_for_review: "A listing is ready for company review.",
      needs_changes: "A listing was returned with requested changes.",
      approve: "A listing has been approved and is ready to publish.",
      publish: "A listing is now live on RoofHub.",
      unpublish: "A listing was removed from public discovery.",
    } as const;

    return createNotifications({
      notifications: targetRecipients.map((recipientUserId) => ({
        userId: recipientUserId,
        organizationId: input.organizationId,
        type: typeByAction[input.action],
        title: titleByAction[input.action],
        body: bodyByAction[input.action],
        entityType: "listing",
        entityId: input.listingId,
        actionUrl: `/dashboard/listings/${input.listingId}/workflow`,
        priority: input.action === "submit_for_review" || input.action === "needs_changes" ? 3 : 2,
        actorUserId: input.actorUserId,
        metadata: {
          listing_id: input.listingId,
          action: input.action,
          created_by_user_id: input.createdByUserId,
          assigned_agent_user_id: input.assignedAgentUserId,
        },
      })),
    });
  } catch {
    return { ok: false as const, message: "notification_workflow_delivery_failed" };
  }
}
