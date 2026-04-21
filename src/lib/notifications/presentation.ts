import { formatConversationActivityLabel, formatConversationActivityTitle } from "@/lib/messaging/presentation";

import type {
  NotificationCategory,
  NotificationFeedScope,
  NotificationPriority,
  NotificationPriorityFilter,
  NotificationRecord,
} from "./types";
import { getNotificationCategoryFromType, NOTIFICATION_TYPES } from "./types";

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

export const NOTIFICATION_PRIORITY_FILTERS = ["all", "important", "urgent"] as const;

export type NotificationPriorityFilterValue =
  (typeof NOTIFICATION_PRIORITY_FILTERS)[number];

export const NOTIFICATION_FEED_FILTERS = [
  "active",
  "archived",
  "dismissed",
] as const;

export type NotificationFeedFilter = (typeof NOTIFICATION_FEED_FILTERS)[number];

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  messages: "Messages",
  listings: "Listings",
  company: "Company",
  account: "Account",
};

const TYPE_LABELS: Record<string, string> = {
  [NOTIFICATION_TYPES.inquiryReceived]: "New inquiry",
  [NOTIFICATION_TYPES.messageReceived]: "Message",
  [NOTIFICATION_TYPES.conversationAssigned]: "Assigned",
  [NOTIFICATION_TYPES.conversationReassigned]: "Reassigned",
  [NOTIFICATION_TYPES.conversationUnassigned]: "Unassigned",
  [NOTIFICATION_TYPES.companyInviteReceived]: "Invite",
  [NOTIFICATION_TYPES.companyInviteAccepted]: "Invite accepted",
  [NOTIFICATION_TYPES.companyMemberAdded]: "Member added",
  [NOTIFICATION_TYPES.companyMemberRoleChanged]: "Role changed",
  [NOTIFICATION_TYPES.companyMemberSuspended]: "Suspended",
  [NOTIFICATION_TYPES.companyMemberRemoved]: "Removed",
  [NOTIFICATION_TYPES.listingSubmittedForReview]: "Submitted",
  [NOTIFICATION_TYPES.listingApprovalNeeded]: "Approval needed",
  [NOTIFICATION_TYPES.listingNeedsChanges]: "Needs changes",
  [NOTIFICATION_TYPES.listingApproved]: "Approved",
  [NOTIFICATION_TYPES.listingPublished]: "Published",
  [NOTIFICATION_TYPES.listingUnpublished]: "Unpublished",
};

export function getNotificationCategory(type: string): NotificationCategory {
  return getNotificationCategoryFromType(type);
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

export function getNotificationPriorityLabel(priority: number) {
  if (priority >= 3) {
    return "Urgent";
  }

  if (priority >= 2) {
    return "Important";
  }

  return "Normal";
}

export function getNotificationPriorityBadgeVariant(
  priority: number
): "neutral" | "warning" | "destructive" {
  if (priority >= 3) {
    return "destructive";
  }

  if (priority >= 2) {
    return "warning";
  }

  return "neutral";
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

export function isNotificationDismissed(notification: NotificationRecord) {
  return Boolean(notification.dismissed_at);
}

export function isNotificationArchived(notification: NotificationRecord) {
  return Boolean(notification.archived_at);
}

export function isNotificationActive(notification: NotificationRecord) {
  return !notification.dismissed_at && !notification.archived_at;
}

export function formatNotificationTimestampLabel(value: string) {
  return formatConversationActivityLabel(value);
}

export function formatNotificationTimestampTitle(value: string) {
  return formatConversationActivityTitle(value);
}

function passesFeedFilter(
  notification: NotificationRecord,
  feed: NotificationFeedScope
) {
  if (feed === "all") {
    return true;
  }

  if (feed === "archived") {
    return isNotificationArchived(notification);
  }

  if (feed === "dismissed") {
    return isNotificationDismissed(notification);
  }

  return isNotificationActive(notification);
}

function passesPriorityFilter(
  notification: NotificationRecord,
  priorityFilter: NotificationPriorityFilter
) {
  if (priorityFilter === "urgent") {
    return notification.priority >= 3;
  }

  if (priorityFilter === "important") {
    return notification.priority >= 2;
  }

  return true;
}

export function applyNotificationFilters(
  notifications: NotificationRecord[],
  filters: {
    feed: NotificationFeedScope;
    scope: NotificationScopeFilter;
    category: NotificationCategoryFilter;
    priority: NotificationPriorityFilter;
  }
) {
  return notifications.filter((notification) => {
    if (!passesFeedFilter(notification, filters.feed)) {
      return false;
    }

    if (filters.scope === "unread" && notification.is_read) {
      return false;
    }

    if (filters.category !== "all") {
      const category = getNotificationCategory(notification.type);
      if (category !== filters.category) {
        return false;
      }
    }

    return passesPriorityFilter(notification, filters.priority);
  });
}

export function countUnreadNotifications(
  notifications: NotificationRecord[],
  options?: { activeOnly?: boolean }
) {
  const activeOnly = options?.activeOnly ?? true;

  return notifications.reduce((count, notification) => {
    if (activeOnly && !isNotificationActive(notification)) {
      return count;
    }

    return notification.is_read ? count : count + 1;
  }, 0);
}

export function sortNotificationsForFeed(
  notifications: NotificationRecord[],
  options?: { prioritize?: boolean }
) {
  const prioritize = options?.prioritize ?? false;

  return [...notifications].sort((left, right) => {
    if (prioritize) {
      const priorityDelta = (right.priority as NotificationPriority) - (left.priority as NotificationPriority);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }
    }

    return (
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    );
  });
}
