import type { Enums, Tables } from "@/types/database";

export type ProviderListingType = Enums<"listing_type">;
export type ProviderListingStatus = Enums<"listing_status">;

export const PROVIDER_LISTING_STATUS_VALUES = [
  "draft",
  "submitted_for_review",
  "needs_changes",
  "approved",
  "published",
  "unpublished",
  "paused",
  "archived",
  "sold",
  "rented",
  "hidden_by_admin",
] as const satisfies readonly ProviderListingStatus[];

export type ProviderManagedListingRow = Pick<
  Tables<"listings">,
  | "id"
  | "organization_id"
  | "created_by_user_id"
  | "assigned_agent_user_id"
  | "published_by_user_id"
  | "slug"
  | "title"
  | "listing_status"
  | "listing_type"
  | "property_type"
  | "price_amount"
  | "currency_code"
  | "city"
  | "neighborhood"
  | "published_at"
  | "archived_at"
  | "updated_at"
  | "created_at"
> & {
  listing_images:
    | Array<Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">>
    | null;
};

export type ProviderManagedListing = Omit<ProviderManagedListingRow, "listing_images"> & {
  ownershipMode: "individual" | "company";
  coverImagePath: string | null;
  coverImageUrl: string | null;
};

export type ProviderInventoryMapListingRow = Pick<
  Tables<"listings">,
  | "id"
  | "organization_id"
  | "slug"
  | "title"
  | "listing_status"
  | "listing_type"
  | "property_type"
  | "price_amount"
  | "currency_code"
  | "city"
  | "neighborhood"
  | "latitude"
  | "longitude"
  | "public_location_mode"
  | "updated_at"
>;

export type ProviderInventoryMapListing = Omit<
  ProviderInventoryMapListingRow,
  "latitude" | "longitude"
> & {
  ownershipMode: "individual" | "company";
  latitude: number;
  longitude: number;
};

export type ProviderInventoryMapScope = "owner" | "organization" | "mixed";

export type ProviderListingOverviewMetrics = {
  total: number;
  published: number;
  draft: number;
  submittedForReview: number;
  needsChanges: number;
  approved: number;
  unpublished: number;
  paused: number;
  archived: number;
  sold: number;
  rented: number;
  hiddenByAdmin: number;
  unreadLeadsCount: number;
};

export const PROVIDER_LISTING_STATUS_FILTERS = [
  "all",
  "published",
  "draft",
  "submitted_for_review",
  "needs_changes",
  "approved",
  "unpublished",
  "paused",
  "sold",
  "rented",
  "archived",
  "hidden_by_admin",
] as const;

export type ProviderListingStatusFilter = (typeof PROVIDER_LISTING_STATUS_FILTERS)[number];

export function isProviderListingStatus(value: unknown): value is ProviderListingStatus {
  return (
    typeof value === "string" &&
    PROVIDER_LISTING_STATUS_VALUES.includes(value as ProviderListingStatus)
  );
}

export function isProviderListingStatusFilter(
  value: string | null | undefined
): value is ProviderListingStatusFilter {
  if (!value) {
    return false;
  }

  return PROVIDER_LISTING_STATUS_FILTERS.includes(value as ProviderListingStatusFilter);
}
