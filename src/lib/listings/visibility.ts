import type { Enums } from "@/types/database";

export type ListingVisibilityStatus = Enums<"listing_status">;
export type ListingPublicVisibility = "public" | "private";

export const PUBLIC_DISCOVERY_STATUS: ListingVisibilityStatus = "published";

export function isPublicDiscoveryStatus(status: ListingVisibilityStatus) {
  return status === PUBLIC_DISCOVERY_STATUS;
}

export function getListingPublicVisibility(status: ListingVisibilityStatus): ListingPublicVisibility {
  return isPublicDiscoveryStatus(status) ? "public" : "private";
}

export function isPublicDiscoveryListing(input: {
  listing_status: ListingVisibilityStatus;
}) {
  return isPublicDiscoveryStatus(input.listing_status);
}

export function getListingPublicVisibilityLabel(status: ListingVisibilityStatus) {
  return isPublicDiscoveryStatus(status)
    ? "Visible on explore, listing detail, and map discovery."
    : "Hidden from public discovery until it is published.";
}
