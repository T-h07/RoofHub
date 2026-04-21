"use server";

import { revalidatePath } from "next/cache";

import {
  archiveNotificationForCurrentUser,
  archiveReadLowPriorityNotificationsForCurrentUser,
  dismissNotificationForCurrentUser,
  getCurrentUserNotificationPreferences,
  getCurrentUserUnreadNotificationCount,
  listCurrentUserNotifications,
  markAllNotificationsReadForCurrentUser,
  markNotificationReadForCurrentUser,
  restoreNotificationForCurrentUser,
  updateCurrentUserNotificationPreference,
} from "@/lib/notifications/service";
import type {
  NotificationFeedScope,
  NotificationPreferenceUpdateInput,
  NotificationPriorityFilter,
} from "@/lib/notifications/types";

export async function loadCurrentUserNotificationsAction(input?: {
  limit?: number;
  unreadOnly?: boolean;
  scope?: NotificationFeedScope;
  priorityFilter?: NotificationPriorityFilter;
  order?: "recent" | "priority_then_recent";
}) {
  return listCurrentUserNotifications(input);
}

export async function loadCurrentUserUnreadNotificationCountAction() {
  return getCurrentUserUnreadNotificationCount();
}

export async function loadCurrentUserNotificationPreferencesAction() {
  return getCurrentUserNotificationPreferences();
}

export async function updateNotificationCategoryPreferenceAction(
  input: NotificationPreferenceUpdateInput
) {
  const result = await updateCurrentUserNotificationPreference(input);

  if (result.ok) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function markNotificationReadAction(input: { notificationId: string }) {
  const result = await markNotificationReadForCurrentUser(input);

  if (result.ok && result.data.changed) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function markAllNotificationsReadAction() {
  const result = await markAllNotificationsReadForCurrentUser();

  if (result.ok && result.data.changedCount > 0) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function dismissNotificationAction(input: { notificationId: string }) {
  const result = await dismissNotificationForCurrentUser(input);

  if (result.ok && result.data.changed) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function archiveNotificationAction(input: { notificationId: string }) {
  const result = await archiveNotificationForCurrentUser(input);

  if (result.ok && result.data.changed) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function restoreNotificationAction(input: { notificationId: string }) {
  const result = await restoreNotificationForCurrentUser(input);

  if (result.ok && result.data.changed) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}

export async function archiveLowPriorityNotificationsAction(input?: {
  olderThanDays?: number;
}) {
  const result = await archiveReadLowPriorityNotificationsForCurrentUser(input);

  if (result.ok && result.data.changedCount > 0) {
    revalidatePath("/", "layout");
    revalidatePath("/notifications");
  }

  return result;
}
