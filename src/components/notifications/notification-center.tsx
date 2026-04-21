"use client";

import { useMemo, useState, useTransition } from "react";
import { Bell, Filter, LoaderCircle, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";

import {
  PageSection,
  PageShell,
  PageState,
  PageSummaryCard,
  PageSummaryRow,
} from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  applyNotificationFilters,
  countUnreadNotifications,
  getNotificationCategory,
  getNotificationCategoryLabel,
  NOTIFICATION_CATEGORY_FILTERS,
  NOTIFICATION_FEED_FILTERS,
  NOTIFICATION_PRIORITY_FILTERS,
  NOTIFICATION_SCOPE_FILTERS,
  type NotificationCategoryFilter,
  type NotificationFeedFilter,
  type NotificationPriorityFilterValue,
  type NotificationScopeFilter,
} from "@/lib/notifications/presentation";
import {
  archiveLowPriorityNotificationsAction,
  archiveNotificationAction,
  dismissNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  restoreNotificationAction,
  updateNotificationCategoryPreferenceAction,
} from "@/lib/notifications/actions";
import {
  type NotificationCategory,
  type NotificationPreferenceMode,
  type NotificationPreferenceRecord,
  type NotificationRecord,
} from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

import { NotificationRow } from "./notification-row";

type NotificationCenterProps = {
  initialNotifications: NotificationRecord[];
  initialPreferences: NotificationPreferenceRecord;
};

const SCOPE_LABELS: Record<NotificationScopeFilter, string> = {
  all: "All",
  unread: "Unread",
};

const FEED_LABELS: Record<NotificationFeedFilter, string> = {
  active: "Active queue",
  archived: "Archived",
  dismissed: "Dismissed",
};

const PRIORITY_LABELS: Record<NotificationPriorityFilterValue, string> = {
  all: "All priority",
  important: "Important+",
  urgent: "Urgent",
};

const PREFERENCE_MODE_VALUES: NotificationPreferenceMode[] = [
  "all",
  "important_only",
  "mute",
];

const PREFERENCE_MODE_LABELS: Record<NotificationPreferenceMode, string> = {
  all: "All",
  important_only: "Important only",
  mute: "Mute most",
};

const PREFERENCE_CATEGORY_COPY: Record<
  NotificationCategory,
  { label: string; description: string }
> = {
  messages: {
    label: "Messages and inquiries",
    description:
      "Replies, inquiry starts, and assignment alerts for inbox follow-up.",
  },
  listings: {
    label: "Listing workflow",
    description:
      "Review, approval, publication, and listing state-change notifications.",
  },
  company: {
    label: "Company and team",
    description:
      "Invites, team lifecycle changes, and company workspace operational updates.",
  },
  account: {
    label: "Account and system",
    description: "Security or account-level updates that affect your access.",
  },
};

function categoryFilterLabel(value: NotificationCategoryFilter) {
  if (value === "all") {
    return "All categories";
  }

  return getNotificationCategoryLabel(value);
}

