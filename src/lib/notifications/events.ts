import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { CompanyListingEditReviewAction } from "@/lib/listings/company-workflow/types";

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

function toMemberLabel(value: string | null | undefined) {
  return trimTo(value ?? "", 60) || "A team member";
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

async function loadManagerAwareRecipientIds(organizationId: string) {
  return loadActiveOrganizationUserIds({
    organizationId,
    roles: ["owner", "admin", "manager"],
  });
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

type ConversationNotificationLane = "assigned" | "queue";

function dedupeNotificationsByUserAndType(
  notifications: Array<CreateNotificationInput & { type: KnownNotificationType }>
) {
  const dedupedNotifications = new Map<
    string,
    CreateNotificationInput & { type: KnownNotificationType }
  >();

  for (const notification of notifications) {
    dedupedNotifications.set(`${notification.userId}:${notification.type}`, notification);
  }

  return [...dedupedNotifications.values()];
}

function buildConversationNotificationActionUrl(
  conversationId: string,
  lane?: ConversationNotificationLane | null
) {
  const params = new URLSearchParams({
    conversationId,
  });

  if (lane) {
    params.set("lane", lane);
  }

  return `/messages?${params.toString()}`;
}

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
        actionUrl: buildConversationNotificationActionUrl(input.conversationId),
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
        actionUrl: buildConversationNotificationActionUrl(input.conversationId, "assigned"),
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
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

    const routingStatus =
      input.ownerMode === "company_workspace"
        ? input.assignedMemberUserId
          ? "assigned_member"
          : "shared_queue"
        : "direct_provider";

    const getRecipientLane = (
      recipientId: string
    ): ConversationNotificationLane | null => {
      if (input.ownerMode !== "company_workspace") {
        return null;
      }

      if (recipientId === input.seekerUserId) {
        return null;
      }

      if (input.assignedMemberUserId && recipientId === input.assignedMemberUserId) {
        return "assigned";
      }

      return input.assignedMemberUserId ? "assigned" : "queue";
    };

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
        actionUrl: buildConversationNotificationActionUrl(
          input.conversationId,
          getRecipientLane(recipientId)
        ),
        priority: 2,
        actorUserId: input.senderUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          message_id: input.messageId,
          owner_mode: input.ownerMode,
          routing_status: routingStatus,
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

export async function notifyCompanyInviteAccepted(input: {
  organizationId: string;
  organizationName: string;
  inviteId: string;
  acceptedUserId: string;
  acceptedUserDisplayName: string | null;
  acceptedRole: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
  invitedByUserId: string | null;
}) {
  try {
    const acceptedMemberLabel = toMemberLabel(input.acceptedUserDisplayName);
    const managerRecipientIds = await loadManagerAwareRecipientIds(input.organizationId);
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    if (input.invitedByUserId && input.invitedByUserId !== input.actorUserId) {
      notifications.push({
        userId: input.invitedByUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyInviteAccepted,
        title: "Invite accepted",
        body: `${acceptedMemberLabel} joined ${input.organizationName} as ${toRoleLabel(input.acceptedRole)}.`,
        entityType: "organization_invite",
        entityId: input.inviteId,
        actionUrl: "/profile/company/team",
        priority: 1,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          invite_id: input.inviteId,
          accepted_user_id: input.acceptedUserId,
          accepted_role: input.acceptedRole,
        },
      });
    }

    for (const managerRecipientId of managerRecipientIds) {
      if (
        managerRecipientId === input.actorUserId ||
        managerRecipientId === input.invitedByUserId
      ) {
        continue;
      }

      notifications.push({
        userId: managerRecipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyInviteAccepted,
        title: "Team invite accepted",
        body: `${acceptedMemberLabel} joined ${input.organizationName} as ${toRoleLabel(input.acceptedRole)}.`,
        entityType: "organization_invite",
        entityId: input.inviteId,
        actionUrl: "/profile/company/team",
        priority: 1,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          invite_id: input.inviteId,
          accepted_user_id: input.acceptedUserId,
          accepted_role: input.acceptedRole,
        },
      });
    }

    const dedupedNotifications = dedupeNotificationsByUserAndType(notifications);
    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_invite_accept_delivery_failed" };
  }
}

