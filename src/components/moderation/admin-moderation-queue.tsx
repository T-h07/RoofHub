"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, ExternalLink, LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { ModerationReportStatusBadge } from "@/components/moderation/moderation-report-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getListingReportReasonLabel } from "@/lib/moderation/reporting";
import { updateListingModerationVisibilityAction } from "@/lib/moderation/actions";
import type { ModerationReportQueueItem } from "@/lib/moderation/types";
import { cn } from "@/lib/utils";

type AdminModerationQueueProps = {
  reports: ModerationReportQueueItem[];
};

type VisibilityConfirmState = {
  listingId: string;
  listingTitle: string;
  currentStatus: ModerationReportQueueItem["listing"]["listing_status"];
  action: "hide" | "unhide";
};

function formatQueueTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatPrice(report: ModerationReportQueueItem) {
  const normalizedCurrency = report.listing.currency_code?.toUpperCase() || "EUR";
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(report.listing.price_amount);

  return report.listing.listing_type === "rent" ? `${amount} / month` : amount;
}

function getLocationLabel(report: ModerationReportQueueItem) {
  if (report.listing.neighborhood) {
    return `${report.listing.neighborhood}, ${report.listing.city}`;
  }

  return report.listing.city;
}

function getReporterLabel(report: ModerationReportQueueItem) {
  if (report.reporter?.display_name) {
    return report.reporter.display_name;
  }

  return `User #${report.reporter_id.slice(0, 6)}`;
}

function ConfirmDialogDescription(state: VisibilityConfirmState) {
  if (state.action === "hide") {
    return `This will set listing status to hidden_by_admin and remove it from public explore, map, and detail surfaces.`;
  }

  return `This will remove hidden_by_admin moderation status and restore listing visibility to its safe fallback state.`;
}

export function AdminModerationQueue({ reports }: AdminModerationQueueProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmState, setConfirmState] = useState<VisibilityConfirmState | null>(null);

  const reportCountLabel = useMemo(() => {
    const count = reports.length;
    return `${count} report${count === 1 ? "" : "s"}`;
  }, [reports.length]);

  function runVisibilityAction(state: VisibilityConfirmState) {
    startTransition(async () => {
      const result = await updateListingModerationVisibilityAction({
        listingId: state.listingId,
        action: state.action,
      });

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <section className="space-y-3">
      <div className="border-border/70 bg-card/45 flex items-center justify-between rounded-lg border px-3.5 py-2.5">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold tracking-tight">Moderation queue</p>
          <p className="text-muted-foreground text-xs">{reportCountLabel}</p>
        </div>
      </div>

      <ul className="space-y-3">
        {reports.map((report) => {
          const isHiddenByAdmin = report.listing.listing_status === "hidden_by_admin";
          const listingHref = `/listing/${report.listing.slug}`;
          const reportReasonLabel = getListingReportReasonLabel(report.reason_code);

          return (
            <li key={report.id}>
              <article className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-3.5 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2.5">
                  <div className="min-w-0 space-y-1">
                    <Link
                      href={listingHref}
                      className="hover:text-primary truncate text-sm font-semibold tracking-tight transition-colors"
                    >
                      {report.listing.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">
                      Reported by {getReporterLabel(report)} • {formatQueueTimestamp(report.created_at)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <ModerationReportStatusBadge status={report.status} />
                    <Badge variant="outline">{reportReasonLabel}</Badge>
                    <ProviderListingStatusBadge status={report.listing.listing_status} />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)]">
                  {report.coverImageUrl ? (
                    <div className="border-border/70 relative h-20 w-full overflow-hidden rounded-lg border sm:h-16 sm:w-[88px]">
                      <Image
                        src={report.coverImageUrl}
                        alt={`Cover image for ${report.listing.title}`}
                        fill
                        unoptimized
                        sizes="88px"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="border-border/70 bg-muted/35 text-muted-foreground grid h-20 w-full place-items-center rounded-lg border text-[11px] sm:h-16 sm:w-[88px]">
                      No image
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs">
                      {getLocationLabel(report)} • {formatPrice(report)}
                    </p>
                    <p className="text-sm leading-6 break-words">
                      {report.details
                        ? report.details
                        : "No additional report details were provided by the reporter."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="text-muted-foreground text-xs">
                    Listing id: <span className="font-mono">{report.listing.id.slice(0, 8)}</span> • Report id:{" "}
                    <span className="font-mono">{report.id.slice(0, 8)}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Link
                      href={listingHref}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 gap-1.5 px-2.5 text-xs")}
                    >
                      Open listing
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        setConfirmState({
                          listingId: report.listing.id,
                          listingTitle: report.listing.title,
                          currentStatus: report.listing.listing_status,
                          action: isHiddenByAdmin ? "unhide" : "hide",
                        })
                      }
                      className={cn(
                        buttonVariants({
                          variant: isHiddenByAdmin ? "default" : "destructive",
                          size: "sm",
                        }),
                        "h-8 gap-1.5 px-2.5 text-xs"
                      )}
                    >
                      {isHiddenByAdmin ? (
                        <Eye className="size-3.5" aria-hidden="true" />
                      ) : (
                        <EyeOff className="size-3.5" aria-hidden="true" />
                      )}
                      {isHiddenByAdmin ? "Unhide listing" : "Hide listing"}
                    </button>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(confirmState)} onOpenChange={(open) => !open && setConfirmState(null)}>
        <DialogContent showClose={!isPending}>
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 text-base">
              <TriangleAlert className="size-4" aria-hidden="true" />
              Confirm moderation action
            </DialogTitle>
            <DialogDescription className="space-y-2 text-sm">
              <span className="block">
                {confirmState
                  ? `${confirmState.action === "hide" ? "Hide" : "Unhide"} "${confirmState.listingTitle}".`
                  : ""}
              </span>
              {confirmState ? (
                <span className="block text-xs text-muted-foreground">
                  Current listing status: {confirmState.currentStatus}
                </span>
              ) : null}
              {confirmState ? (
                <span className="block text-xs">{ConfirmDialogDescription(confirmState)}</span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmState(null)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !confirmState}
              onClick={() => {
                if (!confirmState) {
                  return;
                }

                runVisibilityAction(confirmState);
                setConfirmState(null);
              }}
              className={buttonVariants({
                variant: confirmState?.action === "hide" ? "destructive" : "default",
                size: "sm",
              })}
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
