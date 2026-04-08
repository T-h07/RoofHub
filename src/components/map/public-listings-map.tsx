"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";
import MapLibre, {
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  type MapRef,
} from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";

import { buttonVariants } from "@/components/ui/button";
import type { PublicMapListing } from "@/lib/listings/public-map";
import { cn } from "@/lib/utils";

type PublicListingsMapProps = {
  mapStyleUrl: string;
  listings: PublicMapListing[];
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

function formatListingPrice(listing: PublicMapListing) {
  const amount = getCurrencyFormatter(listing.currency_code).format(listing.price_amount);
  return listing.listing_type === "rent" ? `${amount} / month` : amount;
}

function formatMarkerPrice(listing: PublicMapListing) {
  const formatter = new Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });

  const amount = formatter.format(listing.price_amount);

  return listing.listing_type === "rent" ? `${amount}/mo` : amount;
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

function getInitialViewState(listings: PublicMapListing[]): InitialViewState {
  if (listings.length === 0) {
    return {
      ...DEFAULT_CENTER,
      zoom: 10,
    };
  }

  const average = listings.reduce(
    (accumulator, listing) => {
      return {
        longitude: accumulator.longitude + listing.longitude,
        latitude: accumulator.latitude + listing.latitude,
      };
    },
    { longitude: 0, latitude: 0 }
  );

  return {
    longitude: average.longitude / listings.length,
    latitude: average.latitude / listings.length,
    zoom: listings.length === 1 ? 12 : 10,
  };
}

function getPopupListHref(listing: PublicMapListing) {
  const params = new URLSearchParams();
  params.set("q", listing.title);
  params.set("city", listing.city);

  return `/explore?${params.toString()}`;
}

