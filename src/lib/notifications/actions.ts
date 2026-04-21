"use server";

import { revalidatePath } from "next/cache";

import {
  getCurrentUserUnreadNotificationCount,
  listCurrentUserNotifications,
  markAllNotificationsReadForCurrentUser,
  markNotificationReadForCurrentUser,
} from "@/lib/notifications/service";

export async function loadCurrentUserNotificationsAction(input?: {
  limit?: number;
  unreadOnly?: boolean;
}) {
  return listCurrentUserNotifications(input);
}

export async function loadCurrentUserUnreadNotificationCountAction() {
  return getCurrentUserUnreadNotificationCount();
}

export async function markNotificationReadAction(input: { notificationId: string }) {
  const result = await markNotificationReadForCurrentUser(input);

  if (result.ok && result.data.changed) {
    revalidatePath("/", "layout");
  }

  return result;
}

export async function markAllNotificationsReadAction() {
  const result = await markAllNotificationsReadForCurrentUser();

  if (result.ok && result.data.changedCount > 0) {
    revalidatePath("/", "layout");
  }

  return result;
}
