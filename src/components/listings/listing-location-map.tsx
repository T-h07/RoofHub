"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MapPin, RefreshCw } from "lucide-react";
import MapLibre, {
  Layer,
  NavigationControl,
  ScaleControl,
  Source,
  type LayerProps,
} from "react-map-gl/maplibre";

import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_PUBLIC_MAP_STYLE_URL } from "@/lib/config/map";
import { useThemedMapStyleUrl } from "@/lib/map/use-themed-map-style";
import type { Enums } from "@/types/database";
import { cn } from "@/lib/utils";

type ListingLocationMapProps = {
  mapStyleUrl: string;
  latitude: number;
  longitude: number;
  publicLocationMode: Enums<"public_location_mode">;
  mapHref: string;
};

const DETAIL_POINT_SOURCE = "listing-detail-point";

const pointLayer: LayerProps = {
  id: "listing-detail-point-layer",
  type: "circle",
  source: DETAIL_POINT_SOURCE,
  paint: {
    "circle-color": "#67adff",
    "circle-radius": 11,
    "circle-stroke-color": "rgba(6, 16, 35, 0.92)",
    "circle-stroke-width": 1.9,
    "circle-opacity": 0.94,
  },
};

export function ListingLocationMap({
  mapStyleUrl,
  latitude,
  longitude,
  publicLocationMode,
  mapHref,
}: ListingLocationMapProps) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const themedMapStyleUrl = useThemedMapStyleUrl(mapStyleUrl);
  const [activeStyleUrl, setActiveStyleUrl] = useState(themedMapStyleUrl);
  const [didFallbackStyle, setDidFallbackStyle] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);

  const pointData = useMemo(() => {
    return {
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [longitude, latitude],
          },
          properties: {},
        },
      ],
    };
  }, [latitude, longitude]);

  const mapZoom = publicLocationMode === "exact" ? 13.3 : 11.8;

  useEffect(() => {
    setActiveStyleUrl(themedMapStyleUrl);
    setDidFallbackStyle(false);
    setIsMapReady(false);
    setMapError(null);
  }, [themedMapStyleUrl]);

  if (publicLocationMode === "hidden") {
    return (
      <div className="border-border/70 bg-card/60 space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold tracking-tight">Location shared after contact</p>
        <p className="text-muted-foreground text-sm leading-6">
          This listing keeps map coordinates private. Open the map workspace for nearby inventory
          and contact the provider for more precise details.
        </p>
        <Link href={mapHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
          Open nearby map
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  return (
    <div className="border-border/75 bg-card/55 relative h-72 overflow-hidden rounded-xl border sm:h-80">
      <MapLibre
        key={`listing-location-map-${mapRenderKey}`}
        mapLib={import("maplibre-gl")}
        mapStyle={activeStyleUrl}
        initialViewState={{
          longitude,
          latitude,
          zoom: mapZoom,
        }}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        touchPitch={false}
        scrollZoom={false}
        dragPan={false}
        doubleClickZoom={false}
        touchZoomRotate={false}
        keyboard={false}
        attributionControl={false}
        onLoad={() => {
          setIsMapReady(true);
          setMapError(null);
        }}
        onStyleData={() => {
          setIsMapReady(true);
          setMapError(null);
        }}
        onError={(event) => {
          const eventErrorMessage =
            event?.error && typeof event.error === "object" && "message" in event.error
              ? String(event.error.message)
              : "Map preview failed to load.";

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

        <Source id={DETAIL_POINT_SOURCE} type="geojson" data={pointData}>
          <Layer {...pointLayer} />
        </Source>
      </MapLibre>

      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-nav-foreground/30 bg-nav-background/72 px-2.5 py-1 text-[11px] font-medium text-nav-foreground">
        <MapPin className="size-3.5" aria-hidden="true" />
        {publicLocationMode === "approximate" ? "Approximate location" : "Location preview"}
      </div>

      <div className="absolute right-3 bottom-3 z-10">
        <Link
          href={mapHref}
          className={cn(
            buttonVariants({ size: "sm", variant: "outline" }),
            "h-8 gap-1.5 border-nav-foreground/30 bg-nav-background/72 text-nav-foreground hover:bg-nav-background/88"
          )}
        >
          Open full map
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </Link>
      </div>

      {!isMapReady && !mapError ? (
        <div className="bg-background/56 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
          <div className="border-border/70 bg-card/94 rounded-md border px-3 py-2 text-xs">
            Loading map preview...
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div className="bg-background/70 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
          <div className="border-border/75 bg-card/94 space-y-2 rounded-lg border px-4 py-3 text-center">
            <p className="text-sm font-semibold tracking-tight">Map preview unavailable</p>
            <p className="text-muted-foreground text-xs">
              Retry map preview or continue in the full map workspace.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8")}
                onClick={() => {
                  setMapRenderKey((value) => value + 1);
                  setMapError(null);
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Retry
              </button>
              <Link href={mapHref} className={buttonVariants({ size: "sm" })}>
                Open map
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
