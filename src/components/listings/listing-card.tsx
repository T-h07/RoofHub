import Image from "next/image";
import { Bath, BedDouble, Expand, Hourglass, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  EXPLORE_LISTING_TYPE_LABELS,
  EXPLORE_PROPERTY_TYPE_LABELS,
} from "@/lib/listings/explore-search-params";
import type { PublicExploreListing } from "@/lib/listings/public-explore";

type ListingCardProps = {
  listing: PublicExploreListing;
  className?: string;
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

function formatPrice(listing: PublicExploreListing) {
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

export function ListingCard({ listing, className }: ListingCardProps) {
  const locationLabel = listing.neighborhood
    ? `${listing.neighborhood}, ${listing.city}`
    : listing.city;

  return (
    <Card className={cn("group overflow-hidden", className)}>
      <div className="border-border/70 bg-muted/30 relative aspect-[16/10] border-b">
        {listing.coverImageUrl ? (
          <Image
            src={listing.coverImageUrl}
            alt={`Cover image for ${listing.title}`}
            fill
            unoptimized
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 50vw, 100vw"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,rgba(84,128,210,0.22),transparent_48%),linear-gradient(320deg,rgba(115,150,224,0.18),transparent_64%)]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />

        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
          <Badge variant={listing.listing_type === "rent" ? "primary" : "neutral"}>
            {EXPLORE_LISTING_TYPE_LABELS[listing.listing_type]}
          </Badge>
          <Badge variant="outline">{EXPLORE_PROPERTY_TYPE_LABELS[listing.property_type]}</Badge>
        </div>

        {!listing.coverImageUrl ? (
          <div className="absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/40 px-2.5 py-1 text-[0.7rem] font-semibold tracking-wide text-white uppercase">
            <Hourglass className="size-3.5" aria-hidden="true" />
            Image pending
          </div>
        ) : null}
      </div>

      <CardHeader className="space-y-2 pb-3">
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
          <MapPin className="size-3.5" aria-hidden="true" />
          {locationLabel}
        </p>
        <CardTitle className="line-clamp-2 text-base leading-snug">{listing.title}</CardTitle>
        <p className="text-lg font-semibold tracking-tight">{formatPrice(listing)}</p>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        <div className="text-muted-foreground grid grid-cols-3 gap-2 text-xs">
          <span className="border-border/70 bg-background/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
            <BedDouble className="size-3.5" aria-hidden="true" />
            {listing.bedrooms ?? "--"} bed
          </span>
          <span className="border-border/70 bg-background/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
            <Bath className="size-3.5" aria-hidden="true" />
            {formatBathrooms(listing.bathrooms)} bath
          </span>
          <span className="border-border/70 bg-background/60 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5">
            <Expand className="size-3.5" aria-hidden="true" />
            {formatArea(listing.area_m2)}
          </span>
        </div>

        <div className="border-border/70 flex items-center justify-between border-t pt-3">
          <span className="type-caption">Public listing</span>
          <span className="text-primary text-xs font-medium">Detail page planned in PT14</span>
        </div>
      </CardContent>
    </Card>
  );
}
