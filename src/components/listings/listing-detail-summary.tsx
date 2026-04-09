import { Bath, BedDouble, Expand, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { PublicListingDetail } from "@/lib/listings/public-listing-detail";
import {
  EXPLORE_LISTING_TYPE_LABELS,
  EXPLORE_PROPERTY_TYPE_LABELS,
} from "@/lib/listings/explore-search-params";

type ListingDetailSummaryProps = {
  listing: PublicListingDetail;
};

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

function formatPrice(listing: PublicListingDetail) {
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

export function ListingDetailSummary({ listing }: ListingDetailSummaryProps) {
  const locationLabel = listing.neighborhood
    ? `${listing.neighborhood}, ${listing.city}`
    : listing.city;

  return (
    <section className="border-border/75 bg-card/60 space-y-4 rounded-2xl border p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={listing.listing_type === "rent" ? "primary" : "neutral"}>
          {EXPLORE_LISTING_TYPE_LABELS[listing.listing_type]}
        </Badge>
        <Badge variant="outline">{EXPLORE_PROPERTY_TYPE_LABELS[listing.property_type]}</Badge>
        {listing.public_location_mode === "approximate" ? (
          <Badge variant="outline">Approximate location</Badge>
        ) : null}
      </div>

      <div className="space-y-2.5">
        <h1 className="type-page-title max-w-4xl">{listing.title}</h1>

        <p className="text-2xl font-semibold tracking-tight sm:text-[1.8rem]">
          {formatPrice(listing)}
        </p>

        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
          <MapPin className="size-4" aria-hidden="true" />
          {locationLabel}
        </p>

        {listing.public_location_mode === "exact" && listing.address_text ? (
          <p className="text-muted-foreground text-sm">{listing.address_text}</p>
        ) : listing.public_location_mode === "approximate" ? (
          <p className="text-muted-foreground text-sm">
            Map position is intentionally approximate to protect provider privacy.
          </p>
        ) : (
          <p className="text-muted-foreground text-sm">
            Exact street position is shared through provider contact.
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs sm:max-w-md">
        <span className="border-border/70 bg-background/58 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
          <BedDouble className="size-3.5" aria-hidden="true" />
          {listing.bedrooms ?? "--"} bed
        </span>
        <span className="border-border/70 bg-background/58 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
          <Bath className="size-3.5" aria-hidden="true" />
          {formatBathrooms(listing.bathrooms)} bath
        </span>
        <span className="border-border/70 bg-background/58 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
          <Expand className="size-3.5" aria-hidden="true" />
          {formatArea(listing.area_m2)}
        </span>
      </div>
    </section>
  );
}
