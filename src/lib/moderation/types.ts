import type { Enums, Tables } from "@/types/database";

export type ListingModerationStatus = Enums<"listing_status">;
export type ListingReportReason = Enums<"report_reason">;
export type ListingReportStatus = Enums<"report_status">;

export type ModerationStatusFilter = "all" | ListingReportStatus;

export type ModerationReportQueueRow = Pick<
  Tables<"listing_reports">,
  "id" | "listing_id" | "reporter_id" | "reason_code" | "details" | "status" | "created_at" | "updated_at" | "reviewed_at"
> & {
  listing: Pick<
    Tables<"listings">,
    | "id"
    | "slug"
    | "title"
    | "listing_status"
    | "listing_type"
    | "property_type"
    | "price_amount"
    | "currency_code"
    | "city"
    | "neighborhood"
    | "owner_id"
    | "updated_at"
  > | null;
  reporter: Pick<Tables<"profiles">, "id" | "display_name"> | null;
};

export type ModerationReportQueueItem = Omit<ModerationReportQueueRow, "listing"> & {
  listing: NonNullable<ModerationReportQueueRow["listing"]>;
  coverImagePath: string | null;
  coverImageUrl: string | null;
};

export type ModerationOverviewMetrics = {
  totalReports: number;
  openReports: number;
  underReviewReports: number;
  resolvedReports: number;
  dismissedReports: number;
  hiddenListings: number;
};

export type UpdateListingModerationVisibilityInput = {
  listingId: string;
  reportId?: string | null;
  action: "hide" | "unhide";
};

export type UpdateListingModerationVisibilityResult = {
  ok: boolean;
  message: string;
  previousStatus?: ListingModerationStatus;
  nextStatus?: ListingModerationStatus;
};
