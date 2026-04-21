import type { Tables } from "@/types/database";

export const NOTIFICATION_TYPES = {
  inquiryReceived: "messaging.inquiry.received",
  messageReceived: "messaging.message.received",
  conversationAssigned: "messaging.conversation.assigned",
  conversationReassigned: "messaging.conversation.reassigned",
  conversationUnassigned: "messaging.conversation.unassigned",
  companyInviteReceived: "organization.invite.received",
  listingSubmittedForReview: "listing.workflow.submitted_for_review",
  listingApprovalNeeded: "listing.workflow.approval_needed",
  listingNeedsChanges: "listing.workflow.needs_changes",
  listingApproved: "listing.workflow.approved",
  listingPublished: "listing.workflow.published",
  listingUnpublished: "listing.workflow.unpublished",
} as const;

export type NotificationType =
  | (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
  | (string & {});

export type NotificationPriority = 1 | 2 | 3;

export type NotificationRecord = Pick<
  Tables<"notifications">,
  | "id"
  | "user_id"
  | "organization_id"
  | "type"
  | "title"
  | "body"
  | "entity_type"
  | "entity_id"
  | "action_url"
  | "priority"
  | "is_read"
  | "read_at"
  | "actor_user_id"
  | "metadata"
  | "created_at"
>;

export type CreateNotificationInput = {
  userId: string;
  organizationId?: string | null;
  type: NotificationType;
  title: string;
  body?: string;
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  priority?: NotificationPriority;
  actorUserId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type NotificationReadMutationResult = {
  notificationId: string;
  changed: boolean;
};

export type NotificationListResult = {
  notifications: NotificationRecord[];
};

export type NotificationUnreadCountResult = {
  unreadCount: number;
};

export type NotificationResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | {
      ok: false;
      message: string;
      requiresAuth: boolean;
    };
