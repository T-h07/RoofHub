"use client";

import Link from "next/link";
import { Archive, ArrowUpRight, LoaderCircle, RotateCcw, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatNotificationTimestampLabel,
  formatNotificationTimestampTitle,
  getNotificationActionHref,
  getNotificationCategory,
  getNotificationCategoryLabel,
  getNotificationPriorityBadgeVariant,
  getNotificationPriorityLabel,
  getNotificationTypeLabel,
  isNotificationActive,
  isNotificationArchived,
  isNotificationDismissed,
  isNotificationUnread,
} from "@/lib/notifications/presentation";
import type { NotificationRecord } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type NotificationRowProps = {
  notification: NotificationRecord;
  compact?: boolean;
  showManagementActions?: boolean;
  onMarkRead?: (notificationId: string) => void;
  onDismiss?: (notificationId: string) => void;
  onArchive?: (notificationId: string) => void;
  onRestore?: (notificationId: string) => void;
  onNavigate?: () => void;
  isMarkReadPending?: boolean;
  isDismissPending?: boolean;
  isArchivePending?: boolean;
  isRestorePending?: boolean;
};

export function NotificationRow({
  notification,
  compact = false,
  showManagementActions = true,
  onMarkRead,
  onDismiss,
  onArchive,
  onRestore,
  onNavigate,
  isMarkReadPending = false,
  isDismissPending = false,
  isArchivePending = false,
  isRestorePending = false,
}: NotificationRowProps) {
  const unread = isNotificationUnread(notification);
  const actionHref = getNotificationActionHref(notification);
  const category = getNotificationCategory(notification.type);
  const isActive = isNotificationActive(notification);
  const isArchived = isNotificationArchived(notification);
  const isDismissed = isNotificationDismissed(notification);

  return (
    <article
      className={cn(
        "border-border/70 bg-card/55 hover:border-border rounded-xl border transition-colors",
        unread && isActive ? "border-primary/35 bg-primary/8" : "",
        isArchived ? "bg-muted/35" : "",
        isDismissed ? "bg-card/35 opacity-90" : "",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <span
            className={cn(
              "inline-flex size-2.5 rounded-full",
              unread && isActive ? "bg-primary" : "bg-border"
            )}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={unread && isActive ? "primary" : "outline"}>
              {getNotificationTypeLabel(notification.type)}
            </Badge>
            <Badge variant="outline">{getNotificationCategoryLabel(category)}</Badge>
            <Badge variant={getNotificationPriorityBadgeVariant(notification.priority)}>
              {getNotificationPriorityLabel(notification.priority)}
            </Badge>
            {isArchived ? <Badge variant="neutral">Archived</Badge> : null}
            {isDismissed ? <Badge variant="neutral">Dismissed</Badge> : null}
            <time
              className="text-muted-foreground ml-auto text-xs"
              title={formatNotificationTimestampTitle(notification.created_at)}
            >
              {formatNotificationTimestampLabel(notification.created_at)}
            </time>
          </div>

          <div className="space-y-1.5">
            <p
              className={cn(
                "text-sm tracking-tight",
                unread && isActive ? "font-semibold" : "font-medium"
              )}
            >
              {notification.title}
            </p>
            {notification.body ? (
              <p
                className={cn(
                  "text-muted-foreground text-sm leading-5",
                  compact ? "line-clamp-2" : "line-clamp-3"
                )}
              >
                {notification.body}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={actionHref}
              onClick={onNavigate}
              className={cn(
                buttonVariants({ size: "sm", variant: "outline" }),
                "h-8 gap-1.5"
              )}
            >
              Open
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>

            {showManagementActions && unread && isActive && onMarkRead ? (
              <button
                type="button"
                onClick={() => onMarkRead(notification.id)}
                disabled={isMarkReadPending}
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "h-8 text-xs",
                  isMarkReadPending ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                {isMarkReadPending ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Updating
                  </span>
                ) : (
                  "Mark read"
                )}
              </button>
            ) : null}

            {showManagementActions && isActive && !unread && onArchive ? (
              <button
                type="button"
                onClick={() => onArchive(notification.id)}
                disabled={isArchivePending}
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "h-8 gap-1.5 text-xs",
                  isArchivePending ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                {isArchivePending ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Updating
                  </span>
                ) : (
                  <>
                    <Archive className="size-3.5" aria-hidden="true" />
                    Archive
                  </>
                )}
              </button>
            ) : null}

            {showManagementActions && isActive && onDismiss ? (
              <button
                type="button"
                onClick={() => onDismiss(notification.id)}
                disabled={isDismissPending}
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "h-8 gap-1.5 text-xs",
                  isDismissPending ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                {isDismissPending ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Updating
                  </span>
                ) : (
                  <>
                    <X className="size-3.5" aria-hidden="true" />
                    Dismiss
                  </>
                )}
              </button>
            ) : null}

            {showManagementActions && !isActive && onRestore ? (
              <button
                type="button"
                onClick={() => onRestore(notification.id)}
                disabled={isRestorePending}
                className={cn(
                  buttonVariants({ size: "sm", variant: "ghost" }),
                  "h-8 gap-1.5 text-xs",
                  isRestorePending ? "cursor-not-allowed opacity-70" : ""
                )}
              >
                {isRestorePending ? (
                  <span className="inline-flex items-center gap-1">
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
                    Updating
                  </span>
                ) : (
                  <>
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Restore
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}
