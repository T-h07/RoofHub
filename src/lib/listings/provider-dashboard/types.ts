import type { Enums, Tables } from "@/types/database";

export type ProviderListingType = Enums<"listing_type">;
export type ProviderListingStatus = Enums<"listing_status">;

export type ProviderManagedListingRow = Pick<
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
  coverImagePath: string | null;
  coverImageUrl: string | null;
};

export type ProviderListingOverviewMetrics = {
  total: number;
  published: number;
  draft: number;
  paused: number;
  archived: number;
  sold: number;
  rented: number;
  unreadLeadsPlaceholder: number;
};

export const PROVIDER_LISTING_STATUS_FILTERS = [
  "all",
  "published",
  "draft",
  "paused",
  "sold",
  "rented",
  "archived",
] as const;

export type ProviderListingStatusFilter = (typeof PROVIDER_LISTING_STATUS_FILTERS)[number];

export function isProviderListingStatusFilter(
  value: string | null | undefined
): value is ProviderListingStatusFilter {
  if (!value) {
    return false;
  }

  return PROVIDER_LISTING_STATUS_FILTERS.includes(value as ProviderListingStatusFilter);
}
