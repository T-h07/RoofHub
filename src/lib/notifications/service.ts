import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeSecurityMetadata } from "@/lib/security/audit";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables, TablesInsert } from "@/types/database";

import type {
  CreateNotificationInput,
  NotificationBulkMutationResult,
  NotificationCategory,
  NotificationFeedScope,
  NotificationListResult,
  NotificationPreferenceMap,
  NotificationPreferenceMode,
  NotificationPreferenceRecord,
  NotificationPreferenceResult,
  NotificationPreferenceUpdateInput,
  NotificationPriorityFilter,
  NotificationReadMutationResult,
  NotificationRecord,
  NotificationResult,
  NotificationUnreadCountResult,
} from "./types";
import {
  getNotificationCategoryFromType,
  isNotificationCategory,
  isNotificationPreferenceMode,
} from "./types";

type NotificationInsertRow = TablesInsert<"notifications">;
type NotificationPreferenceInsertRow = TablesInsert<"notification_preferences">;
type NotificationPreferenceRow = Pick<
  Tables<"notification_preferences">,
  "user_id" | "messages_mode" | "listings_mode" | "company_mode" | "account_mode" | "created_at" | "updated_at"
>;
type NotificationPreferenceProfileRow = Pick<
  Tables<"profiles">,
  "id" | "role" | "provider_account_type"
>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PREFERENCE_SELECT =
  "user_id, messages_mode, listings_mode, company_mode, account_mode, created_at, updated_at";

const CATEGORY_COLUMN_BY_KEY = {
  messages: "messages_mode",
  listings: "listings_mode",
  company: "company_mode",
  account: "account_mode",
} as const;

const BASELINE_NOTIFICATION_PREFERENCES: NotificationPreferenceMap = {
  messages: "all",
  listings: "important_only",
  company: "important_only",
  account: "important_only",
};

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

function clampLimit(value: number | undefined, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.min(300, Math.trunc(value)));
}

function normalizePreferenceMode(
  value: unknown,
  fallback: NotificationPreferenceMode
): NotificationPreferenceMode {
  return isNotificationPreferenceMode(value) ? value : fallback;
}

function deriveDefaultPreferenceMap(
  profile: NotificationPreferenceProfileRow | null | undefined
): NotificationPreferenceMap {
  if (!profile) {
    return { ...BASELINE_NOTIFICATION_PREFERENCES };
  }

  if (profile.role === "seeker") {
    return {
      messages: "all",
      listings: "important_only",
      company: "mute",
      account: "important_only",
    };
  }

  if (profile.role === "provider") {
    if (profile.provider_account_type === "company") {
      return {
        messages: "all",
        listings: "all",
        company: "all",
        account: "important_only",
      };
    }

    return {
      messages: "all",
      listings: "all",
      company: "important_only",
      account: "important_only",
    };
  }

  if (profile.role === "admin") {
    return {
      messages: "important_only",
      listings: "all",
      company: "all",
      account: "all",
    };
  }

  return { ...BASELINE_NOTIFICATION_PREFERENCES };
}

function toPreferenceInsertRow(
  userId: string,
  preferences: NotificationPreferenceMap
): NotificationPreferenceInsertRow {
  return {
    user_id: userId,
    messages_mode: preferences.messages,
    listings_mode: preferences.listings,
    company_mode: preferences.company,
    account_mode: preferences.account,
  };
}

function toNotificationPreferenceRecord(
  input: {
    userId: string;
    row?: NotificationPreferenceRow | null;
    fallback: NotificationPreferenceMap;
  }
): NotificationPreferenceRecord {
  const nowIso = new Date().toISOString();

  return {
    user_id: input.userId,
    messages_mode: normalizePreferenceMode(
      input.row?.messages_mode,
      input.fallback.messages
    ),
    listings_mode: normalizePreferenceMode(
      input.row?.listings_mode,
      input.fallback.listings
    ),
    company_mode: normalizePreferenceMode(
      input.row?.company_mode,
      input.fallback.company
    ),
    account_mode: normalizePreferenceMode(
      input.row?.account_mode,
      input.fallback.account
    ),
    created_at: input.row?.created_at ?? nowIso,
    updated_at: input.row?.updated_at ?? nowIso,
  };
}

