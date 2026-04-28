"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ClipboardCheck,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import { formatProviderListingStatus } from "@/lib/listings/provider-dashboard/status";
import { cn } from "@/lib/utils";

import { transitionCompanyListingWorkflowAction } from "@/lib/listings/company-workflow/actions";
import { COMPANY_LISTING_WORKFLOW_EVENT_LABELS } from "@/lib/listings/company-workflow/types";
import type {
  CompanyListingWorkflowAction,
  CompanyListingWorkflowCapabilities,
  CompanyListingWorkflowTimelineEvent,
  CompanyListingWorkflowStatus,
} from "@/lib/listings/company-workflow/types";

type CompanyListingWorkflowPanelProps = {
  listingId: string;
  listingTitle: string;
  listingStatus: CompanyListingWorkflowStatus;
  viewerRole: string;
  capabilities: CompanyListingWorkflowCapabilities;
  timeline: CompanyListingWorkflowTimelineEvent[];
};

type ActionDefinition = {
  action: CompanyListingWorkflowAction;
  label: string;
  tone: "default" | "outline" | "secondary";
  requiresNote: boolean;
  noteOptional?: boolean;
  description: string;
  icon: typeof Send;
};

function formatRoleLabel(value: string) {
  switch (value) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "manager":
      return "Manager";
    case "agent":
      return "Agent";
    default:
      return "Member";
  }
}

function formatTimelineDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleString();
}

function buildWorkflowActions(capabilities: CompanyListingWorkflowCapabilities) {
  const actions: ActionDefinition[] = [];

  if (capabilities.canSubmitForReview) {
    actions.push({
      action: "submit_for_review",
      label: "Submit for review",
      tone: "default",
      requiresNote: false,
      description: "Send this listing into internal company review.",
      icon: Send,
    });
  }

  if (capabilities.canRequestChanges) {
    actions.push({
      action: "needs_changes",
      label: "Request changes",
      tone: "secondary",
      requiresNote: true,
      description: "Return this listing to the assigned agent with a clear revision note.",
      icon: MessageSquarePlus,
    });
  }

  if (capabilities.canApprove) {
    actions.push({
      action: "approve",
      label: "Approve",
      tone: "default",
      requiresNote: true,
      noteOptional: true,
      description: "Mark this listing as approved and ready for intentional publish.",
      icon: CheckCircle2,
    });
  }

  if (capabilities.canPublish) {
    actions.push({
      action: "publish",
      label: "Publish",
      tone: "default",
      requiresNote: false,
      description: "Publish this listing to public explore, map, and company feeds.",
      icon: ShieldCheck,
    });
  }

  if (capabilities.canUnpublish) {
    actions.push({
      action: "unpublish",
      label: "Unpublish",
      tone: "outline",
      requiresNote: false,
      description: "Remove this listing from public discovery while preserving workflow history.",
      icon: ClipboardCheck,
    });
  }

  return actions;
}

