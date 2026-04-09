"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { FeatureCollection, Point } from "geojson";
import { ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import MapLibre, {
  Layer,
  NavigationControl,
  Popup,
  ScaleControl,
  Source,
  type LayerProps,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type { GeoJSONSource } from "maplibre-gl";

import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_PUBLIC_MAP_STYLE_URL } from "@/lib/config/map";
import {
  MAP_BOUNDS_PARAM,
  areBoundsMeaningfullyDifferent,
  parseMapSearchBounds,
  serializeMapSearchBounds,
  type MapSearchBounds,
} from "@/lib/listings/map-bounds";
import type { PublicMapListing } from "@/lib/listings/public-map";
import { cn } from "@/lib/utils";

type PublicListingsMapProps = {
  mapStyleUrl: string;
  listings: PublicMapListing[];
  appliedBounds: MapSearchBounds | null;
};

type InitialViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
};

type ListingPointProperties = {
  listingId: string;
  priceLabel: string;
  approximate: 0 | 1;
};

const LISTINGS_SOURCE_ID = "public-listings";
const CLUSTER_LAYER_ID = "listing-clusters";
const CLUSTER_COUNT_LAYER_ID = "listing-cluster-count";
const POINT_LAYER_ID = "listing-points";
const POINT_LABEL_LAYER_ID = "listing-point-labels";

const DEFAULT_CENTER = {
  longitude: 13.404954,
  latitude: 52.520008,
};

const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

const clusterCircleLayer: LayerProps = {
  id: CLUSTER_LAYER_ID,
  type: "circle",
  source: LISTINGS_SOURCE_ID,
  filter: ["has", "point_count"],
  paint: {
    "circle-color": ["step", ["get", "point_count"], "#5fa6ff", 16, "#3f89f4", 52, "#2a66d9"],
    "circle-radius": ["step", ["get", "point_count"], 18, 16, 23, 52, 29],
    "circle-stroke-color": "rgba(4, 12, 28, 0.92)",
    "circle-stroke-width": 1.8,
    "circle-opacity": 0.92,
  },
};

const clusterCountLayer: LayerProps = {
  id: CLUSTER_COUNT_LAYER_ID,
  type: "symbol",
  source: LISTINGS_SOURCE_ID,
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-size": 11.5,
    "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
  },
  paint: {
    "text-color": "rgba(245, 249, 255, 0.96)",
  },
};

const unclusteredPointLayer: LayerProps = {
  id: POINT_LAYER_ID,
  type: "circle",
  source: LISTINGS_SOURCE_ID,
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": ["case", ["==", ["get", "approximate"], 1], "#5d88ce", "#71b0ff"],
    "circle-radius": 12.5,
    "circle-stroke-color": "rgba(3, 10, 24, 0.9)",
    "circle-stroke-width": 1.6,
    "circle-opacity": 0.92,
  },
};

