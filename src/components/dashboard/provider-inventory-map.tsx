"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ExternalLink,
  LoaderCircle,
  MapPin,
  Rows3,
} from "lucide-react";
import MapLibre, {
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
} from "react-map-gl/maplibre";

import { ProviderListingStatusBadge } from "@/components/dashboard/provider-listing-status-badge";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import type { ProviderInventoryMapListing } from "@/lib/listings/provider-dashboard/types";
import { isPublicDiscoveryListing } from "@/lib/listings/visibility";
import { useThemedMapStyleUrl } from "@/lib/map/use-themed-map-style";
import { cn } from "@/lib/utils";

type ProviderInventoryMapProps = {
  mapStyleUrl: string;
  listings: ProviderInventoryMapListing[];
  totalCount: number;
  title: string;
  description: string;
  emptyDescription: string;
  inventoryHref: string;
};

type InitialViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

const DEFAULT_CENTER = {
  longitude: 13.404954,
  latitude: 52.520008,
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function formatPriceLabel(listing: ProviderInventoryMapListing) {
  const normalizedCurrency = listing.currency_code?.toUpperCase() || "EUR";
  const formattedAmount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(listing.price_amount);

  return listing.listing_type === "rent" ? `${formattedAmount} / month` : formattedAmount;
}

function formatUpdatedDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Updated recently";
  }

  return `Updated ${parsed.toLocaleDateString()}`;
}

function getLocationLabel(listing: ProviderInventoryMapListing) {
  return listing.neighborhood ? `${listing.neighborhood}, ${listing.city}` : listing.city;
}

function getListingActionHref(listing: ProviderInventoryMapListing) {
  if (listing.ownershipMode === "company") {
    return `/dashboard/listings/${listing.id}/workflow`;
  }

  return `/dashboard/listings/${listing.id}/edit?step=basics`;
}

function getMarkerColor(status: ProviderInventoryMapListing["listing_status"]) {
  if (status === "published") {
    return "#0f9f67";
  }

  if (status === "submitted_for_review") {
    return "#df8d2b";
  }

  if (status === "needs_changes") {
    return "#a06b22";
  }

  if (status === "hidden_by_admin") {
    return "#b42334";
  }

  if (status === "archived") {
    return "#667085";
  }

  return "#3567c8";
}

function getInitialViewState(listings: ProviderInventoryMapListing[]): InitialViewState {
  if (listings.length === 0) {
    return {
      ...DEFAULT_CENTER,
      zoom: 10,
    };
  }

  if (listings.length === 1) {
    return {
      longitude: listings[0].longitude,
      latitude: listings[0].latitude,
      zoom: 12.8,
    };
  }

  const average = listings.reduce(
    (accumulator, listing) => ({
      longitude: accumulator.longitude + listing.longitude,
      latitude: accumulator.latitude + listing.latitude,
    }),
    { longitude: 0, latitude: 0 }
  );

  const centerLongitude = average.longitude / listings.length;
  const centerLatitude = average.latitude / listings.length;
  const longitudes = listings.map((listing) => listing.longitude);
  const latitudes = listings.map((listing) => listing.latitude);
  const span = Math.max(
    Math.max(...longitudes) - Math.min(...longitudes),
    Math.max(...latitudes) - Math.min(...latitudes)
  );
  const zoom = clamp(Math.log2(360 / Math.max(span, 0.0012)), 4.2, 12.5);

  return {
    longitude: centerLongitude,
    latitude: centerLatitude,
    zoom,
  };
}