function toPreferenceMap(preferences: NotificationPreferenceRecord): NotificationPreferenceMap {
  return {
    messages: normalizePreferenceMode(
      preferences.messages_mode,
      BASELINE_NOTIFICATION_PREFERENCES.messages
    ),
    listings: normalizePreferenceMode(
      preferences.listings_mode,
      BASELINE_NOTIFICATION_PREFERENCES.listings
    ),
    company: normalizePreferenceMode(
      preferences.company_mode,
      BASELINE_NOTIFICATION_PREFERENCES.company
    ),
    account: normalizePreferenceMode(
      preferences.account_mode,
      BASELINE_NOTIFICATION_PREFERENCES.account
    ),
  };
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

function shouldDeliverByPreference(input: {
  category: NotificationCategory;
  priority: number;
  preferences: NotificationPreferenceMap;
}) {
  const mode = input.preferences[input.category];

  if (mode === "all") {
    return true;
  }

  if (mode === "important_only") {
    return input.priority >= 2;
  }

  return input.priority >= 3;
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

async function loadPreferenceMapForRecipients(input: {
  recipientUserIds: string[];
}): Promise<Map<string, NotificationPreferenceMap>> {
  const recipientUserIds = [...new Set(input.recipientUserIds.filter((value) => isUuid(value)))];
  const preferenceMap = new Map<string, NotificationPreferenceMap>();

  if (recipientUserIds.length === 0) {
    return preferenceMap;
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: preferenceRows } = await adminSupabase
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .in("user_id", recipientUserIds);

  for (const row of (preferenceRows ?? []) as NotificationPreferenceRow[]) {
    const fallback = { ...BASELINE_NOTIFICATION_PREFERENCES };
    const normalized = toNotificationPreferenceRecord({
      userId: row.user_id,
      row,
      fallback,
    });
    preferenceMap.set(row.user_id, toPreferenceMap(normalized));
  }

  const missingRecipientIds = recipientUserIds.filter((userId) => !preferenceMap.has(userId));
  if (missingRecipientIds.length === 0) {
    return preferenceMap;
  }

  const { data: profileRows } = await adminSupabase
    .from("profiles")
    .select("id, role, provider_account_type")
    .in("id", missingRecipientIds);

  const profilesById = new Map(
    ((profileRows ?? []) as NotificationPreferenceProfileRow[]).map((profile) => [
      profile.id,
      profile,
    ])
  );

  const preferenceInserts: NotificationPreferenceInsertRow[] = [];
  for (const userId of missingRecipientIds) {
    const defaultPreferences = deriveDefaultPreferenceMap(profilesById.get(userId));
    preferenceMap.set(userId, defaultPreferences);
    preferenceInserts.push(toPreferenceInsertRow(userId, defaultPreferences));
  }

  if (preferenceInserts.length > 0) {
    await adminSupabase
      .from("notification_preferences")
      .upsert(preferenceInserts, { onConflict: "user_id" });
  }

  return preferenceMap;
}

async function ensureCurrentUserPreferenceRecord(input: {
  supabase: SupabaseClient<Database>;
  userId: string;
}): Promise<NotificationPreferenceRecord | null> {
  const { data: profileRow } = await input.supabase
    .from("profiles")
    .select("id, role, provider_account_type")
    .eq("id", input.userId)
    .maybeSingle();

  const defaultPreferences = deriveDefaultPreferenceMap(
    (profileRow as NotificationPreferenceProfileRow | null) ?? null
  );

  const { data: existingRow, error: existingError } = await input.supabase
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .eq("user_id", input.userId)
    .maybeSingle();

  if (!existingError && existingRow) {
    return toNotificationPreferenceRecord({
      userId: input.userId,
      row: existingRow as NotificationPreferenceRow,
      fallback: defaultPreferences,
    });
  }

  const { data: insertedRow } = await input.supabase
    .from("notification_preferences")
    .insert(toPreferenceInsertRow(input.userId, defaultPreferences))
    .select(PREFERENCE_SELECT)
    .maybeSingle();

  if (insertedRow) {
    return toNotificationPreferenceRecord({
      userId: input.userId,
      row: insertedRow as NotificationPreferenceRow,
      fallback: defaultPreferences,
    });
  }

  const { data: fallbackRow } = await input.supabase
    .from("notification_preferences")
    .select(PREFERENCE_SELECT)
    .eq("user_id", input.userId)
    .maybeSingle();

  return fallbackRow
    ? toNotificationPreferenceRecord({
        userId: input.userId,
        row: fallbackRow as NotificationPreferenceRow,
        fallback: defaultPreferences,
      })
    : null;
}

export async function createNotifications(input: {
  notifications: CreateNotificationInput[];
}): Promise<{ ok: true; createdCount: number } | { ok: false; message: string }> {
  const normalized = input.notifications
    .map((notification) => {
      const row = toInsertRow(notification);
      if (!row) {
        return null;
      }

      return {
        row,
        category: getNotificationCategoryFromType(row.type),
      };
    })
    .filter(
      (value): value is { row: NotificationInsertRow; category: NotificationCategory } =>
        Boolean(value)
    );

  if (normalized.length === 0) {
    return {
      ok: true,
      createdCount: 0,
    };
  }

  const preferenceMap = await loadPreferenceMapForRecipients({
    recipientUserIds: normalized.map((item) => item.row.user_id),
  });

  const insertRows = normalized
    .filter((item) => {
      const recipientPreferences =
        preferenceMap.get(item.row.user_id) ?? BASELINE_NOTIFICATION_PREFERENCES;

      return shouldDeliverByPreference({
        category: item.category,
        priority: item.row.priority ?? 2,
        preferences: recipientPreferences,
      });
    })
    .map((item) => item.row);

  if (insertRows.length === 0) {
    return {
      ok: true,
      createdCount: 0,
    };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { error } = await adminSupabase.from("notifications").insert(insertRows);

  if (error) {
    return {
      ok: false,
      message: error.message,
    };
  }

  return {
    ok: true,
    createdCount: insertRows.length,
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
  scope?: NotificationFeedScope;
  priorityFilter?: NotificationPriorityFilter;
  order?: "recent" | "priority_then_recent";
}): Promise<NotificationResult<NotificationListResult>> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const limit = clampLimit(input?.limit, 40);
  const scope = input?.scope ?? "active";
  const priorityFilter = input?.priorityFilter ?? "all";
  const order = input?.order ?? "recent";

  let query = supabase
    .from("notifications")
    .select(
      "id, user_id, organization_id, type, title, body, entity_type, entity_id, action_url, priority, is_read, read_at, dismissed_at, archived_at, actor_user_id, metadata, created_at"
    )
    .eq("user_id", userResult.userId)
    .limit(limit);

  if (scope === "active") {
    query = query.is("dismissed_at", null).is("archived_at", null);
  } else if (scope === "archived") {
    query = query.not("archived_at", "is", null);
  } else if (scope === "dismissed") {
    query = query.not("dismissed_at", "is", null);
  }

  if (input?.unreadOnly) {
    query = query.eq("is_read", false);
  }

  if (priorityFilter === "important") {
    query = query.gte("priority", 2);
  } else if (priorityFilter === "urgent") {
    query = query.eq("priority", 3);
  }

  if (order === "priority_then_recent") {
    query = query.order("priority", { ascending: false }).order("created_at", {
      ascending: false,
    });
  } else {
    query = query.order("created_at", { ascending: false });
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
    .eq("is_read", false)
    .is("dismissed_at", null)
    .is("archived_at", null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function getCurrentUserNotificationPreferences(): Promise<
  NotificationResult<NotificationPreferenceResult>
> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const preferenceRecord = await ensureCurrentUserPreferenceRecord({
    supabase,
    userId: userResult.userId,
  });

  if (!preferenceRecord) {
    return {
      ok: false,
      message: "Notification preferences could not be loaded right now.",
      requiresAuth: false,
    };
  }

  return {
    ok: true,
    data: {
      preferences: preferenceRecord,
    },
  };
}

export async function updateCurrentUserNotificationPreference(
  input: NotificationPreferenceUpdateInput
): Promise<NotificationResult<NotificationPreferenceResult>> {
  if (!isNotificationCategory(input.category) || !isNotificationPreferenceMode(input.mode)) {
    return {
      ok: false,
      message: "Notification preference request is invalid.",
      requiresAuth: false,
    };
  }

  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const existingRecord = await ensureCurrentUserPreferenceRecord({
    supabase,
    userId: userResult.userId,
  });

  if (!existingRecord) {
    return {
      ok: false,
      message: "Notification preferences could not be updated right now.",
      requiresAuth: false,
    };
  }

  const columnName = CATEGORY_COLUMN_BY_KEY[input.category];
  const patch: Partial<NotificationPreferenceInsertRow> = {};
  (patch as Record<string, unknown>)[columnName] = input.mode;

  const { data, error } = await supabase
    .from("notification_preferences")
    .update(patch)
    .eq("user_id", userResult.userId)
    .select(PREFERENCE_SELECT)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: "Notification preferences could not be updated right now.",
      requiresAuth: false,
    };
  }

  const normalized = toNotificationPreferenceRecord({
    userId: userResult.userId,
    row: data as NotificationPreferenceRow,
    fallback: toPreferenceMap(existingRecord),
  });

  return {
    ok: true,
    data: {
      preferences: normalized,
    },
  };
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
    .is("dismissed_at", null)
    .is("archived_at", null)
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
  NotificationResult<NotificationBulkMutationResult>
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
    .is("dismissed_at", null)
    .is("archived_at", null)
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

export async function dismissNotificationForCurrentUser(input: {
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
      dismissed_at: nowIso,
      archived_at: null,
      is_read: true,
      read_at: nowIso,
    })
    .eq("id", input.notificationId)
    .eq("user_id", userResult.userId)
    .is("dismissed_at", null)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: "Notification could not be dismissed right now.",
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

export async function archiveNotificationForCurrentUser(input: {
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
      archived_at: nowIso,
      dismissed_at: null,
      is_read: true,
      read_at: nowIso,
    })
    .eq("id", input.notificationId)
    .eq("user_id", userResult.userId)
    .is("archived_at", null)
    .is("dismissed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      message: "Notification could not be archived right now.",
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

export async function restoreNotificationForCurrentUser(input: {
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

  const { data: existingRow, error: existingError } = await supabase
    .from("notifications")
    .select("id, dismissed_at, archived_at")
    .eq("id", input.notificationId)
    .eq("user_id", userResult.userId)
    .maybeSingle();

  if (existingError) {
    return {
      ok: false,
      message: "Notification could not be restored right now.",
      requiresAuth: false,
    };
  }

  if (!existingRow) {
    return {
      ok: true,
      data: {
        notificationId: input.notificationId,
        changed: false,
      },
    };
  }

  if (!existingRow.dismissed_at && !existingRow.archived_at) {
    return {
      ok: true,
      data: {
        notificationId: input.notificationId,
        changed: false,
      },
    };
  }

  const { error } = await supabase
    .from("notifications")
    .update({
      dismissed_at: null,
      archived_at: null,
    })
    .eq("id", input.notificationId)
    .eq("user_id", userResult.userId);

  if (error) {
    return {
      ok: false,
      message: "Notification could not be restored right now.",
      requiresAuth: false,
    };
  }

  return {
    ok: true,
    data: {
      notificationId: input.notificationId,
      changed: true,
    },
  };
}

export async function archiveReadLowPriorityNotificationsForCurrentUser(input?: {
  olderThanDays?: number;
}): Promise<NotificationResult<NotificationBulkMutationResult>> {
  const supabase = await createServerSupabaseClient();
  const userResult = await requireCurrentUserId(supabase);
  if (!userResult.ok) {
    return userResult;
  }

  const olderThanDays =
    typeof input?.olderThanDays === "number" && Number.isFinite(input.olderThanDays)
      ? Math.max(1, Math.min(365, Math.trunc(input.olderThanDays)))
      : 21;
  const now = Date.now();
  const thresholdIso = new Date(now - olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date(now).toISOString();

  const { data, error } = await supabase
    .from("notifications")
    .update({
      archived_at: nowIso,
      dismissed_at: null,
    })
    .eq("user_id", userResult.userId)
    .eq("is_read", true)
    .eq("priority", 1)
    .is("dismissed_at", null)
    .is("archived_at", null)
    .lte("created_at", thresholdIso)
    .select("id");

  if (error) {
    return {
      ok: false,
      message: "Low-priority notification cleanup failed. Please retry.",
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