const unclusteredLabelLayer: LayerProps = {
  id: POINT_LABEL_LAYER_ID,
  type: "symbol",
  source: LISTINGS_SOURCE_ID,
  filter: ["!", ["has", "point_count"]],
  layout: {
    "text-field": ["get", "priceLabel"],
    "text-size": 10.25,
    "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
    "text-allow-overlap": false,
    "text-ignore-placement": false,
  },
  paint: {
    "text-color": "rgba(244, 249, 255, 0.94)",
    "text-halo-color": "rgba(3, 11, 24, 0.95)",
    "text-halo-width": 0.7,
  },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function estimateZoomFromBounds(bounds: MapSearchBounds) {
  const lngSpan = Math.max(bounds.east - bounds.west, 0.00001);
  const latSpan = Math.max(bounds.north - bounds.south, 0.00001);
  const span = Math.max(lngSpan, latSpan);
  const zoom = Math.log2(360 / span);

  return clamp(zoom, 2, 14);
}

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

function getInitialViewState(
  listings: PublicMapListing[],
  appliedBounds: MapSearchBounds | null
): InitialViewState {
  if (appliedBounds) {
    return {
      longitude: (appliedBounds.west + appliedBounds.east) / 2,
      latitude: (appliedBounds.south + appliedBounds.north) / 2,
      zoom: estimateZoomFromBounds(appliedBounds),
    };
  }

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

function readBoundsFromMap(mapRef: MapRef | null) {
  const mapBounds = mapRef?.getMap().getBounds();

  if (!mapBounds) {
    return null;
  }

  return parseMapSearchBounds(
    `${mapBounds.getWest()},${mapBounds.getSouth()},${mapBounds.getEast()},${mapBounds.getNorth()}`
  );
}

export function PublicListingsMap({ mapStyleUrl, listings, appliedBounds }: PublicListingsMapProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isAreaSearchPending, startAreaSearchTransition] = useTransition();
  const mapRef = useRef<MapRef | null>(null);
  const baselineBoundsRef = useRef<MapSearchBounds | null>(appliedBounds);
  const hasInitializedBoundsRef = useRef(Boolean(appliedBounds));

  const initialViewState = useMemo(
    () => getInitialViewState(listings, appliedBounds),
    [listings, appliedBounds]
  );
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [activeStyleUrl, setActiveStyleUrl] = useState(mapStyleUrl);
  const [didFallbackStyle, setDidFallbackStyle] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapRenderKey, setMapRenderKey] = useState(0);
  const [hasPendingAreaChange, setHasPendingAreaChange] = useState(false);
  const [pendingBounds, setPendingBounds] = useState<MapSearchBounds | null>(null);

  const selectedListing = useMemo(() => {
    if (!selectedListingId) {
      return null;
    }

    return listings.find((listing) => listing.id === selectedListingId) ?? null;
  }, [listings, selectedListingId]);

  const listingsGeoJson = useMemo<FeatureCollection<Point, ListingPointProperties>>(() => {
    return {
      type: "FeatureCollection",
      features: listings.map((listing) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [listing.longitude, listing.latitude],
        },
        properties: {
          listingId: listing.id,
          priceLabel: formatMarkerPrice(listing),
          approximate: listing.public_location_mode === "approximate" ? 1 : 0,
        },
      })),
    };
  }, [listings]);

  useEffect(() => {
    baselineBoundsRef.current = appliedBounds;
    hasInitializedBoundsRef.current = Boolean(appliedBounds);
    setHasPendingAreaChange(false);
    setPendingBounds(null);
  }, [appliedBounds]);

  useEffect(() => {
    setActiveStyleUrl(mapStyleUrl);
    setDidFallbackStyle(false);
    setIsMapReady(false);
    setMapError(null);
    setMapRenderKey((value) => value + 1);
  }, [mapStyleUrl]);

  useEffect(() => {
    if (selectedListingId && !listings.some((listing) => listing.id === selectedListingId)) {
      setSelectedListingId(null);
    }
  }, [listings, selectedListingId]);

  useEffect(() => {
    if (!isMapReady || !mapRef.current) {
      return;
    }

    if (appliedBounds) {
      mapRef.current.fitBounds(
        [
          [appliedBounds.west, appliedBounds.south],
          [appliedBounds.east, appliedBounds.north],
        ],
        {
          duration: 0,
          padding: {
            top: 64,
            right: 56,
            bottom: 64,
            left: 56,
          },
        }
      );
      return;
    }

    if (listings.length === 0) {
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

    const longitudes = listings.map((listing) => listing.longitude);
    const latitudes = listings.map((listing) => listing.latitude);
    const minLongitude = Math.min(...longitudes);
    const maxLongitude = Math.max(...longitudes);
    const minLatitude = Math.min(...latitudes);
    const maxLatitude = Math.max(...latitudes);

    mapRef.current.fitBounds(
      [
        [minLongitude, minLatitude],
        [maxLongitude, maxLatitude],
      ],
      {
        duration: 0,
        maxZoom: 12.5,
        padding: {
          top: 64,
          right: 56,
          bottom: 64,
          left: 56,
        },
      }
    );
  }, [isMapReady, listings, mapRenderKey, appliedBounds]);

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

  function updatePendingAreaState() {
    const currentBounds = readBoundsFromMap(mapRef.current);

    if (!currentBounds) {
      return;
    }

    if (!hasInitializedBoundsRef.current && !baselineBoundsRef.current) {
      baselineBoundsRef.current = currentBounds;
      hasInitializedBoundsRef.current = true;
      setHasPendingAreaChange(false);
      setPendingBounds(null);
      return;
    }

    if (!hasInitializedBoundsRef.current) {
      hasInitializedBoundsRef.current = true;
    }

    const baselineBounds = baselineBoundsRef.current ?? currentBounds;
    const hasChanged = areBoundsMeaningfullyDifferent(currentBounds, baselineBounds);

    setHasPendingAreaChange(hasChanged);
    setPendingBounds(hasChanged ? currentBounds : null);
  }

  function handleSearchThisArea() {
    const boundsToApply = pendingBounds ?? readBoundsFromMap(mapRef.current);

    if (!boundsToApply) {
      return;
    }

    const serializedBounds = serializeMapSearchBounds(boundsToApply);

    if (!serializedBounds) {
      return;
    }

    baselineBoundsRef.current = boundsToApply;
    setHasPendingAreaChange(false);
    setPendingBounds(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set(MAP_BOUNDS_PARAM, serializedBounds);
    params.delete("page");

    const queryString = params.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;

    startAreaSearchTransition(() => {
      router.push(target, { scroll: false });
    });
  }

  function handleClearArea() {
    baselineBoundsRef.current = readBoundsFromMap(mapRef.current);
    setHasPendingAreaChange(false);
    setPendingBounds(null);

    const params = new URLSearchParams(searchParams.toString());
    params.delete(MAP_BOUNDS_PARAM);
    params.delete("page");

    const queryString = params.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;

    startAreaSearchTransition(() => {
      router.push(target, { scroll: false });
    });
  }

  function handleMapClick(event: MapLayerMouseEvent) {
    const clickedFeature = event.features?.[0];

    if (!clickedFeature) {
      return;
    }

    if (
      clickedFeature.layer.id === CLUSTER_LAYER_ID ||
      clickedFeature.layer.id === CLUSTER_COUNT_LAYER_ID
    ) {
      const clusterIdRaw = clickedFeature.properties?.cluster_id;
      const clusterId = Number(clusterIdRaw);

      if (!Number.isFinite(clusterId)) {
        return;
      }

      const source = mapRef.current?.getMap().getSource(LISTINGS_SOURCE_ID) as
        | GeoJSONSource
        | undefined;

      if (!source) {
        return;
      }

      source
        .getClusterExpansionZoom(clusterId)
        .then((zoom) => {
          if (!Number.isFinite(zoom) || !mapRef.current) {
            return;
          }

          mapRef.current.easeTo({
            center: [event.lngLat.lng, event.lngLat.lat],
            zoom: Math.min(zoom + 0.35, 16),
            duration: 320,
          });
        })
        .catch(() => {
          return;
        });

      return;
    }

    if (clickedFeature.layer.id === POINT_LAYER_ID || clickedFeature.layer.id === POINT_LABEL_LAYER_ID) {
      const listingIdRaw = clickedFeature.properties?.listingId;
      const listingId =
        typeof listingIdRaw === "string"
          ? listingIdRaw
          : typeof listingIdRaw === "number"
            ? String(listingIdRaw)
            : "";

      if (listingId) {
        setSelectedListingId(listingId);
      }
    }
  }

  return (
    <div className="border-border/75 bg-card/55 relative h-[68dvh] min-h-[26rem] overflow-hidden rounded-2xl border">
      <MapLibre
        key={`public-map-${mapRenderKey}`}
        ref={mapRef}
        mapLib={import("maplibre-gl")}
        mapStyle={activeStyleUrl}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        interactiveLayerIds={[
          CLUSTER_LAYER_ID,
          CLUSTER_COUNT_LAYER_ID,
          POINT_LAYER_ID,
          POINT_LABEL_LAYER_ID,
        ]}
        onLoad={() => {
          setIsMapReady(true);
          setMapError(null);
        }}
        onStyleData={() => {
          if (mapRef.current?.isStyleLoaded()) {
            setIsMapReady(true);
            setMapError(null);
          }
        }}
        onIdle={() => {
          setIsMapReady(true);
          setMapError(null);

          if (!hasInitializedBoundsRef.current && !baselineBoundsRef.current) {
            const settledBounds = readBoundsFromMap(mapRef.current);

            if (settledBounds) {
              baselineBoundsRef.current = settledBounds;
              hasInitializedBoundsRef.current = true;
              setHasPendingAreaChange(false);
              setPendingBounds(null);
            }
          }
        }}
        onMoveEnd={() => {
          updatePendingAreaState();
        }}
        onClick={handleMapClick}
        onError={(event) => {
          const eventErrorMessage =
            event?.error && typeof event.error === "object" && "message" in event.error
              ? String(event.error.message)
              : "The map surface failed to load.";

          console.error("[Map] runtime error", event?.error ?? event);

          if (!didFallbackStyle && activeStyleUrl !== DEFAULT_PUBLIC_MAP_STYLE_URL) {
            setDidFallbackStyle(true);
            setActiveStyleUrl(DEFAULT_PUBLIC_MAP_STYLE_URL);
            setMapError(null);
            setIsMapReady(false);
            setMapRenderKey((value) => value + 1);
            return;
          }

          setMapError(eventErrorMessage);
          setIsMapReady(false);
        }}
      >
        <NavigationControl visualizePitch={false} position="top-right" />
        <ScaleControl position="bottom-left" unit="metric" />

        <Source
          id={LISTINGS_SOURCE_ID}
          type="geojson"
          data={listingsGeoJson}
          cluster
          clusterRadius={52}
          clusterMaxZoom={14}
        >
          <Layer {...clusterCircleLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
          <Layer {...unclusteredLabelLayer} />
        </Source>

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

      {isMapReady && !mapError ? (
        <div className="absolute top-3 left-1/2 z-20 -translate-x-1/2">
          {hasPendingAreaChange ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm" }), "h-8 gap-1.5 px-3.5 text-xs shadow-lg")}
              onClick={handleSearchThisArea}
              disabled={isAreaSearchPending}
            >
              {isAreaSearchPending ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Search this area
            </button>
          ) : appliedBounds ? (
            <button
              type="button"
              className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8 px-3 text-xs shadow-lg")}
              onClick={handleClearArea}
              disabled={isAreaSearchPending}
            >
              {isAreaSearchPending ? (
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Search all visible areas
            </button>
          ) : (
            <div className="border-border/70 bg-card/88 text-muted-foreground rounded-full border px-3 py-1.5 text-[11px] shadow-lg">
              Move map and use Search this area
            </div>
          )}
        </div>
      ) : null}

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
              Check style access and retry map initialization.
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
