"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LoaderCircle } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  countUnreadNotifications,
} from "@/lib/notifications/presentation";
import {
  loadCurrentUserNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { NotificationRecord } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { NotificationRow } from "./notification-row";

type NotificationBellProps = {
  initialUnreadCount: number;
  compact?: boolean;
  className?: string;
};

function formatUnreadBadge(value: number) {
  if (value > 99) {
    return "99+";
  }

  return String(value);
}

export function NotificationBell({ initialUnreadCount, compact = false, className }: NotificationBellProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [isMarkAllPending, startMarkAllTransition] = useTransition();

  useEffect(() => {
    setUnreadCount(initialUnreadCount);
  }, [initialUnreadCount]);

  useEffect(() => {
    if (!open || hasLoaded) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setErrorMessage(null);

    void loadCurrentUserNotificationsAction({
      limit: 8,
      scope: "active",
      order: "priority_then_recent",
    }).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.message);
        setIsLoading(false);
        return;
      }

      setNotifications(result.data.notifications);
      setUnreadCount((current) => {
        const localUnread = countUnreadNotifications(result.data.notifications);
        return Math.max(current, localUnread);
      });
      setHasLoaded(true);
      setIsLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, hasLoaded]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const unreadLabel = unreadCount > 0 ? formatUnreadBadge(unreadCount) : null;

  const unreadPreviewCount = useMemo(() => {
    return countUnreadNotifications(notifications);
  }, [notifications]);

  function updateNotificationReadState(notificationId: string) {
    setNotifications((current) =>
      current.map((notification) =>
        notification.id === notificationId
          ? {
              ...notification,
              is_read: true,
              read_at: notification.read_at ?? new Date().toISOString(),
            }
          : notification
      )
    );
  }

  function markSingleRead(notificationId: string) {
    setPendingNotificationId(notificationId);
    setErrorMessage(null);

    void markNotificationReadAction({ notificationId }).then((result) => {
      setPendingNotificationId(null);

      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      if (!result.data.changed) {
        return;
      }

      updateNotificationReadState(notificationId);
      setUnreadCount((current) => Math.max(0, current - 1));
      router.refresh();
    });
  }

  function markAllRead() {
    setErrorMessage(null);
    startMarkAllTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (!result.ok) {
        setErrorMessage(result.message);
        return;
      }

      if (result.data.changedCount > 0) {
        const now = new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: notification.read_at ?? now,
          }))
        );
      }

      setUnreadCount(0);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          compact
            ? "border-nav-muted/45 bg-nav-background/55 hover:bg-nav-active/24 inline-flex size-9 items-center justify-center rounded-lg border text-nav-foreground transition-colors"
            : "border-nav-muted/45 bg-nav-background/60 hover:bg-nav-active/24 inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-nav-foreground transition-colors",
          "focus-visible:ring-ring focus-visible:ring-offset-nav-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Notifications"
      >
        <span className="relative inline-flex items-center justify-center">
          <Bell className={cn(compact ? "size-4" : "size-4.5")} aria-hidden="true" />
          {unreadLabel ? (
            <span className="bg-primary text-primary-foreground absolute -top-2.5 -right-2 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-4">
              {unreadLabel}
            </span>
          ) : null}
        </span>
      </button>

      {open ? (
        <section className="border-border bg-popover/98 absolute top-full right-0 z-50 mt-2 w-[min(92vw,24rem)] rounded-xl border p-3 shadow-[0_24px_42px_-30px_color-mix(in_oklch,var(--nav-background)_44%,transparent)] backdrop-blur">
          <header className="border-border/65 flex items-center justify-between gap-2 border-b pb-2.5">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold tracking-tight">Notifications</p>
              <p className="text-muted-foreground text-xs">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={markAllRead}
                disabled={isMarkAllPending || unreadCount === 0}
              >
                {isMarkAllPending ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Updating
                  </span>
                ) : (
                  "Mark all read"
                )}
              </Button>
            </div>
          </header>

          <div className="max-h-[24rem] overflow-y-auto py-2.5">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={`notification-loading-${index}`}
                    className="border-border/70 bg-card/55 animate-pulse space-y-2 rounded-xl border p-3"
                  >
                    <div className="bg-muted/50 h-3.5 w-20 rounded" />
                    <div className="bg-muted/50 h-4 w-2/3 rounded" />
                    <div className="bg-muted/40 h-3.5 w-full rounded" />
                  </div>
                ))}
              </div>
            ) : errorMessage ? (
              <div className="border-destructive/30 bg-destructive/8 rounded-xl border px-3 py-2.5 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyState
                title="No notifications yet"
                description="When messages, invites, or listing workflow events need your attention, they will appear here."
                className="px-4 py-8"
              />
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    compact
                    showManagementActions={false}
                    onNavigate={() => setOpen(false)}
                    onMarkRead={markSingleRead}
                    isMarkReadPending={pendingNotificationId === notification.id}
                  />
                ))}
              </div>
            )}
          </div>

          <footer className="border-border/65 flex items-center justify-between border-t pt-2.5">
            <p className="text-muted-foreground text-xs">
              {unreadPreviewCount > 0 ? `${unreadPreviewCount} unread in recent` : "Recent notifications synced"}
            </p>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}
            >
              View all
            </Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