export function NotificationCenter({
  initialNotifications,
  initialPreferences,
}: NotificationCenterProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [feedFilter, setFeedFilter] = useState<NotificationFeedFilter>("active");
  const [scopeFilter, setScopeFilter] = useState<NotificationScopeFilter>("all");
  const [categoryFilter, setCategoryFilter] =
    useState<NotificationCategoryFilter>("all");
  const [priorityFilter, setPriorityFilter] =
    useState<NotificationPriorityFilterValue>("all");
  const [pendingNotificationAction, setPendingNotificationAction] = useState<
    string | null
  >(null);
  const [pendingPreferenceCategory, setPendingPreferenceCategory] = useState<
    NotificationCategory | null
  >(null);
  const [isMarkAllPending, startMarkAllTransition] = useTransition();
  const [isArchiveLowPriorityPending, startArchiveLowPriorityTransition] =
    useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeUnreadCount = useMemo(
    () => countUnreadNotifications(notifications, { activeOnly: true }),
    [notifications]
  );

  const activeCount = useMemo(
    () =>
      notifications.filter(
        (notification) => !notification.archived_at && !notification.dismissed_at
      ).length,
    [notifications]
  );

  const archivedCount = useMemo(
    () => notifications.filter((notification) => Boolean(notification.archived_at)).length,
    [notifications]
  );

  const dismissedCount = useMemo(
    () => notifications.filter((notification) => Boolean(notification.dismissed_at)).length,
    [notifications]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<NotificationCategoryFilter, number> = {
      all: 0,
      messages: 0,
      listings: 0,
      company: 0,
      account: 0,
    };

    for (const notification of notifications) {
      const matchesFeed =
        (feedFilter === "active" &&
          !notification.archived_at &&
          !notification.dismissed_at) ||
        (feedFilter === "archived" && Boolean(notification.archived_at)) ||
        (feedFilter === "dismissed" && Boolean(notification.dismissed_at));
      if (!matchesFeed) {
        continue;
      }

      counts.all += 1;
      const category = getNotificationCategory(notification.type);
      counts[category] += 1;
    }

    return counts;
  }, [feedFilter, notifications]);

  const filteredNotifications = useMemo(() => {
    return applyNotificationFilters(notifications, {
      feed: feedFilter,
      scope: scopeFilter,
      category: categoryFilter,
      priority: priorityFilter === "all" ? "all" : priorityFilter,
    });
  }, [notifications, feedFilter, scopeFilter, categoryFilter, priorityFilter]);

  function markSingleRead(notificationId: string) {
    const actionKey = `read:${notificationId}`;
    setPendingNotificationAction(actionKey);
    setStatusMessage(null);

    void markNotificationReadAction({ notificationId }).then((result) => {
      setPendingNotificationAction(null);

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

  function dismissNotification(notificationId: string) {
    const actionKey = `dismiss:${notificationId}`;
    setPendingNotificationAction(actionKey);
    setStatusMessage(null);

    void dismissNotificationAction({ notificationId }).then((result) => {
      setPendingNotificationAction(null);

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (!result.data.changed) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                dismissed_at: nowIso,
                archived_at: null,
                is_read: true,
                read_at: notification.read_at ?? nowIso,
              }
            : notification
        )
      );
      router.refresh();
    });
  }

  function archiveNotification(notificationId: string) {
    const actionKey = `archive:${notificationId}`;
    setPendingNotificationAction(actionKey);
    setStatusMessage(null);

    void archiveNotificationAction({ notificationId }).then((result) => {
      setPendingNotificationAction(null);

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (!result.data.changed) {
        return;
      }

      const nowIso = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                archived_at: nowIso,
                dismissed_at: null,
                is_read: true,
                read_at: notification.read_at ?? nowIso,
              }
            : notification
        )
      );
      router.refresh();
    });
  }

  function restoreNotification(notificationId: string) {
    const actionKey = `restore:${notificationId}`;
    setPendingNotificationAction(actionKey);
    setStatusMessage(null);

    void restoreNotificationAction({ notificationId }).then((result) => {
      setPendingNotificationAction(null);

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
                dismissed_at: null,
                archived_at: null,
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
          current.map((notification) =>
            notification.archived_at || notification.dismissed_at
              ? notification
              : {
                  ...notification,
                  is_read: true,
                  read_at: notification.read_at ?? nowIso,
                }
          )
        );
      }

      router.refresh();
    });
  }

  function archiveLowPriority() {
    setStatusMessage(null);

    startArchiveLowPriorityTransition(async () => {
      const result = await archiveLowPriorityNotificationsAction({
        olderThanDays: 21,
      });

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      if (result.data.changedCount > 0) {
        const nowIso = new Date().toISOString();
        const threshold = new Date(
          Date.now() - 21 * 24 * 60 * 60 * 1000
        ).toISOString();

        setNotifications((current) =>
          current.map((notification) => {
            if (
              notification.archived_at ||
              notification.dismissed_at ||
              !notification.is_read ||
              notification.priority !== 1 ||
              notification.created_at > threshold
            ) {
              return notification;
            }

            return {
              ...notification,
              archived_at: nowIso,
            };
          })
        );
      }

      router.refresh();
    });
  }

  function updateCategoryPreference(
    category: NotificationCategory,
    mode: NotificationPreferenceMode
  ) {
    if (preferences[`${category}_mode`] === mode) {
      return;
    }

    setPendingPreferenceCategory(category);
    setStatusMessage(null);

    void updateNotificationCategoryPreferenceAction({
      category,
      mode,
    }).then((result) => {
      setPendingPreferenceCategory(null);

      if (!result.ok) {
        setStatusMessage(result.message);
        return;
      }

      setPreferences(result.data.preferences);
      router.refresh();
    });
  }

  return (
    <PageShell>
      <PageSummaryRow>
        <PageSummaryCard
          label="Active queue"
          value={new Intl.NumberFormat("en").format(activeCount)}
          detail="Active notifications shown in the bell and standard notification feed."
          tone="primary"
          icon={Bell}
        />
        <PageSummaryCard
          label="Unread"
          value={new Intl.NumberFormat("en").format(activeUnreadCount)}
          detail="Unread count excludes archived and dismissed items."
          tone={activeUnreadCount > 0 ? "danger" : "default"}
          icon={Filter}
        />
        <PageSummaryCard
          label="History"
          value={new Intl.NumberFormat("en").format(archivedCount + dismissedCount)}
          detail={`Archived: ${archivedCount} · Dismissed: ${dismissedCount}`}
          icon={Settings2}
        />
      </PageSummaryRow>

      <PageSection
        eyebrow={<Badge variant="outline">Preferences</Badge>}
        title="Notification relevance controls"
        description="Control each category independently. “Mute most” still allows urgent alerts so critical operations do not disappear."
      >
        <div className="space-y-3">
          {(Object.keys(PREFERENCE_CATEGORY_COPY) as NotificationCategory[]).map(
            (category) => (
              <div
                key={category}
                className="border-border/70 bg-card/65 rounded-xl border p-3"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight">
                      {PREFERENCE_CATEGORY_COPY[category].label}
                    </p>
                    <p className="text-muted-foreground text-xs leading-5">
                      {PREFERENCE_CATEGORY_COPY[category].description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {PREFERENCE_MODE_VALUES.map((mode) => {
                      const currentMode =
                        preferences[
                          `${category}_mode` as
                            | "messages_mode"
                            | "listings_mode"
                            | "company_mode"
                            | "account_mode"
                        ];
                      const selected = currentMode === mode;
                      const isPending =
                        pendingPreferenceCategory === category;

                      return (
                        <button
                          key={`${category}-${mode}`}
                          type="button"
                          onClick={() => updateCategoryPreference(category, mode)}
                          disabled={isPending}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground",
                            isPending ? "cursor-not-allowed opacity-70" : ""
                          )}
                        >
                          {PREFERENCE_MODE_LABELS[mode]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </PageSection>

      <PageSection
        eyebrow={<Badge variant="primary">Notification center</Badge>}
        title="Manage notification attention"
        description="Review active work, inspect archived or dismissed history, and keep low-value noise under control."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={archiveLowPriority}
              disabled={isArchiveLowPriorityPending}
            >
              {isArchiveLowPriorityPending ? (
                <span className="inline-flex items-center gap-1.5">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                  Cleaning
                </span>
              ) : (
                "Archive old low-priority"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={markAllRead}
              disabled={isMarkAllPending || activeUnreadCount === 0}
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
          </div>
        }
      >
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {NOTIFICATION_FEED_FILTERS.map((feed) => (
                <button
                  key={feed}
                  type="button"
                  onClick={() => setFeedFilter(feed)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    feedFilter === feed
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  )}
                >
                  {FEED_LABELS[feed]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {NOTIFICATION_SCOPE_FILTERS.map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setScopeFilter(scope)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    scopeFilter === scope
                      ? "bg-secondary text-foreground border-secondary"
                      : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  )}
                >
                  {SCOPE_LABELS[scope]}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {NOTIFICATION_PRIORITY_FILTERS.map((priority) => (
                <button
                  key={priority}
                  type="button"
                  onClick={() => setPriorityFilter(priority)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    priorityFilter === priority
                      ? "bg-secondary text-foreground border-secondary"
                      : "border-border text-muted-foreground hover:border-primary/25 hover:text-foreground"
                  )}
                >
                  {PRIORITY_LABELS[priority]}
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
              description="Adjust feed, category, unread, or priority filters to view more notification activity."
            />
          ) : (
            <div className="space-y-2.5">
              {filteredNotifications.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onMarkRead={markSingleRead}
                  onDismiss={dismissNotification}
                  onArchive={archiveNotification}
                  onRestore={restoreNotification}
                  isMarkReadPending={
                    pendingNotificationAction === `read:${notification.id}`
                  }
                  isDismissPending={
                    pendingNotificationAction === `dismiss:${notification.id}`
                  }
                  isArchivePending={
                    pendingNotificationAction === `archive:${notification.id}`
                  }
                  isRestorePending={
                    pendingNotificationAction === `restore:${notification.id}`
                  }
                />
              ))}
            </div>
          )}
        </div>
      </PageSection>
    </PageShell>
  );
}
