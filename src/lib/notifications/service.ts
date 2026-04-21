import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeSecurityMetadata } from "@/lib/security/audit";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Json, TablesInsert } from "@/types/database";

import type {
  CreateNotificationInput,
  NotificationListResult,
  NotificationReadMutationResult,
  NotificationRecord,
  NotificationResult,
  NotificationUnreadCountResult,
} from "./types";

type NotificationInsertRow = TablesInsert<"notifications">;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function normalizeBoundedText(value: string | null | undefined, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > maxLength ? normalized.slice(0, maxLength) : normalized;
}

function normalizeActionUrl(value: string | null | undefined) {
  const normalized = normalizeBoundedText(value, 512);
  if (!normalized) {
    return null;
  }

  return normalized.startsWith("/") ? normalized : null;
}

function normalizePriority(value: number | null | undefined): 1 | 2 | 3 {
  if (value === 1 || value === 3) {
    return value;
  }

  return 2;
}

function toInsertRow(input: CreateNotificationInput): NotificationInsertRow | null {
  if (!isUuid(input.userId)) {
    return null;
  }

  const type = normalizeBoundedText(input.type, 80);
  const title = normalizeBoundedText(input.title, 160);
  if (!type || !title) {
    return null;
  }

  const body = normalizeBoundedText(input.body ?? "", 2000) ?? "";
  const entityType = normalizeBoundedText(input.entityType, 80);
  const entityId = normalizeBoundedText(input.entityId, 160);
  const actionUrl = normalizeActionUrl(input.actionUrl);

  return {
    user_id: input.userId,
    organization_id: isUuid(input.organizationId ?? null) ? input.organizationId : null,
    type,
    title,
    body,
    entity_type: entityType,
    entity_id: entityId,
    action_url: actionUrl,
    priority: normalizePriority(input.priority),
    actor_user_id: isUuid(input.actorUserId ?? null) ? input.actorUserId : null,
    metadata: sanitizeSecurityMetadata(input.metadata ?? {}) as Json,
  };
}

function clampLimit(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(100, Math.trunc(value)));
}

async function requireCurrentUserId(
  supabase: SupabaseClient<Database>
): Promise<{ ok: true; userId: string } | { ok: false; message: string; requiresAuth: boolean }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isUuid(user.id)) {
    return {
      ok: false,
      message: "Sign in to access notifications.",
      requiresAuth: true,
    };
  }

  return {
    ok: true,
    userId: user.id,
  };
}

export async function createNotifications(input: {
  notifications: CreateNotificationInput[];
}): Promise<{ ok: true; createdCount: number } | { ok: false; message: string }> {
  const rows = input.notifications
    .map((notification) => toInsertRow(notification))
    .filter((row): row is NotificationInsertRow => Boolean(row));

  if (rows.length === 0) {
    return {
      ok: true,
      createdCount: 0,
    };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { error } = await adminSupabase.from("notifications").insert(rows);

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    createdCount: rows.length,
  };
}

export async function createNotification(
  input: CreateNotificationInput
): Promise<{ ok: true; createdCount: number } | { ok: false; message: string }> {
  return createNotifications({ notifications: [input] });
}

export async function listCurrentUserNotifications(input?: {
  limit?: number;
  unreadOnly?: boolean;
}): Promise<NotificationResult<NotificationListResult>> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const limit = clampLimit(input?.limit, 30);
  let query = supabase
    .from("notifications")
    .select(
      "id, user_id, organization_id, type, title, body, entity_type, entity_id, action_url, priority, is_read, read_at, actor_user_id, metadata, created_at"
    )
    .eq("user_id", userResult.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input?.unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false,
      message: "Notifications could not be loaded right now.",
      requiresAuth: false,
    };
  }

  return {
    ok: true,
    data: {
      notifications: (data ?? []) as NotificationRecord[],
    },
  };
}

export async function getCurrentUserUnreadNotificationCount(): Promise<
  NotificationResult<NotificationUnreadCountResult>
> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const unreadCount = await getUnreadNotificationCountForUser({
    supabase,
    userId: userResult.userId,
  });

  return {
    ok: true,
    data: {
      unreadCount,
    },
  };
}

export async function getUnreadNotificationCountForUser(input: {
  supabase: SupabaseClient<Database>;
  userId: string;
}) {
  if (!isUuid(input.userId)) {
    return 0;
  }

  const { count, error } = await input.supabase
    .from("notifications")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", input.userId)
    .eq("is_read", false);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function markNotificationReadForCurrentUser(input: {
  notificationId: string;
}): Promise<NotificationResult<NotificationReadMutationResult>> {
  if (!isUuid(input.notificationId)) {
    return {
      ok: false,
      message: "Notification reference is invalid.",
      requiresAuth: false,
    };
  }

  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: nowIso,
    })
    .eq("id", input.notificationId)
    .eq("user_id", userResult.userId)
    .eq("is_read", false)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: "Notification read state could not be updated.",
      requiresAuth: false,
    };
  }

  return {
    ok: true,
    data: {
      notificationId: input.notificationId,
      changed: Boolean(data),
    },
  };
}

export async function markAllNotificationsReadForCurrentUser(): Promise<
  NotificationResult<{ changedCount: number }>
> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: nowIso,
    })
    .eq("user_id", userResult.userId)
    .eq("is_read", false)
    .select("id");

  if (error) {
    return {
      ok: false,
      message: "Notifications read state could not be updated.",
      requiresAuth: false,
    };
  }

  return {
    ok: true,
    data: {
      changedCount: data?.length ?? 0,
    },
  };
}