export function CompanyListingWorkflowPanel({
  listingId,
  listingTitle,
  listingStatus,
  viewerRole,
  capabilities,
  timeline,
}: CompanyListingWorkflowPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [openAction, setOpenAction] = useState<ActionDefinition | null>(null);
  const [note, setNote] = useState("");

  const actions = useMemo(() => buildWorkflowActions(capabilities), [capabilities]);
  const reviewerNotesTimeline = useMemo(
    () =>
      timeline.filter((event) => typeof event.note === "string" && event.note.trim().length > 0),
    [timeline]
  );

  function runAction(action: ActionDefinition, workflowNote?: string) {
    startTransition(async () => {
      const result = await transitionCompanyListingWorkflowAction({
        listingId,
        action: action.action,
        note: workflowNote,
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
    <div className="space-y-5">
      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-4 space-y-2 border-b pb-4">
          <Badge variant="outline">Listing workflow</Badge>
          <h2 className="type-section-title">Internal review and publishing controls</h2>
          <p className="type-body-muted max-w-3xl">
            Company listings stay private until they move through review, approval, and a deliberate
            publish action.
          </p>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tracking-tight">{listingTitle}</p>
            <p className="text-muted-foreground text-xs">
              Current state: <span className="font-medium">{formatProviderListingStatus(listingStatus)}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              Signed in as <span className="font-medium">{formatRoleLabel(viewerRole)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => (
              <button
                key={action.action}
                type="button"
                className={cn(buttonVariants({ variant: action.tone, size: "sm" }), "gap-1.5")}
                disabled={isPending}
                onClick={() => {
                  if (action.requiresNote) {
                    setOpenAction(action);
                    setNote("");
                    return;
                  }

                  runAction(action);
                }}
              >
                {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <action.icon className="size-4" />}
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {actions.length === 0 ? (
          <div className="border-border/70 bg-surface-soft mt-4 rounded-xl border px-4 py-3 text-sm text-muted-foreground">
            No workflow actions are currently available for this listing state and role.
          </div>
        ) : (
          <div className="border-border/70 bg-surface-soft mt-4 rounded-xl border px-4 py-3 text-sm text-muted-foreground">
            {actions[0]?.description}
          </div>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-4 flex items-center justify-between gap-3 border-b pb-4">
          <div className="space-y-1">
            <p className="type-label">Approval timeline</p>
            <h3 className="type-section-title">Workflow history</h3>
          </div>
          <Badge variant="outline">{timeline.length} events</Badge>
        </header>

        {timeline.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="No workflow events yet"
            description="Timeline entries appear as soon as this listing enters review actions."
          />
        ) : (
          <ol className="space-y-3">
            {timeline.map((event) => (
              <li key={event.id} className="border-border/70 bg-card/55 rounded-xl border px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{COMPANY_LISTING_WORKFLOW_EVENT_LABELS[event.event_type]}</p>
                  <span className="text-muted-foreground text-xs">{formatTimelineDate(event.created_at)}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  Actor: {event.actorProfile?.display_name ?? "Unknown member"}
                </p>
                {event.from_status || event.to_status ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {event.from_status ? formatProviderListingStatus(event.from_status) : "--"} →{" "}
                    {event.to_status ? formatProviderListingStatus(event.to_status) : "--"}
                  </p>
                ) : null}
                {event.note ? (
                  <p className="border-border/70 bg-surface-soft mt-2 rounded-lg border px-2.5 py-2 text-xs text-foreground/90">
                    {event.note}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="border-border bg-card rounded-2xl border p-5 sm:p-6">
        <header className="border-border/70 mb-4 flex items-center justify-between gap-3 border-b pb-4">
          <div className="space-y-1">
            <p className="type-label">Reviewer notes</p>
            <h3 className="type-section-title">Review note timeline</h3>
          </div>
          <Badge variant="outline">{reviewerNotesTimeline.length} notes</Badge>
        </header>

        {reviewerNotesTimeline.length === 0 ? (
          <EmptyState
            icon={MessageSquarePlus}
            title="No reviewer notes yet"
            description="Reviewer notes appear here whenever changes are requested or approvals include context."
          />
        ) : (
          <ol className="space-y-3">
            {reviewerNotesTimeline.map((event) => (
              <li key={`${event.id}:note`} className="border-border/70 bg-card/55 rounded-xl border px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{COMPANY_LISTING_WORKFLOW_EVENT_LABELS[event.event_type]}</p>
                  <span className="text-muted-foreground text-xs">{formatTimelineDate(event.created_at)}</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {event.actorProfile?.display_name ?? "Unknown member"}
                </p>
                {event.from_status || event.to_status ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {event.from_status ? formatProviderListingStatus(event.from_status) : "--"} →{" "}
                    {event.to_status ? formatProviderListingStatus(event.to_status) : "--"}
                  </p>
                ) : null}
                <p className="border-border/70 bg-surface-soft mt-2 rounded-lg border px-2.5 py-2 text-xs text-foreground/95">
                  {event.note}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <Dialog open={Boolean(openAction)} onOpenChange={(open) => !open && setOpenAction(null)}>
        <DialogContent showClose={!isPending}>
          <DialogHeader>
            <DialogTitle>{openAction?.label}</DialogTitle>
            <DialogDescription>{openAction?.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="workflow-note" className="text-sm font-medium">
              Reviewer note{openAction?.noteOptional ? " (optional)" : ""}
            </label>
            <Textarea
              id="workflow-note"
              value={note}
              onChange={(event) => setNote(event.currentTarget.value)}
              rows={4}
              placeholder={
                openAction?.action === "needs_changes"
                  ? "Describe the specific updates required before this listing can be approved."
                  : "Optional approval note for the listing timeline."
              }
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={isPending} onClick={() => setOpenAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={
                isPending ||
                !openAction ||
                (openAction.requiresNote && !openAction.noteOptional && note.trim().length === 0)
              }
              onClick={() => {
                if (!openAction) {
                  return;
                }

                runAction(openAction, note);
                setOpenAction(null);
                setNote("");
              }}
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : null}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap gap-2">
        <Link href={`/dashboard/listings/${listingId}/edit?step=review`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open listing editor
        </Link>
        <Link href="/dashboard/listings" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          Back to listings
        </Link>
      </div>
    </div>
  );
}
