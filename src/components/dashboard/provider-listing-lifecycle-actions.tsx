"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { canTransitionProviderListingStatus } from "@/lib/listings/provider-wizard/status-transitions";
import {
  updateProviderListingLifecycleStatusAction,
  type UpdateProviderListingLifecycleStatusInput,
} from "@/lib/listings/provider-dashboard/actions";
import type {
  ProviderListingStatus,
  ProviderListingType,
} from "@/lib/listings/provider-dashboard/types";
import { cn } from "@/lib/utils";

type LifecycleActionTone = "default" | "danger";

type LifecycleAction = {
  key: string;
  label: string;
  nextStatus: ProviderListingStatus;
  requiresConfirmation: boolean;
  tone?: LifecycleActionTone;
  description: string;
};

type ProviderListingLifecycleActionsProps = {
  listingId: string;
  listingType: ProviderListingType;
  currentStatus: ProviderListingStatus;
  editHref?: string;
  className?: string;
  hideEditAction?: boolean;
  showUnsavedWarning?: boolean;
};

function buildLifecycleActions(input: {
  listingType: ProviderListingType;
  currentStatus: ProviderListingStatus;
}): LifecycleAction[] {
  const actions: LifecycleAction[] = [];
  const { currentStatus, listingType } = input;

  if (canTransitionProviderListingStatus(currentStatus, "published")) {
    actions.push({
      key: "activate",
      label: "Set active",
      nextStatus: "published",
      requiresConfirmation: true,
      description: "Listing returns to active discovery state.",
    });
  }

  if (canTransitionProviderListingStatus(currentStatus, "draft")) {
    actions.push({
      key: "restore-draft",
      label: "Move to draft",
      nextStatus: "draft",
      requiresConfirmation: true,
      description: "Listing returns to draft and leaves active lifecycle states.",
    });
  }

  if (canTransitionProviderListingStatus(currentStatus, "paused")) {
    actions.push({
      key: "pause",
      label: "Pause",
      nextStatus: "paused",
      requiresConfirmation: true,
      description: "Listing is hidden from active discovery until reactivated.",
    });
  }

  if (listingType === "sale" && canTransitionProviderListingStatus(currentStatus, "sold")) {
    actions.push({
      key: "sold",
      label: "Mark sold",
      nextStatus: "sold",
      requiresConfirmation: true,
      description: "Listing is marked sold and exits active discovery.",
    });
  }

  if (listingType === "rent" && canTransitionProviderListingStatus(currentStatus, "rented")) {
    actions.push({
      key: "rented",
      label: "Mark rented",
      nextStatus: "rented",
      requiresConfirmation: true,
      description: "Listing is marked rented and exits active discovery.",
    });
  }

  if (canTransitionProviderListingStatus(currentStatus, "archived")) {
    actions.push({
      key: "archive",
      label: "Archive",
      nextStatus: "archived",
      requiresConfirmation: true,
      tone: "danger",
      description: "Listing moves into archived state and is removed from active inventory.",
    });
  }

  return actions;
}

export function ProviderListingLifecycleActions({
  listingId,
  listingType,
  currentStatus,
  editHref,
  className,
  hideEditAction = false,
  showUnsavedWarning = false,
}: ProviderListingLifecycleActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmAction, setConfirmAction] = useState<LifecycleAction | null>(null);

  const actions = useMemo(
    () => buildLifecycleActions({ listingType, currentStatus }),
    [listingType, currentStatus]
  );
  const isAdminHidden = currentStatus === "hidden_by_admin";

  function runTransition(input: UpdateProviderListingLifecycleStatusInput) {
    startTransition(async () => {
      const result = await updateProviderListingLifecycleStatusAction(input);

      if (!result.ok) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {!hideEditAction && editHref ? (
        <Link href={editHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Edit
        </Link>
      ) : null}

      {actions.map((action) => (
        <button
          key={action.key}
          type="button"
          disabled={isPending}
          onClick={() => {
            if (action.requiresConfirmation) {
              setConfirmAction(action);
              return;
            }

            runTransition({
              listingId,
              nextStatus: action.nextStatus,
            });
          }}
          className={cn(
            buttonVariants({
              variant: action.tone === "danger" ? "destructive" : "ghost",
              size: "sm",
            }),
            "h-8 px-2.5 text-xs"
          )}
        >
          {isPending ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
          {action.label}
        </button>
      ))}

      {isAdminHidden ? (
        <p className="text-destructive text-xs">Status locked by admin moderation.</p>
      ) : null}

      <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent showClose={!isPending}>
          <DialogHeader>
            <DialogTitle className="inline-flex items-center gap-2 text-base">
              <TriangleAlert className="size-4" aria-hidden="true" />
              Confirm listing action
            </DialogTitle>
            <DialogDescription className="space-y-2 text-sm">
              <span className="block">
                {confirmAction
                  ? `${confirmAction.label} will update this listing status from ${currentStatus}.`
                  : ""}
              </span>
              <span className="block text-xs">
                {confirmAction?.description}
              </span>
              {showUnsavedWarning ? (
                <span className="block text-xs text-muted-foreground">
                  Save pending form changes before confirming status updates to avoid losing in-page edits.
                </span>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirmAction(null)}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isPending || !confirmAction}
              onClick={() => {
                if (!confirmAction) {
                  return;
                }

                runTransition({
                  listingId,
                  nextStatus: confirmAction.nextStatus,
                });
                setConfirmAction(null);
              }}
              className={buttonVariants({
                variant: confirmAction?.tone === "danger" ? "destructive" : "default",
                size: "sm",
              })}
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              Confirm
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