export function PublicListingsMap({ mapStyleUrl, listings }: PublicListingsMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const initialViewState = useMemo(() => getInitialViewState(listings), [listings]);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(listings[0]?.id ?? null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRenderKey, setMapRenderKey] = useState(0);

  const selectedListing = useMemo(() => {
    if (!selectedListingId) {
      return null;
    }

    return listings.find((listing) => listing.id === selectedListingId) ?? null;
  }, [listings, selectedListingId]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current || listings.length === 0) {
      return;
    }

    if (listings.length === 1) {
      const listing = listings[0];
      mapRef.current.easeTo({
        center: [listing.longitude, listing.latitude],
        zoom: 12.5,
        duration: 0,
      });
      return;
    }

    const bounds = new maplibregl.LngLatBounds();

    for (const listing of listings) {
      bounds.extend([listing.longitude, listing.latitude]);
    }

    mapRef.current.fitBounds(bounds, {
      duration: 0,
      maxZoom: 12.5,
      padding: {
        top: 72,
        right: 56,
        bottom: 72,
        left: 56,
      },
    });
  }, [isMapReady, listings, mapRenderKey]);

  useEffect(() => {
    if (isMapReady || mapError) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (mapRef.current && mapRef.current.isStyleLoaded()) {
        setIsMapReady(true);
        return;
      }

      setMapError("Map surface is taking too long to initialize.");
    }, 9000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isMapReady, mapError, mapRenderKey]);

  return (
    <div className="border-border/75 bg-card/55 relative h-[68dvh] min-h-[26rem] overflow-hidden rounded-2xl border">
      <MapLibre
        key={`public-map-${mapRenderKey}`}
        ref={mapRef}
        mapLib={maplibregl}
        mapStyle={mapStyleUrl}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        onLoad={() => {
          setIsMapReady(true);
          setMapError(null);
        }}
        onIdle={() => {
          setIsMapReady(true);
          setMapError(null);
        }}
        onError={() => {
          setMapError("The map surface failed to load.");
          setIsMapReady(false);
        }}
      >
        <NavigationControl visualizePitch={false} position="top-right" />
        <ScaleControl position="bottom-left" unit="metric" />

        {listings.map((listing) => {
          const isSelected = listing.id === selectedListingId;
          const isApproximate = listing.public_location_mode === "approximate";

          return (
            <Marker key={listing.id} longitude={listing.longitude} latitude={listing.latitude} anchor="bottom">
              <button
                type="button"
                onClick={() => setSelectedListingId(listing.id)}
                className={cn(
                  "inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold tracking-tight shadow-lg transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
                  isSelected
                    ? "border-primary/85 bg-primary text-primary-foreground"
                    : "border-border/75 bg-background/92 text-foreground hover:border-primary/60 hover:bg-background",
                  isApproximate && !isSelected ? "border-dashed" : null
                )}
                aria-label={`Open map popup for ${listing.title}`}
              >
                <MapPin className="size-3.5" aria-hidden="true" />
                {formatMarkerPrice(listing)}
              </button>
            </Marker>
          );
        })}

        {selectedListing ? (
          <Popup
            className="nestmap-map-popup"
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
            <div className="border-border/80 bg-card/96 text-card-foreground overflow-hidden rounded-xl border">
              <div className="border-border/70 bg-muted/35 relative aspect-[16/10] border-b">
                {selectedListing.coverImageUrl ? (
                  <Image
                    src={selectedListing.coverImageUrl}
                    alt={`Cover image for ${selectedListing.title}`}
                    fill
                    unoptimized
                    sizes="320px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-[linear-gradient(140deg,rgba(95,134,212,0.26),transparent_55%),linear-gradient(300deg,rgba(120,152,222,0.18),transparent_60%)]" />
                )}
              </div>

              <div className="space-y-2.5 p-3.5">
                <p className="text-xs font-medium tracking-tight">
                  {selectedListing.neighborhood
                    ? `${selectedListing.neighborhood}, ${selectedListing.city}`
                    : selectedListing.city}
                </p>
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{selectedListing.title}</h3>
                <p className="text-sm font-semibold tracking-tight">{formatListingPrice(selectedListing)}</p>

                <div className="text-muted-foreground grid grid-cols-3 gap-1.5 text-[11px]">
                  <span className="border-border/70 bg-background/72 rounded-md border px-2 py-1">
                    {selectedListing.bedrooms ?? "--"} bed
                  </span>
                  <span className="border-border/70 bg-background/72 rounded-md border px-2 py-1">
                    {formatBathrooms(selectedListing.bathrooms)} bath
                  </span>
                  <span className="border-border/70 bg-background/72 rounded-md border px-2 py-1">
                    {formatArea(selectedListing.area_m2)}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <Link
                    href={getPopupListHref(selectedListing)}
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 gap-1.5 px-2.5 text-xs")}
                  >
                    Open in list
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                  <span className="text-muted-foreground text-[11px]">
                    Detail page planned in PT14
                  </span>
                </div>

                {selectedListing.public_location_mode === "approximate" ? (
                  <p className="text-muted-foreground text-[11px]">
                    Approximate area marker for privacy.
                  </p>
                ) : null}
              </div>
            </div>
          </Popup>
        ) : null}
      </MapLibre>

      {!isMapReady && !mapError ? (
        <div className="bg-background/65 absolute inset-0 z-10 grid place-items-center backdrop-blur-[1px]">
          <div className="border-border/75 bg-card/95 space-y-2 rounded-lg border px-4 py-3 text-center">
            <p className="text-sm font-semibold tracking-tight">Loading map surface</p>
            <p className="text-muted-foreground text-xs">Preparing markers and controls…</p>
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div className="bg-background/72 absolute inset-0 z-10 grid place-items-center backdrop-blur-[2px]">
          <div className="border-border/75 bg-card/96 space-y-3 rounded-lg border px-4 py-3 text-center">
            <p className="text-sm font-semibold tracking-tight">Map couldn’t load right now</p>
            <p className="text-muted-foreground text-xs">
              Check the style URL or retry to reinitialize the map.
            </p>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
              onClick={() => {
                setMapRenderKey((value) => value + 1);
                setMapError(null);
              }}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Retry map
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
