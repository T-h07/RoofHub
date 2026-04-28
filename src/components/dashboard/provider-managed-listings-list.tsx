import Image from "next/image";
import Link from "next/link";
import { Building2, Clock3, MapPin, SquareArrowOutUpRight } from "lucide-react";

import { ProviderListingLifecycleActions } from "@/components/dashboard/provider-listing-lifecycle-actions";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ProviderManagedListing, ProviderListingType } from "@/lib/listings/provider-dashboard/types";
import { isPublicDiscoveryListing } from "@/lib/listings/visibility";

type ListingsRoleMode =
  | "agent_primary"
  | "manager_secondary"
  | "owner_secondary"
  | "individual_primary";

type ProviderManagedListingsListProps = {
  listings: ProviderManagedListing[];
  roleMode?: ListingsRoleMode;
};

const LISTING_TYPE_LABELS: Record<ProviderListingType, string> = {
  rent: "Rent",
  sale: "Sale",
};

function formatPropertyType(value: ProviderManagedListing["property_type"]) {
  switch (value) {
    case "apartment":
      return "Apartment";
    case "house":
      return "House";
    case "studio":
      return "Studio";
    case "land":
      return "Land";
    case "commercial":
      return "Commercial";
    default:
      return value;
  }
}

function formatLocationLabel(listing: ProviderManagedListing) {
  if (listing.neighborhood) {
    return `${listing.neighborhood}, ${listing.city}`;
  }

  return listing.city;
}

function formatPriceLabel(listing: ProviderManagedListing) {
  const normalizedCurrency = listing.currency_code?.toUpperCase() || "EUR";
  const formattedAmount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(listing.price_amount);

  return listing.listing_type === "rent" ? `${formattedAmount} / month` : formattedAmount;
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "--";
  }

  return parsed.toLocaleDateString();
}

function buildEditHref(listingId: string) {
  return `/dashboard/listings/${listingId}/edit?step=basics`;
}

function buildWorkflowHref(listingId: string) {
  return `/dashboard/listings/${listingId}/workflow`;
}

function isReviewerSecondaryRoleMode(roleMode: ListingsRoleMode) {
  return roleMode === "manager_secondary" || roleMode === "owner_secondary";
}

function buildCompanyListingActionModel(input: {
  listing: ProviderManagedListing;
  roleMode: ListingsRoleMode;
}) {
  const { listing, roleMode } = input;
  const workflowHref = buildWorkflowHref(listing.id);
  const editHref = buildEditHref(listing.id);
  const isReviewerSecondary = isReviewerSecondaryRoleMode(roleMode);

  if (isReviewerSecondary) {
    switch (listing.listing_status) {
      case "draft":
        return {
          primary: { label: "Inspect draft", href: editHref },
          secondary: { label: "Workflow state", href: workflowHref },
        };
      case "needs_changes":
        return {
          primary: { label: "Workflow follow-up", href: workflowHref },
          secondary: { label: "Inspect listing", href: editHref },
        };
      case "submitted_for_review":
        return {
          primary: { label: "Review workflow", href: workflowHref },
          secondary: { label: "Inspect listing", href: editHref },
        };
      case "approved":
        return {
          primary: { label: "Publish workflow", href: workflowHref },
          secondary: { label: "Inspect listing", href: editHref },
        };
      default:
        return {
          primary: { label: "Open workflow", href: workflowHref },
          secondary: { label: "Open listing", href: editHref },
        };
    }
  }

  switch (listing.listing_status) {
    case "draft":
      return {
        primary: { label: "Continue editing", href: editHref },
        secondary: { label: "Workflow state", href: workflowHref },
      };
    case "needs_changes":
      return {
        primary: { label: "Resolve changes", href: editHref },
        secondary: { label: "Workflow notes", href: workflowHref },
      };
    case "submitted_for_review":
      return {
        primary: { label: "Track review", href: workflowHref },
        secondary: { label: "Open listing", href: editHref },
      };
    default:
      return {
        primary: { label: "Open listing", href: editHref },
        secondary: { label: "Workflow history", href: workflowHref },
      };
  }
}

function buildListingStatusGuidance(listing: ProviderManagedListing, roleMode: ListingsRoleMode) {
  const isReviewerSecondary = isReviewerSecondaryRoleMode(roleMode);

  if (isReviewerSecondary) {
    switch (listing.listing_status) {
      case "submitted_for_review":
        return "Reviewer action required now.";
      case "needs_changes":
        return "Waiting for revision progress.";
      case "approved":
        return "Ready for publish workflow decisions.";
      case "draft":
        return "Draft not yet in review queue.";
      case "hidden_by_admin":
        return "Moderation lock is active.";
      default:
        return "Use workflow for state history and routing.";
    }
  }

  switch (listing.listing_status) {
    case "draft":
      return "Next step: complete details and submit.";
    case "needs_changes":
      return "Next step: apply feedback and resubmit.";
    case "submitted_for_review":
      return "Waiting for reviewer decision.";
    case "approved":
      return "Approved by reviewer, check workflow state.";
    case "hidden_by_admin":
      return "Moderation lock is active.";
    default:
      return "Keep listing details current.";
  }
}

function renderOwnershipBadge(listing: ProviderManagedListing) {
  return listing.ownershipMode === "company" ? (
    <Badge variant="outline" className="text-[10px]">
      Company listing
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">
      Individual listing
    </Badge>
  );
}

