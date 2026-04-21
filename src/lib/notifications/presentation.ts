import { formatConversationActivityLabel, formatConversationActivityTitle } from "@/lib/messaging/presentation";

import type { NotificationRecord } from "./types";
import { NOTIFICATION_TYPES } from "./types";

export const NOTIFICATION_SCOPE_FILTERS = ["all", "unread"] as const;

export type NotificationScopeFilter = (typeof NOTIFICATION_SCOPE_FILTERS)[number];

export const NOTIFICATION_CATEGORY_FILTERS = [
  "all",
  "messages",
  "listings",
  "company",
  "account",
] as const;

export type NotificationCategoryFilter = (typeof NOTIFICATION_CATEGORY_FILTERS)[number];

export type NotificationCategory = Exclude<NotificationCategoryFilter, "all">;

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  messages: "Messages",
  listings: "Listings",
  company: "Company",
  account: "Account",
};

const TYPE_LABELS: Record<string, string> = {
  [NOTIFICATION_TYPES.messageReceived]: "Message",
  [NOTIFICATION_TYPES.conversationAssigned]: "Assigned",
  [NOTIFICATION_TYPES.conversationReassigned]: "Reassigned",
  [NOTIFICATION_TYPES.conversationUnassigned]: "Unassigned",
  [NOTIFICATION_TYPES.companyInviteReceived]: "Invite",
  [NOTIFICATION_TYPES.listingSubmittedForReview]: "Review",
  [NOTIFICATION_TYPES.listingNeedsChanges]: "Needs changes",
  [NOTIFICATION_TYPES.listingApproved]: "Approved",
  [NOTIFICATION_TYPES.listingPublished]: "Published",
  [NOTIFICATION_TYPES.listingUnpublished]: "Unpublished",
};

export function getNotificationCategory(type: string): NotificationCategory {
  if (type.startsWith("messaging.")) {
    return "messages";
  }

  if (type.startsWith("listing.workflow.")) {
    return "listings";
  }

  if (type.startsWith("organization.")) {
    return "company";
  }

  return "account";
}

export function getNotificationCategoryLabel(category: NotificationCategory) {
  return CATEGORY_LABELS[category];
}

export function getNotificationTypeLabel(type: string) {
  if (TYPE_LABELS[type]) {
    return TYPE_LABELS[type];
  }

  if (type.startsWith("messaging.")) {
    return "Message update";
  }

  if (type.startsWith("listing.workflow.")) {
    return "Listing update";
  }

  if (type.startsWith("organization.")) {
    return "Company update";
  }

  return "Account update";
}

export function getNotificationActionHref(notification: NotificationRecord) {
  const actionUrl = notification.action_url?.trim();
  if (actionUrl && actionUrl.startsWith("/")) {
    return actionUrl;
  }

  return "/notifications";
}

export function isNotificationUnread(notification: NotificationRecord) {
  return !notification.is_read;
}

export function formatNotificationTimestampLabel(value: string) {
  return formatConversationActivityLabel(value);
}

export function formatNotificationTimestampTitle(value: string) {
  return formatConversationActivityTitle(value);
}

export function applyNotificationFilters(
  notifications: NotificationRecord[],
  filters: {
    scope: NotificationScopeFilter;
    category: NotificationCategoryFilter;
  }
) {
  return notifications.filter((notification) => {
    if (filters.scope === "unread" && notification.is_read) {
      return false;
    }

    if (filters.category === "all") {
      return true;
    }

    return getNotificationCategory(notification.type) === filters.category;
  });
}

export function countUnreadNotifications(notifications: NotificationRecord[]) {
  return notifications.reduce((count, notification) => {
    return notification.is_read ? count : count + 1;
  }, 0);
}
