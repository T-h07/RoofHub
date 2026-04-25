import {
  formatConversationActivityLabel,
  formatConversationActivityTitle,
  normalizeMessagingSection,
  type MessagingSection,
} from "@/lib/messaging/presentation";

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
  [NOTIFICATION_TYPES.internalCompanyMessageReceived]: "Team message",
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
  [NOTIFICATION_TYPES.listingEditReviewNeeded]: "Edit review needed",
  [NOTIFICATION_TYPES.listingEditApproved]: "Edit approved",
  [NOTIFICATION_TYPES.listingEditNeedsChanges]: "Edit needs changes",
  [NOTIFICATION_TYPES.listingEditRejected]: "Edit rejected",
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

  if (type.startsWith("listing.")) {
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

function getMetadataStringValue(
  notification: NotificationRecord,
  key: string
) {
  const metadata =
    notification.metadata &&
    typeof notification.metadata === "object" &&
    !Array.isArray(notification.metadata)
      ? (notification.metadata as Record<string, unknown>)
      : null;
  const rawValue = metadata?.[key];
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalized = rawValue.trim();
  return normalized.length > 0 ? normalized : null;
}

function getConversationId(notification: NotificationRecord) {
  if (
    notification.entity_type === "conversation" &&
    typeof notification.entity_id === "string" &&
    notification.entity_id.trim().length > 0
  ) {
    return notification.entity_id.trim();
  }

  return getMetadataStringValue(notification, "conversation_id");
}

function getListingId(notification: NotificationRecord) {
  if (
    (notification.entity_type === "listing" ||
      notification.entity_type === "listing_edit_submission") &&
    typeof notification.entity_id === "string" &&
    notification.entity_id.trim().length > 0
  ) {
    return notification.entity_id.trim();
  }

  return getMetadataStringValue(notification, "listing_id");
}

function getConversationLane(notification: NotificationRecord) {
  const routingStatus = getMetadataStringValue(notification, "routing_status");
  const eventType = getMetadataStringValue(notification, "event_type");
  const nextAssigneeUserId = getMetadataStringValue(
    notification,
    "next_assignee_user_id"
  );

  if (routingStatus === "shared_queue") {
    return "queue" as const;
  }

  if (routingStatus === "assigned_member") {
    if (
      nextAssigneeUserId &&
      nextAssigneeUserId === notification.user_id
    ) {
      return "assigned" as const;
    }

    if (
      notification.type === NOTIFICATION_TYPES.conversationAssigned ||
      notification.type === NOTIFICATION_TYPES.conversationReassigned
    ) {
      return "queue" as const;
    }

    return "assigned" as const;
  }

  if (eventType === NOTIFICATION_TYPES.conversationUnassigned) {
    return "queue" as const;
  }

  if (
    eventType === NOTIFICATION_TYPES.conversationAssigned ||
    eventType === NOTIFICATION_TYPES.conversationReassigned
  ) {
    if (
      nextAssigneeUserId &&
      nextAssigneeUserId === notification.user_id
    ) {
      return "assigned" as const;
    }

    return "queue" as const;
  }

  return null;
}

function getMessageSection(notification: NotificationRecord): MessagingSection {
  const metadataSection = getMetadataStringValue(notification, "message_section");
  if (metadataSection === "in_company") {
    return "in_company";
  }

  if (metadataSection === "outer_company") {
    return "outer_company";
  }

  if (notification.type === NOTIFICATION_TYPES.internalCompanyMessageReceived) {
    return "in_company";
  }

  return "outer_company";
}

function withMessageContext(
  href: string,
  notification: NotificationRecord
) {
  const parsedUrl = new URL(href, "http://localhost");
  if (parsedUrl.pathname !== "/messages") {
    return href;
  }

  const conversationId =
    parsedUrl.searchParams.get("conversationId") ??
    getConversationId(notification);
  if (conversationId) {
    parsedUrl.searchParams.set("conversationId", conversationId);
  }

  const section = normalizeMessagingSection(
    parsedUrl.searchParams.get("section") ?? getMessageSection(notification),
    "outer_company"
  );
  parsedUrl.searchParams.set("section", section);

  if (section === "outer_company") {
    const lane =
      parsedUrl.searchParams.get("lane") ?? getConversationLane(notification);
    if (lane) {
      parsedUrl.searchParams.set("lane", lane);
    }
  } else {
    parsedUrl.searchParams.delete("lane");
  }

  const queryString = parsedUrl.searchParams.toString();
  return queryString ? `${parsedUrl.pathname}?${queryString}` : parsedUrl.pathname;
}

function getListingActionHref(notification: NotificationRecord) {
  const listingId = getListingId(notification);
  if (!listingId) {
    return "/dashboard/listings";
  }

  if (
    notification.type === NOTIFICATION_TYPES.listingEditApproved ||
    notification.type === NOTIFICATION_TYPES.listingEditNeedsChanges ||
    notification.type === NOTIFICATION_TYPES.listingEditRejected
  ) {
    return `/dashboard/listings/${listingId}/edit?step=review`;
  }

  return `/dashboard/listings/${listingId}/workflow`;
}

function getCompanyActionHref(notification: NotificationRecord) {
  if (notification.type === NOTIFICATION_TYPES.companyInviteReceived) {
    return "/profile/company";
  }

  if (
    notification.type === NOTIFICATION_TYPES.companyInviteAccepted ||
    notification.type === NOTIFICATION_TYPES.companyMemberAdded ||
    notification.type === NOTIFICATION_TYPES.companyMemberRoleChanged ||
    notification.type === NOTIFICATION_TYPES.companyMemberSuspended ||
    notification.type === NOTIFICATION_TYPES.companyMemberRemoved
  ) {
    return "/profile/company/team";
  }

  return "/profile/company";
}

export function getNotificationActionHref(notification: NotificationRecord) {
  const actionUrl = notification.action_url?.trim();
  if (actionUrl && actionUrl.startsWith("/") && !actionUrl.startsWith("//")) {
    if (actionUrl.startsWith("/messages")) {
      return withMessageContext(actionUrl, notification);
    }

    return actionUrl;
  }

  const category = getNotificationCategory(notification.type);

  if (category === "messages") {
    return withMessageContext("/messages", notification);
  }

  if (category === "listings") {
    return getListingActionHref(notification);
  }

  if (category === "company") {
    return getCompanyActionHref(notification);
  }

  return "/notifications";
}

export function getNotificationActionLabel(notification: NotificationRecord) {
  const href = getNotificationActionHref(notification);

  if (href.startsWith("/messages")) {
    const parsedHref = new URL(href, "http://localhost");
    const section = normalizeMessagingSection(
      parsedHref.searchParams.get("section"),
      "outer_company"
    );
    if (section === "in_company") {
      return "Open team thread";
    }

    const lane = parsedHref.searchParams.get("lane");

    if (
      notification.type === NOTIFICATION_TYPES.conversationAssigned ||
      notification.type === NOTIFICATION_TYPES.conversationReassigned
    ) {
      return lane === "queue" ? "Open queue thread" : "Open assigned thread";
    }

    if (notification.type === NOTIFICATION_TYPES.conversationUnassigned) {
      return "Open queue thread";
    }

    return lane === "queue" ? "Open queue thread" : "Open thread";
  }

  if (href.includes("/workflow")) {
    return "Open workflow";
  }

  if (href.includes("/edit?")) {
    return "Open listing draft";
  }

  if (href.startsWith("/dashboard/listings")) {
    return "Open listing";
  }

  if (href.startsWith("/profile/company/invites/")) {
    return "Open invite";
  }

  if (href.startsWith("/profile/company/team")) {
    return "Open team";
  }

  if (href.startsWith("/profile/company")) {
    return "Open company";
  }

  return "Open notification";
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
