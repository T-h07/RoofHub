"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  countUnreadNotifications,
  sortNotificationsForFeed,
} from "@/lib/notifications/presentation";
import type { NotificationRecord } from "@/lib/notifications/types";
import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

const FALLBACK_REFRESH_INTERVAL_MS = 10_000;
const EMPTY_NOTIFICATIONS: NotificationRecord[] = [];
let realtimeChannelSequence = 0;

export type NotificationRealtimeHealth = "connecting" | "live" | "degraded";

type UseRealtimeNotificationsOptions = {
  viewerUserId: string | null;
  initialNotifications?: NotificationRecord[];
  initialUnreadCount?: number;
  prioritize?: boolean;
  maxItems?: number;
  refreshFromServer?: () => Promise<NotificationRecord[] | null>;
};

function toNotificationRecordFromRow(
  row: Database["public"]["Tables"]["notifications"]["Row"]
): NotificationRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    organization_id: row.organization_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    action_url: row.action_url,
    priority: row.priority as NotificationRecord["priority"],
    is_read: row.is_read,
    read_at: row.read_at,
    dismissed_at: row.dismissed_at,
    archived_at: row.archived_at,
    actor_user_id: row.actor_user_id,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

function mergeNotifications(
  current: NotificationRecord[],
  incoming: NotificationRecord[],
  options: {
    prioritize: boolean;
    maxItems?: number;
  }
) {
  const byId = new Map(current.map((notification) => [notification.id, notification]));

  for (const notification of incoming) {
    byId.set(notification.id, notification);
  }

  const merged = sortNotificationsForFeed([...byId.values()], {
    prioritize: options.prioritize,
  });

  if (typeof options.maxItems === "number") {
    return merged.slice(0, options.maxItems);
  }

  return merged;
}

function createNotificationsChannelName(viewerUserId: string) {
  // Desktop and mobile bells can mount together, so the channel name
  // must stay unique even when subscriptions start in the same millisecond.
  realtimeChannelSequence += 1;
  return `notifications-live-${viewerUserId}-${Date.now()}-${realtimeChannelSequence}`;
}

function createNotificationsSnapshotKey(
  viewerUserId: string | null,
  notifications: NotificationRecord[],
  options: {
    prioritize: boolean;
    maxItems?: number;
  }
) {
  const merged = mergeNotifications([], notifications, options);

  return JSON.stringify({
    viewerUserId,
    notifications: merged.map((notification) => ({
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      priority: notification.priority,
      is_read: notification.is_read,
      read_at: notification.read_at,
      dismissed_at: notification.dismissed_at,
      archived_at: notification.archived_at,
      created_at: notification.created_at,
    })),
  });
}

export function useRealtimeNotifications({
  viewerUserId,
  initialNotifications = EMPTY_NOTIFICATIONS,
  initialUnreadCount = 0,
  prioritize = false,
  maxItems,
  refreshFromServer,
}: UseRealtimeNotificationsOptions) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [notifications, setNotifications] = useState<NotificationRecord[]>(() =>
    mergeNotifications([], initialNotifications, { prioritize, maxItems })
  );
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [realtimeHealth, setRealtimeHealth] =
    useState<NotificationRealtimeHealth>(
      viewerUserId ? "connecting" : "degraded"
    );
  const [realtimeError, setRealtimeError] = useState<string | null>(
    viewerUserId ? null : "Live notifications are unavailable until your session loads."
  );

  const refreshInFlightRef = useRef(false);
  const refreshTimerRef = useRef<number | null>(null);
  const shouldResyncOnReconnectRef = useRef(false);
  const initialSnapshotKeyRef = useRef<string | null>(null);
  const refreshFromServerRef = useRef(refreshFromServer);
  const hasRefreshFromServer = Boolean(refreshFromServer);

  useEffect(() => {
    refreshFromServerRef.current = refreshFromServer;
  }, [refreshFromServer]);

  useEffect(() => {
    const nextSnapshotKey = createNotificationsSnapshotKey(viewerUserId, initialNotifications, {
      prioritize,
      maxItems,
    });

    if (initialSnapshotKeyRef.current === nextSnapshotKey) {
      return;
    }

    initialSnapshotKeyRef.current = nextSnapshotKey;
    setNotifications(mergeNotifications([], initialNotifications, { prioritize, maxItems }));
  }, [initialNotifications, maxItems, prioritize, viewerUserId]);

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  const refreshNow = useCallback(async () => {
    const refresh = refreshFromServerRef.current;

    if (!refresh || refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;

    try {
      const nextNotifications = await refresh();
      if (!nextNotifications) {
        return;
      }

      setNotifications(
        mergeNotifications([], nextNotifications, {
          prioritize,
          maxItems,
        })
      );
      setUnreadCount(countUnreadNotifications(nextNotifications, { activeOnly: true }));
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [maxItems, prioritize]);

  const scheduleRefresh = useCallback(() => {
    if (!refreshFromServerRef.current || refreshTimerRef.current !== null) {
      return;
    }

    refreshTimerRef.current = window.setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshNow();
    }, 250);
  }, [refreshNow]);

  useEffect(() => {
    if (!viewerUserId) {
      setRealtimeHealth("degraded");
      setRealtimeError("Live notifications are unavailable until your session loads.");
      return;
    }

    setRealtimeHealth("connecting");
    setRealtimeError(null);

    let disposed = false;

    const notificationsChannel = supabase
      .channel(createNotificationsChannelName(viewerUserId))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${viewerUserId}`,
        },
        (payload) => {
          const nextNotification = toNotificationRecordFromRow(
            payload.new as Database["public"]["Tables"]["notifications"]["Row"]
          );

          setNotifications((current) =>
            mergeNotifications(current, [nextNotification], {
              prioritize,
              maxItems,
            })
          );

          if (!nextNotification.is_read) {
            setUnreadCount((current) => current + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${viewerUserId}`,
        },
        (payload) => {
          const nextNotification = toNotificationRecordFromRow(
            payload.new as Database["public"]["Tables"]["notifications"]["Row"]
          );

          setNotifications((current) =>
            mergeNotifications(current, [nextNotification], {
              prioritize,
              maxItems,
            })
          );

          scheduleRefresh();
        }
      );

    notificationsChannel.subscribe((status) => {
      if (disposed) {
        return;
      }

      if (status === "SUBSCRIBED") {
        setRealtimeHealth("live");
        setRealtimeError(null);

        if (shouldResyncOnReconnectRef.current) {
          shouldResyncOnReconnectRef.current = false;
          void refreshNow();
        }
        return;
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setRealtimeHealth("degraded");
        setRealtimeError("Live notification sync disconnected. Fallback refresh is active.");
        shouldResyncOnReconnectRef.current = true;
        return;
      }

      setRealtimeHealth("connecting");
    });

    return () => {
      disposed = true;
      if (refreshTimerRef.current !== null) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      void supabase.removeChannel(notificationsChannel);
    };
  }, [maxItems, prioritize, refreshNow, scheduleRefresh, supabase, viewerUserId]);

  useEffect(() => {
    if (realtimeHealth !== "degraded" || !hasRefreshFromServer) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refreshNow();
    }, FALLBACK_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasRefreshFromServer, realtimeHealth, refreshNow]);

  return {
    notifications,
    setNotifications,
    unreadCount,
    setUnreadCount,
    realtimeHealth,
    realtimeError,
    refreshNow,
  };
}
