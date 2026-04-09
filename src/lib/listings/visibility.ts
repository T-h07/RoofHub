import type { Enums } from "@/types/database";

export type ListingVisibilityStatus = Enums<"listing_status">;

export const PUBLIC_DISCOVERY_STATUS: ListingVisibilityStatus = "published";

export function isPublicDiscoveryStatus(status: ListingVisibilityStatus) {
  return status === PUBLIC_DISCOVERY_STATUS;
}
