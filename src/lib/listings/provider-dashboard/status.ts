import type { ProviderListingStatus, ProviderListingStatusFilter } from "./types";

export const PROVIDER_LISTING_STATUS_LABELS: Record<ProviderListingStatus, string> = {
  draft: "Draft",
  published: "Active",
  paused: "Paused",
  archived: "Archived",
  sold: "Sold",
  rented: "Rented",
};

export const PROVIDER_LISTING_FILTER_LABELS: Record<ProviderListingStatusFilter, string> = {
  all: "All listings",
  published: "Active",
  draft: "Draft",
  paused: "Paused",
  sold: "Sold",
  rented: "Rented",
  archived: "Archived",
};

export function formatProviderListingStatus(value: ProviderListingStatus) {
  return PROVIDER_LISTING_STATUS_LABELS[value];
}
