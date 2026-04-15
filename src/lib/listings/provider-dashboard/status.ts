import type { ProviderListingStatus, ProviderListingStatusFilter } from "./types";

export const PROVIDER_LISTING_STATUS_LABELS: Record<ProviderListingStatus, string> = {
  draft: "Draft",
  submitted_for_review: "In review",
  needs_changes: "Needs changes",
  approved: "Approved",
  published: "Active",
  unpublished: "Unpublished",
  paused: "Paused",
  archived: "Archived",
  sold: "Sold",
  rented: "Rented",
  hidden_by_admin: "Hidden by admin",
};

export const PROVIDER_LISTING_FILTER_LABELS: Record<ProviderListingStatusFilter, string> = {
  all: "All listings",
  published: "Active",
  draft: "Draft",
  submitted_for_review: "In review",
  needs_changes: "Needs changes",
  approved: "Approved",
  unpublished: "Unpublished",
  paused: "Paused",
  sold: "Sold",
  rented: "Rented",
  archived: "Archived",
  hidden_by_admin: "Hidden by admin",
};

export function formatProviderListingStatus(value: ProviderListingStatus) {
  return PROVIDER_LISTING_STATUS_LABELS[value];
}
