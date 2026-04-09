"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertTriangle } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldHelp } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import {
  type ReportListingActionState,
  submitListingReportAction,
} from "@/lib/listings/detail-actions";
import { cn } from "@/lib/utils";

type ReportListingDialogProps = {
  listingId: string;
  isAuthenticated: boolean;
  signInHref: string;
};

const REPORT_REASON_OPTIONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "fraud", label: "Suspected fraud" },
  { value: "duplicate", label: "Duplicate listing" },
  { value: "incorrect_information", label: "Incorrect information" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Other" },
] as const;

export function ReportListingDialog({
  listingId,
  isAuthenticated,
  signInHref,
}: ReportListingDialogProps) {
  const initialState: ReportListingActionState = {
    status: "idle",
    message: null,
    submitted: false,
    requiresAuth: false,
  };

  const [state, formAction, isPending] = useActionState(
    submitListingReportAction,
    initialState
  );

  if (!isAuthenticated) {
    return (
      <Link href={signInHref} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs")}>
        Report listing
      </Link>
    );
  }

  return (
    <Dialog>
      <DialogTrigger className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2.5 text-xs")}>
        Report listing
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2 text-base">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Report this listing
          </DialogTitle>
          <DialogDescription>
            Reports are reviewed by NestMap moderation. Include concise details to help triage.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="listingId" value={listingId} />

          <Field>
            <Label htmlFor="listing-report-reason">Reason</Label>
            <select
              id="listing-report-reason"
              name="reason"
              required
              className="border-input bg-background focus-visible:ring-ring/60 h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
              defaultValue=""
            >
              <option value="" disabled>
                Select a reason
              </option>
              {REPORT_REASON_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field>
            <Label htmlFor="listing-report-details">Details (optional)</Label>
            <textarea
              id="listing-report-details"
              name="details"
              maxLength={1200}
              rows={4}
              className="border-input bg-background focus-visible:ring-ring/60 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
              placeholder="Briefly describe what seems incorrect or unsafe."
            />
            <FieldHelp>Avoid personal data. Max 1200 characters.</FieldHelp>
          </Field>

          {state.message ? (
            <p
              className={cn(
                "text-xs",
                state.status === "error" ? "text-destructive" : "text-muted-foreground"
              )}
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={isPending}
              className={buttonVariants({ size: "sm" })}
            >
              {isPending ? "Submitting..." : state.submitted ? "Submitted" : "Submit report"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
