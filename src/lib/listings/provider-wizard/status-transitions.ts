import type { ProviderListingStatus } from "./types";

const STATUS_TRANSITION_MAP: Record<ProviderListingStatus, ProviderListingStatus[]> = {
  draft: ["published", "archived"],
  published: ["paused", "archived", "sold", "rented"],
  paused: ["published", "archived", "sold", "rented"],
  archived: [],
  sold: [],
  rented: [],
};

export function getAllowedProviderListingStatusTransitions(
  status: ProviderListingStatus
) {
  return STATUS_TRANSITION_MAP[status];
}

export function canTransitionProviderListingStatus(
  fromStatus: ProviderListingStatus,
  toStatus: ProviderListingStatus
) {
  return STATUS_TRANSITION_MAP[fromStatus].includes(toStatus);
}
