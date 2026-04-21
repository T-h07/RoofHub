import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, Expand, ExternalLink, MapPin } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicMapListing } from "@/lib/listings/public-map";
import { cn } from "@/lib/utils";

type MapResultsPaneProps = {
  listings: PublicMapListing[];
  totalCount: number;
  hasAppliedBounds: boolean;
  isTruncated: boolean;
  markerLimit: number;
  exploreHref: string;
  hasActiveFilters: boolean;
};

const MAX_VISIBLE_LIST_ITEMS = 80;
const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currencyCode: string) {
  const normalizedCurrency = currencyCode?.toUpperCase() || "EUR";
  const cacheKey = `en-${normalizedCurrency}`;

  if (!currencyFormatterCache.has(cacheKey)) {
    currencyFormatterCache.set(
      cacheKey,
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: normalizedCurrency,
        maximumFractionDigits: 0,
      })
    );
  }

  return currencyFormatterCache.get(cacheKey)!;
}

function formatPrice(listing: PublicMapListing) {
  const amount = getCurrencyFormatter(listing.currency_code).format(listing.price_amount);

  return listing.listing_type === "rent" ? `${amount} / month` : amount;
}

function formatBathrooms(value: number | null) {
  if (value === null) {
    return "--";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function formatArea(value: number) {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)} m²`;
}

function getListingDetailHref(listing: PublicMapListing) {
  return `/listing/${listing.slug}`;
}

export function MapResultsPane({
  listings,
  totalCount,
  hasAppliedBounds,
  isTruncated,
  markerLimit,
  exploreHref,
  hasActiveFilters,
}: MapResultsPaneProps) {
  const visibleListings = listings.slice(0, MAX_VISIBLE_LIST_ITEMS);

  return (
    <aside className="border-border/75 bg-card/88 rounded-2xl border lg:max-h-[68dvh] lg:overflow-hidden">
      <div className="border-border/70 bg-card/94 space-y-1.5 border-b px-4 py-3.5">
        <p className="text-sm font-semibold tracking-tight">
          {totalCount === 0 ? "No results" : `${totalCount} results in map search`}
        </p>
        <p className="text-muted-foreground text-xs">
          {hasAppliedBounds
            ? "Applied area + active filters are reflected here."
            : "Current filters are applied. Move map and use Search this area to refine."}
        </p>
      </div>

      {visibleListings.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={MapPin}
            title="No listings in this area"
            description={
              hasActiveFilters
                ? "Adjust filters or search another area to widen the result set."
                : "Search another area or switch to list view for broader browsing."
            }
            action={
              <Link href={exploreHref} className={buttonVariants({ size: "sm", variant: "outline" })}>
                Open list view
              </Link>
            }
            className="py-7"
          />
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto px-3 py-3 lg:max-h-[calc(68dvh-78px)]">
          {visibleListings.map((listing) => {
            const locationLabel = listing.neighborhood
              ? `${listing.neighborhood}, ${listing.city}`
              : listing.city;

            return (
              <article
                key={listing.id}
                className="border-border/70 bg-surface-soft/80 hover:bg-surface-soft rounded-xl border p-2.5 transition-colors"
              >
                <div className="flex gap-2.5">
                  <div className="border-border/65 bg-muted/35 relative h-[88px] w-[110px] shrink-0 overflow-hidden rounded-lg border">
                    {listing.coverImageUrl ? (
                      <Image
                        src={listing.coverImageUrl}
                        alt={`Cover image for ${listing.title}`}
                        fill
                        sizes="120px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-[linear-gradient(136deg,color-mix(in_oklch,var(--primary)_14%,var(--surface-soft))_0%,transparent_64%),linear-gradient(306deg,color-mix(in_oklch,var(--warm-accent)_16%,var(--surface-soft))_0%,transparent_72%)]" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
                      <MapPin className="size-3.5" aria-hidden="true" />
                      {locationLabel}
                    </p>
                    <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</h3>
                    <p className="text-sm font-semibold tracking-tight">{formatPrice(listing)}</p>
                    <div className="text-muted-foreground flex flex-wrap gap-1.5 text-[11px]">
                      <span className="border-border/70 bg-card inline-flex items-center gap-1 rounded-md border px-1.5 py-1">
                        <BedDouble className="size-3" aria-hidden="true" />
                        {listing.bedrooms ?? "--"}
                      </span>
                      <span className="border-border/70 bg-card inline-flex items-center gap-1 rounded-md border px-1.5 py-1">
                        <Bath className="size-3" aria-hidden="true" />
                        {formatBathrooms(listing.bathrooms)}
                      </span>
                      <span className="border-border/70 bg-card inline-flex items-center gap-1 rounded-md border px-1.5 py-1">
                        <Expand className="size-3" aria-hidden="true" />
                        {formatArea(listing.area_m2)}
                      </span>
                    </div>
                    <Link
                      href={getListingDetailHref(listing)}
                      className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 px-2 text-xs")}
                    >
                      View details
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}

          {listings.length > MAX_VISIBLE_LIST_ITEMS ? (
            <div className="text-muted-foreground px-1 py-1 text-xs">
              Showing the first {MAX_VISIBLE_LIST_ITEMS} items in the side pane.
            </div>
          ) : null}
        </div>
      )}

      {isTruncated ? (
        <div className="border-border/70 bg-warning/10 text-warning border-t px-4 py-2.5 text-xs">
          Result fetch capped at {markerLimit} rows for stable map performance.
        </div>
      ) : null}
    </aside>
  );
}
