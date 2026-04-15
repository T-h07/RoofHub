import type { ProviderListingStatus } from "./types";

const STATUS_TRANSITION_MAP: Record<ProviderListingStatus, ProviderListingStatus[]> = {
  draft: ["published", "archived"],
  submitted_for_review: [],
  needs_changes: [],
  approved: [],
  published: ["paused", "archived", "sold", "rented"],
  unpublished: [],
  paused: ["published", "archived", "sold", "rented"],
  archived: ["draft"],
  sold: ["archived"],
  rented: ["published", "archived"],
  hidden_by_admin: [],
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
