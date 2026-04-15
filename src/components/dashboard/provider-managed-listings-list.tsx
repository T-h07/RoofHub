import Image from "next/image";
import Link from "next/link";
import { Building2, Clock3, MapPin, SquareArrowOutUpRight } from "lucide-react";

import { ProviderListingLifecycleActions } from "@/components/dashboard/provider-listing-lifecycle-actions";
import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { ProviderManagedListing, ProviderListingType } from "@/lib/listings/provider-dashboard/types";

type ProviderManagedListingsListProps = {
  listings: ProviderManagedListing[];
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
        unoptimized
        sizes="(min-width: 1280px) 140px, (min-width: 768px) 100px, 100vw"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div className="h-full w-full bg-[linear-gradient(136deg,color-mix(in_oklch,var(--primary)_14%,var(--surface-soft))_0%,transparent_62%),linear-gradient(312deg,color-mix(in_oklch,var(--warm-accent)_14%,var(--surface-soft))_2%,transparent_70%)]" />
  );
}

export function ProviderManagedListingsList({ listings }: ProviderManagedListingsListProps) {
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
            {listings.map((listing) => (
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
                      {listing.slug && listing.listing_status === "published" ? (
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
                </td>
                <td className="px-4 py-3.5">
                  <p className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Clock3 className="size-3.5" aria-hidden="true" />
                    {formatTimestamp(listing.updated_at)}
                  </p>
                </td>
                <td className="px-4 py-3.5">
                  {listing.ownershipMode === "company" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/listings/${listing.id}/workflow`}
                        className={buttonVariants({ size: "sm" })}
                      >
                        Workflow
                      </Link>
                      <Link
                        href={buildEditHref(listing.id)}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Edit
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
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {listings.map((listing) => (
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
              {listing.slug && listing.listing_status === "published" ? (
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

            {listing.ownershipMode === "company" ? (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/dashboard/listings/${listing.id}/workflow`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Workflow
                </Link>
                <Link
                  href={buildEditHref(listing.id)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Edit
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
        ))}
      </div>
    </>
  );
}
