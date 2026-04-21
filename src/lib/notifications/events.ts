import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";

import { createNotifications } from "./service";
import { NOTIFICATION_TYPES } from "./types";
import type { CreateNotificationInput } from "./types";

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

export async function notifyConversationInquiryCreated(input: {
  conversationId: string;
  listingId: string;
  listingTitle: string;
  ownerMode: "individual_provider" | "company_workspace";
  organizationId: string | null;
  providerUserId: string;
  seekerUserId: string;
  assignedMemberUserId: string | null;
}) {
  try {
    const listingLabel = trimTo(input.listingTitle, 70) || "this listing";
    const notifications: CreateNotificationInput[] = [];

    if (input.ownerMode === "individual_provider") {
      notifications.push({
        userId: input.providerUserId,
        organizationId: null,
        type: NOTIFICATION_TYPES.inquiryReceived,
        title: "New inquiry received",
        body: `A seeker opened a new conversation on ${listingLabel}.`,
        entityType: "conversation",
        entityId: input.conversationId,
        actionUrl: `/messages?conversationId=${input.conversationId}`,
        priority: 3,
        actorUserId: input.seekerUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          owner_mode: input.ownerMode,
          routing_status: "direct_provider",
        },
      });
    } else if (input.assignedMemberUserId) {
      notifications.push({
        userId: input.assignedMemberUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.inquiryReceived,
        title: "New inquiry assigned to you",
        body: `A new inquiry was routed to you for ${listingLabel}.`,
        entityType: "conversation",
        entityId: input.conversationId,
        actionUrl: `/messages?conversationId=${input.conversationId}`,
        priority: 3,
        actorUserId: input.seekerUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          owner_mode: input.ownerMode,
          routing_status: "assigned_member",
          assigned_member_user_id: input.assignedMemberUserId,
        },
      });
    } else if (input.organizationId) {
      const managerRecipientIds = await loadActiveOrganizationUserIds({
        organizationId: input.organizationId,
        roles: ["owner", "admin", "manager"],
      });

      notifications.push(
        ...managerRecipientIds.map<CreateNotificationInput>((recipientUserId) => ({
          userId: recipientUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.inquiryReceived,
          title: "New inquiry in shared queue",
          body: `A new inquiry is waiting in the shared queue for ${listingLabel}.`,
          entityType: "conversation",
          entityId: input.conversationId,
          actionUrl: `/messages?conversationId=${input.conversationId}`,
          priority: 3,
          actorUserId: input.seekerUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            owner_mode: input.ownerMode,
            routing_status: "shared_queue",
          },
        }))
      );
    }

    const dedupedNotifications = notifications.filter(
      (notification) => notification.userId !== input.seekerUserId
    );

    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_inquiry_delivery_failed" };
  }
}

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
  isFirstMessageInConversation: boolean;
}) {
  try {
    if (input.isFirstMessageInConversation && input.senderUserId === input.seekerUserId) {
      return { ok: true as const, createdCount: 0 };
    }

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
  previousAssigneeDisplayName: string | null;
  nextAssigneeUserId: string | null;
  nextAssigneeDisplayName: string | null;
  eventType:
    | "messaging.conversation.assigned"
    | "messaging.conversation.reassigned"
    | "messaging.conversation.unassigned";
}) {
  try {
    const notifications: CreateNotificationInput[] = [];
    const managerRecipientIds = await loadActiveOrganizationUserIds({
      organizationId: input.organizationId,
      roles: ["owner", "admin", "manager"],
    });
    const managerRecipientSet = new Set(managerRecipientIds);

    const nextAssigneeLabel = trimTo(input.nextAssigneeDisplayName ?? "", 60) || "a team member";
    const previousAssigneeLabel =
      trimTo(input.previousAssigneeDisplayName ?? "", 60) || "the previous assignee";

    if (input.eventType === "messaging.conversation.assigned" && input.nextAssigneeUserId) {
      notifications.push({
        userId: input.nextAssigneeUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.conversationAssigned,
        title: "Conversation assigned to you",
        body: "A shared inquiry was assigned to you and needs follow-up.",
        entityType: "conversation",
        entityId: input.conversationId,
        actionUrl: `/messages?conversationId=${input.conversationId}`,
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          previous_assignee_user_id: input.previousAssigneeUserId,
          next_assignee_user_id: input.nextAssigneeUserId,
          event_type: input.eventType,
        },
      });

      for (const managerRecipientId of managerRecipientSet) {
        if (
          managerRecipientId === input.nextAssigneeUserId ||
          managerRecipientId === input.actorUserId
        ) {
          continue;
        }

        notifications.push({
          userId: managerRecipientId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationAssigned,
          title: "Conversation assigned",
          body: `A company conversation was assigned to ${nextAssigneeLabel}.`,
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
        });
      }
    } else if (input.eventType === "messaging.conversation.reassigned") {
      if (input.nextAssigneeUserId) {
        notifications.push({
          userId: input.nextAssigneeUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationReassigned,
          title: "Conversation reassigned to you",
          body: "A company inquiry was reassigned to you and needs attention.",
          entityType: "conversation",
          entityId: input.conversationId,
          actionUrl: `/messages?conversationId=${input.conversationId}`,
          priority: 3,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
          },
        });
      }

      if (
        input.previousAssigneeUserId &&
        input.previousAssigneeUserId !== input.nextAssigneeUserId
      ) {
        notifications.push({
          userId: input.previousAssigneeUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationUnassigned,
          title: "Conversation reassigned",
          body: "This conversation was reassigned to another company member.",
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
        });
      }

      for (const managerRecipientId of managerRecipientSet) {
        if (
          managerRecipientId === input.actorUserId ||
          managerRecipientId === input.previousAssigneeUserId ||
          managerRecipientId === input.nextAssigneeUserId
        ) {
          continue;
        }

        notifications.push({
          userId: managerRecipientId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationReassigned,
          title: "Conversation reassigned",
          body: `A company conversation was reassigned from ${previousAssigneeLabel} to ${nextAssigneeLabel}.`,
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
        });
      }
    } else if (input.eventType === "messaging.conversation.unassigned") {
      if (input.previousAssigneeUserId) {
        notifications.push({
          userId: input.previousAssigneeUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationUnassigned,
          title: "Conversation moved to shared queue",
          body: "This company conversation is no longer assigned to you.",
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
        });
      }

      for (const managerRecipientId of managerRecipientSet) {
        if (
          managerRecipientId === input.actorUserId ||
          managerRecipientId === input.previousAssigneeUserId
        ) {
          continue;
        }

        notifications.push({
          userId: managerRecipientId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.conversationUnassigned,
          title: "Conversation moved to shared queue",
          body: "A company conversation was returned to the shared queue.",
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
        });
      }
    }

    const dedupedNotifications = new Map<
      string,
      CreateNotificationInput & { type: KnownNotificationType }
    >();
    for (const notification of notifications) {
      if (
        notification.userId === input.actorUserId ||
        dedupedNotifications.has(`${notification.userId}:${notification.type}`)
      ) {
        continue;
      }

      dedupedNotifications.set(`${notification.userId}:${notification.type}`, {
        ...notification,
        type: notification.type as KnownNotificationType,
      });
    }

    if (dedupedNotifications.size === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: [...dedupedNotifications.values()],
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
