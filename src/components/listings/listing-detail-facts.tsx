import { Badge } from "@/components/ui/badge";
import type { PublicListingDetail } from "@/lib/listings/public-listing-detail";
import {
  EXPLORE_LISTING_TYPE_LABELS,
  EXPLORE_PROPERTY_TYPE_LABELS,
} from "@/lib/listings/explore-search-params";

type ListingDetailFactsProps = {
  listing: PublicListingDetail;
};

function formatBathrooms(value: number | null) {
  if (value === null) {
    return "N/A";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function formatArea(value: number) {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value)} m²`;
}

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode.toUpperCase() || "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "N/A";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function formatLocationMode(mode: PublicListingDetail["public_location_mode"]) {
  if (mode === "exact") {
    return "Exact map preview";
  }

  if (mode === "approximate") {
    return "Approximate map preview";
  }

  return "Hidden map location";
}

function isAvailableNow(availableFrom: string | null) {
  if (!availableFrom) {
    return false;
  }

  const parsed = new Date(availableFrom);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.getTime() <= Date.now();
}

function getFeatureItems(listing: PublicListingDetail) {
  const features: string[] = [];

  if (listing.furnished) {
    features.push("Furnished");
  }

  if (listing.parking) {
    features.push("Parking");
  }

  if (listing.pets_allowed) {
    features.push("Pets allowed");
  }

  if (listing.elevator) {
    features.push("Elevator");
  }

  if (listing.balcony) {
    features.push("Balcony");
  }

  if (listing.internet_included) {
    features.push("Internet included");
  }

  if (listing.utilities_included) {
    features.push("Utilities included");
  }

  if (isAvailableNow(listing.available_from)) {
    features.push("Available now");
  }

  return features;
}

export function ListingDetailSpecsGrid({ listing }: ListingDetailFactsProps) {
  const specs = [
    {
      label: "Listing type",
      value: EXPLORE_LISTING_TYPE_LABELS[listing.listing_type],
    },
    {
      label: "Property type",
      value: EXPLORE_PROPERTY_TYPE_LABELS[listing.property_type],
    },
    {
      label: "Area",
      value: formatArea(listing.area_m2),
    },
    {
      label: "Bedrooms",
      value: listing.bedrooms !== null ? String(listing.bedrooms) : "N/A",
    },
    {
      label: "Bathrooms",
      value: formatBathrooms(listing.bathrooms),
    },
    {
      label: "Floor",
      value: listing.floor_number !== null ? String(listing.floor_number) : "N/A",
    },
    {
      label: "Total floors",
      value: listing.total_floors !== null ? String(listing.total_floors) : "N/A",
    },
    {
      label: "Heating",
      value: listing.heating_type ? listing.heating_type.replace("_", " ") : "N/A",
    },
    {
      label: "Available from",
      value: formatDate(listing.available_from),
    },
    {
      label: "Deposit",
      value:
        listing.deposit_amount !== null
          ? formatCurrency(listing.deposit_amount, listing.currency_code)
          : "N/A",
    },
    {
      label: "Map visibility",
      value: formatLocationMode(listing.public_location_mode),
    },
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {specs.map((spec) => (
        <article
          key={spec.label}
          className="border-border/70 bg-card/50 rounded-lg border px-3 py-2.5"
        >
          <p className="type-label">{spec.label}</p>
          <p className="mt-1 text-sm font-medium tracking-tight">{spec.value}</p>
        </article>
      ))}
    </div>
  );
}

export function ListingDetailFeatures({ listing }: ListingDetailFactsProps) {
  const activeFeatures = getFeatureItems(listing);

  if (activeFeatures.length === 0) {
    return (
      <div className="border-border/70 bg-card/50 rounded-lg border px-4 py-3">
        <p className="text-muted-foreground text-sm">
          Additional amenities were not specified for this listing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {activeFeatures.map((feature) => (
        <Badge key={feature} variant="outline" className="px-2.5 py-1 text-xs font-medium">
          {feature}
        </Badge>
      ))}
    </div>
  );
}
