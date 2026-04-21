"use client";

import { useMemo, useState, useTransition } from "react";
import { Bell, Filter, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { PageSection, PageShell, PageState, PageSummaryCard, PageSummaryRow } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  applyNotificationFilters,
  countUnreadNotifications,
  getNotificationCategory,
  getNotificationCategoryLabel,
  NOTIFICATION_CATEGORY_FILTERS,
  NOTIFICATION_SCOPE_FILTERS,
  type NotificationCategoryFilter,
  type NotificationScopeFilter,
} from "@/lib/notifications/presentation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/notifications/actions";
import type { NotificationRecord } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { NotificationRow } from "./notification-row";

type NotificationCenterProps = {
  initialNotifications: NotificationRecord[];
};

const SCOPE_LABELS: Record<NotificationScopeFilter, string> = {
  all: "All",
  unread: "Unread",
};

function categoryFilterLabel(value: NotificationCategoryFilter) {
  if (value === "all") {
    return "All types";
  }

  return getNotificationCategoryLabel(value);
}

export function NotificationCenter({ initialNotifications }: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [scopeFilter, setScopeFilter] = useState<NotificationScopeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<NotificationCategoryFilter>("all");
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null);
  const [isMarkAllPending, startMarkAllTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const unreadCount = useMemo(() => countUnreadNotifications(notifications), [notifications]);

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategoryFilter, number> = {
      all: notifications.length,
      messages: 0,
      listings: 0,
      company: 0,
      account: 0,
    };

    for (const notification of notifications) {
      const category = getNotificationCategory(notification.type);
      counts[category] += 1;
    }

    return counts;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return applyNotificationFilters(notifications, {
      scope: scopeFilter,
      category: categoryFilter,
    });
  }, [notifications, scopeFilter, categoryFilter]);

  function markSingleRead(notificationId: string) {
    setPendingNotificationId(notificationId);
    setStatusMessage(null);

    void markNotificationReadAction({ notificationId }).then((result) => {
      setPendingNotificationId(null);

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (!result.data.changed) {
        return;
      }

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
      router.refresh();
    });
  }

  function markAllRead() {
    setStatusMessage(null);

    startMarkAllTransition(async () => {
      const result = await markAllNotificationsReadAction();

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (result.data.changedCount > 0) {
        const nowIso = new Date().toISOString();
        setNotifications((current) =>
          current.map((notification) => ({
            ...notification,
            is_read: true,
            read_at: notification.read_at ?? nowIso,
          }))
        );
      }

      router.refresh();
    });
  }

  return (
    <PageShell>
      <PageSummaryRow className="xl:grid-cols-2">
        <PageSummaryCard
          label="Total notifications"
          value={new Intl.NumberFormat("en").format(notifications.length)}
          detail="Persisted events that require your attention across messaging, listing workflow, and company operations."
          tone="primary"
          icon={Bell}
        />
        <PageSummaryCard
          label="Unread"
          value={new Intl.NumberFormat("en").format(unreadCount)}
          detail="Unread count stays synchronized with your top-bar bell badge."
          tone={unreadCount > 0 ? "danger" : "default"}
          icon={Filter}
        />
      </PageSummaryRow>

      <PageSection
        eyebrow={<Badge variant="primary">Notification center</Badge>}
        title="Manage notification attention"
        description="Filter by unread and category, open related routes, and keep your RoofHub workspace focused."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isMarkAllPending || unreadCount === 0}
          >
            {isMarkAllPending ? (
              <span className="inline-flex items-center gap-1.5">
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                Updating
              </span>
            ) : (
              "Mark all read"
            )}
          </Button>
        }
      >
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {NOTIFICATION_SCOPE_FILTERS.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setScopeFilter(scope)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    scopeFilter === scope
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  )}
                >
                  {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {NOTIFICATION_CATEGORY_FILTERS.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setCategoryFilter(category)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    categoryFilter === category
                      ? "bg-secondary text-foreground border-secondary"
                      : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  )}
                >
                  {categoryFilterLabel(category)}
                  <span className="ml-1 text-[11px] opacity-80">
                    {new Intl.NumberFormat("en").format(categoryCounts[category])}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {statusMessage ? (
            <div className="border-destructive/35 bg-destructive/8 rounded-lg border px-3 py-2 text-sm text-destructive">
              {statusMessage}
            </div>
          ) : null}

          {notifications.length === 0 ? (
            <PageState
              icon={Bell}
              title="No notifications available"
              description="Your account does not have persisted notifications yet."
            />
          ) : filteredNotifications.length === 0 ? (
            <EmptyState
              icon={Filter}
              title="No notifications match these filters"
              description="Adjust scope or category filters to view more notification activity."
            />
          ) : (
            <div className="space-y-2.5">
              {filteredNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markSingleRead}
                  isMarkReadPending={pendingNotificationId === notification.id}
                />
              ))}
            </div>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
