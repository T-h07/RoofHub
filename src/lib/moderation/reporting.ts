import type { ListingReportReason, ListingReportStatus, ModerationStatusFilter } from "./types";

export const LISTING_REPORT_REASON_OPTIONS: ReadonlyArray<{
  value: ListingReportReason;
  label: string;
  description: string;
}> = [
  {
    value: "spam",
    label: "Spam or scam",
    description: "Commercial spam, scam attempts, or deceptive contact patterns.",
  },
  {
    value: "fraud",
    label: "Suspected fraud",
    description: "Identity, payment, ownership, or other high-risk fraud concerns.",
  },
  {
    value: "duplicate",
    label: "Duplicate listing",
    description: "The same property appears multiple times with duplicated content.",
  },
  {
    value: "incorrect_information",
    label: "Incorrect information",
    description: "Price, details, or location information appears materially incorrect.",
  },
  {
    value: "inappropriate",
    label: "Inappropriate content",
    description: "Abusive, offensive, or policy-violating text or imagery.",
  },
  {
    value: "other",
    label: "Other safety concern",
    description: "A different issue not covered by the categories above.",
  },
] as const;

export const LISTING_REPORT_REASON_VALUES = LISTING_REPORT_REASON_OPTIONS.map(
  (option) => option.value
) as readonly ListingReportReason[];

export const LISTING_REPORT_STATUS_LABELS: Record<ListingReportStatus, string> = {
  open: "Open",
  under_review: "Under review",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

export const MODERATION_STATUS_FILTER_OPTIONS: ReadonlyArray<{
  value: ModerationStatusFilter;
  label: string;
}> = [
  { value: "all", label: "All reports" },
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
] as const;

export function isListingReportReason(value: unknown): value is ListingReportReason {
  return (
    typeof value === "string" &&
    LISTING_REPORT_REASON_VALUES.includes(value as ListingReportReason)
  );
}

export function getListingReportReasonLabel(reason: ListingReportReason) {
  return (
    LISTING_REPORT_REASON_OPTIONS.find((option) => option.value === reason)?.label ??
    "Unknown reason"
  );
}

export function getListingReportStatusLabel(status: ListingReportStatus) {
  return LISTING_REPORT_STATUS_LABELS[status];
}

export function isModerationStatusFilter(value: unknown): value is ModerationStatusFilter {
  return (
    typeof value === "string" &&
    MODERATION_STATUS_FILTER_OPTIONS.some((option) => option.value === value)
  );
}
