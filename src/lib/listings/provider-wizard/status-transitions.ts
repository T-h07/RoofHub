import type { ProviderListingStatus } from "./types";

const STATUS_TRANSITION_MAP: Record<ProviderListingStatus, ProviderListingStatus[]> = {
  draft: ["published", "archived"],
  published: ["paused", "archived"],
  paused: ["published", "archived"],
  archived: [],
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
