"use client";

import Link from "next/link";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatNotificationTimestampLabel,
  formatNotificationTimestampTitle,
  getNotificationActionHref,
  getNotificationCategory,
  getNotificationCategoryLabel,
  getNotificationTypeLabel,
  isNotificationUnread,
} from "@/lib/notifications/presentation";
import type { NotificationRecord } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

type NotificationRowProps = {
  notification: NotificationRecord;
  compact?: boolean;
  onMarkRead?: (notificationId: string) => void;
  onNavigate?: () => void;
  isMarkReadPending?: boolean;
};

export function NotificationRow({
  notification,
  compact = false,
  onMarkRead,
  onNavigate,
  isMarkReadPending = false,
}: NotificationRowProps) {
  const unread = isNotificationUnread(notification);
  const actionHref = getNotificationActionHref(notification);
  const category = getNotificationCategory(notification.type);

  return (
    <article
      className={cn(
        "border-border/70 bg-card/55 hover:border-border rounded-xl border transition-colors",
        unread ? "border-primary/35 bg-primary/8" : "",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-1">
          <span
            className={cn(
              "inline-flex size-2.5 rounded-full",
              unread ? "bg-primary" : "bg-border"
            )}
            aria-hidden="true"
          />
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={unread ? "primary" : "outline"}>{getNotificationTypeLabel(notification.type)}</Badge>
            <Badge variant="outline">{getNotificationCategoryLabel(category)}</Badge>
            <time
              className="text-muted-foreground ml-auto text-xs"
              title={formatNotificationTimestampTitle(notification.created_at)}
            >
              {formatNotificationTimestampLabel(notification.created_at)}
            </time>
          </div>

          <div className="space-y-1.5">
            <p className={cn("text-sm tracking-tight", unread ? "font-semibold" : "font-medium")}>
              {notification.title}
            </p>
            {notification.body ? (
              <p className={cn("text-muted-foreground text-sm leading-5", compact ? "line-clamp-2" : "line-clamp-3")}>
                {notification.body}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={actionHref}
              onClick={onNavigate}
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 gap-1.5")}
            >
              Open
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>

            {unread && onMarkRead ? (
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
          </div>
        </div>
      </div>
    </article>
  );
}
