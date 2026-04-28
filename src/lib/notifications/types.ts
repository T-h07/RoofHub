import type { Tables } from "@/types/database";

export const NOTIFICATION_TYPES = {
  inquiryReceived: "messaging.inquiry.received",
  messageReceived: "messaging.message.received",
  conversationAssigned: "messaging.conversation.assigned",
  conversationReassigned: "messaging.conversation.reassigned",
  conversationUnassigned: "messaging.conversation.unassigned",
  companyInviteReceived: "organization.invite.received",
  companyInviteAccepted: "organization.invite.accepted",
  companyMemberAdded: "organization.member.added",
  companyMemberRoleChanged: "organization.member.role_changed",
  companyMemberSuspended: "organization.member.suspended",
  companyMemberRemoved: "organization.member.removed",
  listingSubmittedForReview: "listing.workflow.submitted_for_review",
  listingApprovalNeeded: "listing.workflow.approval_needed",
  listingNeedsChanges: "listing.workflow.needs_changes",
  listingApproved: "listing.workflow.approved",
  listingPublished: "listing.workflow.published",
  listingUnpublished: "listing.workflow.unpublished",
  listingEditReviewNeeded: "listing.edit.review_needed",
  listingEditApproved: "listing.edit.approved",
  listingEditNeedsChanges: "listing.edit.needs_changes",
  listingEditRejected: "listing.edit.rejected",
} as const;

export type NotificationType =
  | (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES]
  | (string & {});

export const NOTIFICATION_CATEGORY_VALUES = [
  "messages",
  "listings",
  "company",
  "account",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORY_VALUES)[number];

export const NOTIFICATION_PREFERENCE_MODE_VALUES = [
  "all",
  "important_only",
  "mute",
] as const;

export type NotificationPreferenceMode =
  (typeof NOTIFICATION_PREFERENCE_MODE_VALUES)[number];

export type NotificationPriority = 1 | 2 | 3;

export type NotificationPriorityFilter = "all" | "important" | "urgent";

export type NotificationFeedScope = "active" | "archived" | "dismissed" | "all";

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
  | "dismissed_at"
  | "archived_at"
  | "actor_user_id"
  | "metadata"
  | "created_at"
>;

export type NotificationPreferenceRecord = Pick<
  Tables<"notification_preferences">,
  | "user_id"
  | "messages_mode"
  | "listings_mode"
  | "company_mode"
  | "account_mode"
  | "created_at"
  | "updated_at"
>;

export type NotificationPreferenceMap = Record<
  NotificationCategory,
  NotificationPreferenceMode
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

export type NotificationBulkMutationResult = {
  changedCount: number;
};

export type NotificationListResult = {
  notifications: NotificationRecord[];
};

export type NotificationPreferenceResult = {
  preferences: NotificationPreferenceRecord;
};

export type NotificationUnreadCountResult = {
  unreadCount: number;
};

export type NotificationPreferenceUpdateInput = {
  category: NotificationCategory;
  mode: NotificationPreferenceMode;
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

export function getNotificationCategoryFromType(type: string): NotificationCategory {
  if (type.startsWith("messaging.")) {
    return "messages";
  }

  if (type.startsWith("listing.")) {
    return "listings";
  }

  if (type.startsWith("organization.")) {
    return "company";
  }

  return "account";
}

export function isNotificationPreferenceMode(
  value: unknown
): value is NotificationPreferenceMode {
  return (
    typeof value === "string" &&
    (NOTIFICATION_PREFERENCE_MODE_VALUES as readonly string[]).includes(value)
  );
}

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return (
    typeof value === "string" &&
    (NOTIFICATION_CATEGORY_VALUES as readonly string[]).includes(value)
  );
}
