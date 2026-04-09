import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";

import type { ListingStatus } from "./types";

export const CONVERSATION_CONTACTABLE_LISTING_STATUSES = [PUBLIC_DISCOVERY_STATUS] as const;

export function isListingContactableForNewConversation(status: ListingStatus) {
  return CONVERSATION_CONTACTABLE_LISTING_STATUSES.includes(
    status as (typeof CONVERSATION_CONTACTABLE_LISTING_STATUSES)[number]
  );
}