function renderPreviewImage(listing: ProviderManagedListing) {
  if (listing.coverImageUrl) {
    return (
      <Image
        src={listing.coverImageUrl}
        alt={`Cover image for ${listing.title}`}
        fill
        sizes="(min-width: 1280px) 140px, (min-width: 768px) 100px, 100vw"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="h-full w-full bg-[linear-gradient(136deg,color-mix(in_oklch,var(--primary)_14%,var(--surface-soft))_0%,transparent_62%),linear-gradient(312deg,color-mix(in_oklch,var(--warm-accent)_14%,var(--surface-soft))_2%,transparent_70%)]" />
  );
}

export function ProviderManagedListingsList({
  listings,
  roleMode = "individual_primary",
}: ProviderManagedListingsListProps) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl border border-border/75 lg:block">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/28 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3.5 font-semibold">Listing</th>
              <th className="px-4 py-3.5 font-semibold">Status</th>
              <th className="px-4 py-3.5 font-semibold">Updated</th>
              <th className="px-4 py-3.5 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((listing) => {
              const statusGuidance = buildListingStatusGuidance(listing, roleMode);
              const companyActionModel =
                listing.ownershipMode === "company"
                  ? buildCompanyListingActionModel({ listing, roleMode })
                  : null;

              return (
              <tr key={listing.id} className="border-t border-border/70 align-top">
                <td className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="border-border/70 bg-muted/35 relative h-16 w-24 shrink-0 overflow-hidden rounded-lg border">
                      {renderPreviewImage(listing)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="truncate font-semibold tracking-tight">{listing.title}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {renderOwnershipBadge(listing)}
                        <p className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="size-3.5" aria-hidden="true" />
                            {LISTING_TYPE_LABELS[listing.listing_type]} • {formatPropertyType(listing.property_type)}
                          </span>
                          <span>{formatPriceLabel(listing)}</span>
                        </p>
                      </div>
                      <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                        <MapPin className="size-3.5" aria-hidden="true" />
                        {formatLocationLabel(listing)}
                      </p>
                      {listing.slug && isPublicDiscoveryListing(listing) ? (
                        <Link
                          href={`/listing/${listing.slug}`}
                          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
                        >
                          View public listing
                          <SquareArrowOutUpRight className="size-3" aria-hidden="true" />
                        </Link>
                      ) : listing.listing_status === "hidden_by_admin" ? (
                        <p className="text-destructive text-xs">
                          Hidden by admin moderation from public discovery.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <ProviderListingStatusBadge status={listing.listing_status} />
                  <p className="text-muted-foreground mt-1 text-xs">
                    {statusGuidance}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {formatTimestamp(listing.updated_at)}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  {companyActionModel ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link
                        href={companyActionModel.primary.href}
                        className={buttonVariants({ size: "sm" })}
                      >
                        {companyActionModel.primary.label}
                      </Link>
                      <Link
                        href={companyActionModel.secondary.href}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {companyActionModel.secondary.label}
                      </Link>
                    </div>
                  ) : (
                    <ProviderListingLifecycleActions
                      listingId={listing.id}
                      listingType={listing.listing_type}
                      currentStatus={listing.listing_status}
                      editHref={buildEditHref(listing.id)}
                    />
                  )}
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {listings.map((listing) => {
          const statusGuidance = buildListingStatusGuidance(listing, roleMode);
          const companyActionModel =
            listing.ownershipMode === "company"
              ? buildCompanyListingActionModel({ listing, roleMode })
              : null;

          return (
          <article
            key={listing.id}
            className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-semibold tracking-tight">{listing.title}</p>
                <p className="text-muted-foreground text-xs">
                  {LISTING_TYPE_LABELS[listing.listing_type]} • {formatPropertyType(listing.property_type)}
                </p>
                <p className="text-muted-foreground text-[11px]">
                  {statusGuidance}
                </p>
              </div>
              <ProviderListingStatusBadge status={listing.listing_status} />
            </div>

            <div className="flex items-center justify-between gap-2">
              {renderOwnershipBadge(listing)}
              <p className="text-muted-foreground text-[11px]">
                {listing.ownershipMode === "company"
                  ? "Managed through company workspace"
                  : "Managed as individual profile"}
              </p>
            </div>

            <div className="border-border/70 bg-muted/25 relative h-40 overflow-hidden rounded-lg border">
              {renderPreviewImage(listing)}
            </div>

            <div className="text-muted-foreground space-y-1 text-xs">
              <p>{formatPriceLabel(listing)}</p>
              <p>{formatLocationLabel(listing)}</p>
              <p>Updated {formatTimestamp(listing.updated_at)}</p>
              {listing.slug && isPublicDiscoveryListing(listing) ? (
                <Link
                  href={`/listing/${listing.slug}`}
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  View public listing
                  <SquareArrowOutUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : listing.listing_status === "hidden_by_admin" ? (
                <p className="text-destructive">Hidden by admin moderation.</p>
              ) : null}
            </div>

            {companyActionModel ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={companyActionModel.primary.href}
                  className={buttonVariants({ size: "sm" })}
                >
                  {companyActionModel.primary.label}
                </Link>
                <Link
                  href={companyActionModel.secondary.href}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {companyActionModel.secondary.label}
                </Link>
              </div>
            ) : (
              <ProviderListingLifecycleActions
                listingId={listing.id}
                listingType={listing.listing_type}
                currentStatus={listing.listing_status}
                editHref={buildEditHref(listing.id)}
              />
            )}
          </article>
        );
        })}
      </div>
    </>
  );
}