export async function notifyCompanyMemberAdded(input: {
  organizationId: string;
  organizationName: string;
  memberUserId: string;
  memberDisplayName: string | null;
  memberRole: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
  includeSelfNotification?: boolean;
}) {
  try {
    const memberLabel = toMemberLabel(input.memberDisplayName);
    const managerRecipientIds = await loadManagerAwareRecipientIds(input.organizationId);
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    if (input.includeSelfNotification || input.memberUserId !== input.actorUserId) {
      notifications.push({
        userId: input.memberUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberAdded,
        title: "Added to company workspace",
        body: `You now have ${toRoleLabel(input.memberRole)} access in ${input.organizationName}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company",
        priority: 2,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    for (const managerRecipientId of managerRecipientIds) {
      if (
        managerRecipientId === input.actorUserId ||
        managerRecipientId === input.memberUserId
      ) {
        continue;
      }

      notifications.push({
        userId: managerRecipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberAdded,
        title: "Team member added",
        body: `${memberLabel} joined ${input.organizationName} as ${toRoleLabel(input.memberRole)}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company/team",
        priority: 1,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    const dedupedNotifications = dedupeNotificationsByUserAndType(notifications);
    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_member_added_delivery_failed" };
  }
}

export async function notifyCompanyMemberRoleChanged(input: {
  organizationId: string;
  organizationName: string;
  memberUserId: string;
  memberDisplayName: string | null;
  previousRole: "owner" | "admin" | "manager" | "agent";
  nextRole: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
}) {
  try {
    const memberLabel = toMemberLabel(input.memberDisplayName);
    const managerRecipientIds = await loadManagerAwareRecipientIds(input.organizationId);
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    if (input.memberUserId !== input.actorUserId) {
      notifications.push({
        userId: input.memberUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberRoleChanged,
        title: "Company role updated",
        body: `Your role in ${input.organizationName} is now ${toRoleLabel(input.nextRole)}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company",
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          previous_role: input.previousRole,
          next_role: input.nextRole,
        },
      });
    }

    for (const managerRecipientId of managerRecipientIds) {
      if (
        managerRecipientId === input.actorUserId ||
        managerRecipientId === input.memberUserId
      ) {
        continue;
      }

      notifications.push({
        userId: managerRecipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberRoleChanged,
        title: "Team role changed",
        body: `${memberLabel} is now ${toRoleLabel(input.nextRole)} in ${input.organizationName}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company/team",
        priority: 1,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          previous_role: input.previousRole,
          next_role: input.nextRole,
        },
      });
    }

    const dedupedNotifications = dedupeNotificationsByUserAndType(notifications);
    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_member_role_change_delivery_failed" };
  }
}

export async function notifyCompanyMemberSuspended(input: {
  organizationId: string;
  organizationName: string;
  memberUserId: string;
  memberDisplayName: string | null;
  memberRole: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
}) {
  try {
    const memberLabel = toMemberLabel(input.memberDisplayName);
    const managerRecipientIds = await loadManagerAwareRecipientIds(input.organizationId);
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    if (input.memberUserId !== input.actorUserId) {
      notifications.push({
        userId: input.memberUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberSuspended,
        title: "Company access suspended",
        body: `Your access to ${input.organizationName} is currently suspended.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company",
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    for (const managerRecipientId of managerRecipientIds) {
      if (
        managerRecipientId === input.actorUserId ||
        managerRecipientId === input.memberUserId
      ) {
        continue;
      }

      notifications.push({
        userId: managerRecipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberSuspended,
        title: "Team member suspended",
        body: `${memberLabel} was suspended in ${input.organizationName}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company/team",
        priority: 2,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    const dedupedNotifications = dedupeNotificationsByUserAndType(notifications);
    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_member_suspended_delivery_failed" };
  }
}

export async function notifyCompanyMemberRemoved(input: {
  organizationId: string;
  organizationName: string;
  memberUserId: string;
  memberDisplayName: string | null;
  memberRole: "owner" | "admin" | "manager" | "agent";
  actorUserId: string;
}) {
  try {
    const memberLabel = toMemberLabel(input.memberDisplayName);
    const managerRecipientIds = await loadManagerAwareRecipientIds(input.organizationId);
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    if (input.memberUserId !== input.actorUserId) {
      notifications.push({
        userId: input.memberUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberRemoved,
        title: "Removed from company workspace",
        body: `You no longer have access to ${input.organizationName}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company",
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    for (const managerRecipientId of managerRecipientIds) {
      if (
        managerRecipientId === input.actorUserId ||
        managerRecipientId === input.memberUserId
      ) {
        continue;
      }

      notifications.push({
        userId: managerRecipientId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.companyMemberRemoved,
        title: "Team member removed",
        body: `${memberLabel} was removed from ${input.organizationName}.`,
        entityType: "organization_member",
        entityId: input.memberUserId,
        actionUrl: "/profile/company/team",
        priority: 2,
        actorUserId: input.actorUserId,
        metadata: {
          organization_id: input.organizationId,
          member_user_id: input.memberUserId,
          member_role: input.memberRole,
        },
      });
    }

    const dedupedNotifications = dedupeNotificationsByUserAndType(notifications);
    if (dedupedNotifications.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: dedupedNotifications,
    });
  } catch {
    return { ok: false as const, message: "notification_member_removed_delivery_failed" };
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
        actionUrl: buildConversationNotificationActionUrl(input.conversationId, "assigned"),
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          conversation_id: input.conversationId,
          listing_id: input.listingId,
          previous_assignee_user_id: input.previousAssigneeUserId,
          next_assignee_user_id: input.nextAssigneeUserId,
          event_type: input.eventType,
          routing_status: "assigned_member",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
          priority: 1,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "assigned_member",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "assigned"),
          priority: 3,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "assigned_member",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
          priority: 1,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "assigned_member",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
          priority: 1,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "assigned_member",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
          priority: 1,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "shared_queue",
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
          actionUrl: buildConversationNotificationActionUrl(input.conversationId, "queue"),
          priority: 1,
          actorUserId: input.actorUserId,
          metadata: {
            conversation_id: input.conversationId,
            listing_id: input.listingId,
            previous_assignee_user_id: input.previousAssigneeUserId,
            next_assignee_user_id: input.nextAssigneeUserId,
            event_type: input.eventType,
            routing_status: "shared_queue",
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
  listingTitle: string;
  organizationId: string;
  action: "submit_for_review" | "needs_changes" | "approve" | "publish" | "unpublish";
  actorUserId: string;
  createdByUserId: string;
  assignedAgentUserId: string | null;
}) {
  try {
    const listingLabel = trimTo(input.listingTitle, 72) || "this listing";
    const actionUrl = `/dashboard/listings/${input.listingId}/workflow`;
    const notifications: Array<CreateNotificationInput & { type: KnownNotificationType }> = [];

    const creatorAndAssigneeRecipients = uniqueRecipients(
      [input.createdByUserId, input.assignedAgentUserId],
      input.actorUserId
    );

    if (input.action === "submit_for_review") {
      const reviewerRecipients = await loadActiveOrganizationUserIds({
        organizationId: input.organizationId,
        roles: ["owner", "admin", "manager"],
      });
      const reviewerRecipientSet = new Set(reviewerRecipients);
      const approvalRecipients = uniqueRecipients(reviewerRecipients, input.actorUserId);
      const submittedRecipients = creatorAndAssigneeRecipients.filter(
        (recipientUserId) => !reviewerRecipientSet.has(recipientUserId)
      );

      notifications.push(
        ...approvalRecipients.map((recipientUserId) => ({
          userId: recipientUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.listingApprovalNeeded,
          title: "Approval needed",
          body: `${listingLabel} is waiting for company review.`,
          entityType: "listing",
          entityId: input.listingId,
          actionUrl,
          priority: 3 as const,
          actorUserId: input.actorUserId,
          metadata: {
            listing_id: input.listingId,
            action: input.action,
            created_by_user_id: input.createdByUserId,
            assigned_agent_user_id: input.assignedAgentUserId,
            workflow_attention: "approval_needed",
          },
        }))
      );

      notifications.push(
        ...submittedRecipients.map((recipientUserId) => ({
          userId: recipientUserId,
          organizationId: input.organizationId,
          type: NOTIFICATION_TYPES.listingSubmittedForReview,
          title: "Listing submitted for review",
          body: `${listingLabel} was moved into the company review queue.`,
          entityType: "listing",
          entityId: input.listingId,
          actionUrl,
          priority: 2 as const,
          actorUserId: input.actorUserId,
          metadata: {
            listing_id: input.listingId,
            action: input.action,
            created_by_user_id: input.createdByUserId,
            assigned_agent_user_id: input.assignedAgentUserId,
          },
        }))
      );
    } else {
      const workflowOutcomeAction = input.action as Exclude<
        typeof input.action,
        "submit_for_review"
      >;

      const typeByAction = {
        needs_changes: NOTIFICATION_TYPES.listingNeedsChanges,
        approve: NOTIFICATION_TYPES.listingApproved,
        publish: NOTIFICATION_TYPES.listingPublished,
        unpublish: NOTIFICATION_TYPES.listingUnpublished,
      } as const;

      const titleByAction = {
        needs_changes: "Listing needs changes",
        approve: "Listing approved",
        publish: "Listing published",
        unpublish: "Listing unpublished",
      } as const;

      const bodyByAction = {
        needs_changes: `${listingLabel} was returned with requested updates.`,
        approve: `${listingLabel} was approved and can now be published.`,
        publish: `${listingLabel} is now live on RoofHub.`,
        unpublish: `${listingLabel} is no longer visible in public discovery.`,
      } as const;

      notifications.push(
        ...creatorAndAssigneeRecipients.map((recipientUserId) => ({
          userId: recipientUserId,
          organizationId: input.organizationId,
          type: typeByAction[workflowOutcomeAction],
          title: titleByAction[workflowOutcomeAction],
          body: bodyByAction[workflowOutcomeAction],
          entityType: "listing",
          entityId: input.listingId,
          actionUrl,
          priority: workflowOutcomeAction === "needs_changes" ? (3 as const) : (2 as const),
          actorUserId: input.actorUserId,
          metadata: {
            listing_id: input.listingId,
            action: workflowOutcomeAction,
            created_by_user_id: input.createdByUserId,
            assigned_agent_user_id: input.assignedAgentUserId,
          },
        }))
      );
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

      dedupedNotifications.set(`${notification.userId}:${notification.type}`, notification);
    }

    if (dedupedNotifications.size === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: [...dedupedNotifications.values()],
    });
  } catch {
    return { ok: false as const, message: "notification_workflow_delivery_failed" };
  }
}

export async function notifyListingEditReviewSubmission(input: {
  listingId: string;
  listingTitle: string;
  organizationId: string;
  actorUserId: string;
  submittedByUserId: string;
}) {
  try {
    const listingLabel = trimTo(input.listingTitle, 72) || "this listing";
    const reviewerRecipientIds = await loadActiveOrganizationUserIds({
      organizationId: input.organizationId,
      roles: ["owner", "admin", "manager"],
    });

    const recipients = uniqueRecipients(reviewerRecipientIds, input.actorUserId);
    if (recipients.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    return createNotifications({
      notifications: recipients.map((recipientUserId) => ({
        userId: recipientUserId,
        organizationId: input.organizationId,
        type: NOTIFICATION_TYPES.listingEditReviewNeeded,
        title: "Live listing edit review needed",
        body: `${listingLabel} has pending live-edit updates waiting for review.`,
        entityType: "listing_edit_submission",
        entityId: input.listingId,
        actionUrl: `/dashboard/listings/${input.listingId}/workflow`,
        priority: 3,
        actorUserId: input.actorUserId,
        metadata: {
          listing_id: input.listingId,
          action: "edit_submission_submitted",
          submitted_by_user_id: input.submittedByUserId,
        },
      })),
    });
  } catch {
    return { ok: false as const, message: "notification_listing_edit_submission_delivery_failed" };
  }
}

export async function notifyListingEditReviewOutcome(input: {
  listingId: string;
  listingTitle: string;
  organizationId: string;
  action: CompanyListingEditReviewAction;
  actorUserId: string;
  submitterUserId: string;
  reviewerNote?: string;
}) {
  try {
    const recipients = uniqueRecipients([input.submitterUserId], input.actorUserId);
    if (recipients.length === 0) {
      return { ok: true as const, createdCount: 0 };
    }

    const listingLabel = trimTo(input.listingTitle, 72) || "this listing";
    const trimmedReviewerNote = trimTo(input.reviewerNote ?? "", 180);
    const typeByAction: Record<CompanyListingEditReviewAction, KnownNotificationType> = {
      approve: NOTIFICATION_TYPES.listingEditApproved,
      needs_changes: NOTIFICATION_TYPES.listingEditNeedsChanges,
      reject: NOTIFICATION_TYPES.listingEditRejected,
    };
    const titleByAction: Record<CompanyListingEditReviewAction, string> = {
      approve: "Live listing edits approved",
      needs_changes: "Live listing edits need changes",
      reject: "Live listing edits rejected",
    };
    const bodyByAction: Record<CompanyListingEditReviewAction, string> = {
      approve: `${listingLabel} was approved and is now updated on the public listing.`,
      needs_changes: `${listingLabel} needs additional updates before live changes can be applied.`,
      reject: `${listingLabel} edit submission was rejected and was not applied.`,
    };

    return createNotifications({
      notifications: recipients.map((recipientUserId) => ({
        userId: recipientUserId,
        organizationId: input.organizationId,
        type: typeByAction[input.action],
        title: titleByAction[input.action],
        body:
          input.action === "needs_changes" && trimmedReviewerNote
            ? `${bodyByAction[input.action]} Note: ${trimmedReviewerNote}`
            : bodyByAction[input.action],
        entityType: "listing_edit_submission",
        entityId: input.listingId,
        actionUrl: `/dashboard/listings/${input.listingId}/edit?step=review`,
        priority: input.action === "needs_changes" ? 3 : 2,
        actorUserId: input.actorUserId,
        metadata: {
          listing_id: input.listingId,
          action: input.action,
          submitter_user_id: input.submitterUserId,
          reviewer_note_present: Boolean(trimmedReviewerNote),
        },
      })),
    });
  } catch {
    return { ok: false as const, message: "notification_listing_edit_review_outcome_delivery_failed" };
  }
}