export function ProviderInventoryMap({
  mapStyleUrl,
  listings,
  totalCount,
  title,
  description,
  emptyDescription,
  inventoryHref,
}: ProviderInventoryMapProps) {
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const themedMapStyleUrl = useThemedMapStyleUrl(mapStyleUrl);
  const initialViewState = useMemo(() => getInitialViewState(listings), [listings]);
  const selectedListing = useMemo(() => {
    if (!selectedListingId) {
      return null;
    }

    return listings.find((listing) => listing.id === selectedListingId) ?? null;
  }, [listings, selectedListingId]);
  const previewListings = listings.slice(0, 10);

  useEffect(() => {
    setMapReady(false);
  }, [themedMapStyleUrl]);

  return (
    <section className="border-border/80 bg-card/88 space-y-4 rounded-2xl border p-5 sm:p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">Inventory map</Badge>
          <Badge variant="outline">{listings.length} mappable</Badge>
          <Badge variant="outline">{totalCount} total in scope</Badge>
        </div>
        <h2 className="type-section-title">{title}</h2>
        <p className="type-body-muted">{description}</p>
      </header>

      {listings.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No mappable listings yet"
          description={emptyDescription}
          action={
            <Link href={inventoryHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open listing inventory
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="border-border/75 bg-background relative h-[24rem] overflow-hidden rounded-xl border">
            <MapLibre
              mapLib={import("maplibre-gl")}
              mapStyle={themedMapStyleUrl}
              initialViewState={initialViewState}
              style={{ width: "100%", height: "100%" }}
              dragRotate={false}
              touchPitch={false}
              attributionControl={false}
              onLoad={() => setMapReady(true)}
              onStyleData={() => setMapReady(true)}
            >
              <NavigationControl visualizePitch={false} position="top-right" />
              <ScaleControl position="bottom-left" unit="metric" />

              {listings.map((listing) => (
                <Marker
                  key={listing.id}
                  longitude={listing.longitude}
                  latitude={listing.latitude}
                  anchor="center"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedListingId(listing.id)}
                    className="h-4.5 w-4.5 rounded-full border border-slate-950/70 shadow-[0_0_0_2px_rgba(3,8,20,0.26)] transition-transform hover:scale-105"
                    style={{ backgroundColor: getMarkerColor(listing.listing_status) }}
                    aria-label={`Open map details for ${listing.title}`}
                  />
                </Marker>
              ))}

              {selectedListing ? (
                <Popup
                  closeButton
                  closeOnClick={false}
                  focusAfterOpen={false}
                  maxWidth="320px"
                  anchor="top"
                  offset={18}
                  longitude={selectedListing.longitude}
                  latitude={selectedListing.latitude}
                  onClose={() => setSelectedListingId(null)}
                >
                  <div className="space-y-2.5 py-1">
                    <p className="text-xs font-semibold tracking-tight">{selectedListing.title}</p>
                    <p className="text-muted-foreground text-xs">{getLocationLabel(selectedListing)}</p>
                    <ProviderListingStatusBadge status={selectedListing.listing_status} />
                    <p className="text-sm font-semibold">{formatPriceLabel(selectedListing)}</p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href={getListingActionHref(selectedListing)}
                        className={cn(buttonVariants({ size: "sm" }), "h-8 px-2.5 text-xs")}
                      >
                        Open listing
                      </Link>
                      {selectedListing.slug && isPublicDiscoveryListing(selectedListing) ? (
                        <Link
                          href={`/listing/${selectedListing.slug}`}
                          className={cn(
                            buttonVariants({ variant: "ghost", size: "sm" }),
                            "h-8 px-2 text-xs"
                          )}
                        >
                          Public page
                          <ExternalLink className="size-3.5" aria-hidden="true" />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </Popup>
              ) : null}
            </MapLibre>

            {!mapReady ? (
              <div className="bg-background/70 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
                <div className="border-border/75 bg-card/96 rounded-lg border px-3.5 py-2 text-sm font-medium">
                  <span className="inline-flex items-center gap-2">
                    <LoaderCircle className="size-4 animate-spin" />
                    Loading map
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold tracking-tight">Mapped listings</p>
              <Link href={inventoryHref} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                <Rows3 className="size-3.5" />
                Full inventory
              </Link>
            </div>

            <ul className="max-h-[24rem] space-y-2 overflow-y-auto pr-0.5">
              {previewListings.map((listing) => (
                <li key={`map-listing-${listing.id}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedListingId(listing.id)}
                    className={cn(
                      "border-border/70 bg-surface-soft/86 hover:border-border w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
                      selectedListingId === listing.id ? "border-primary/55 bg-primary/10" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold tracking-tight">{listing.title}</p>
                      <ProviderListingStatusBadge status={listing.listing_status} />
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">{getLocationLabel(listing)}</p>
                    <div className="text-muted-foreground mt-1 flex items-center justify-between text-[11px]">
                      <span>{formatPriceLabel(listing)}</span>
                      <span>{formatUpdatedDate(listing.updated_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
