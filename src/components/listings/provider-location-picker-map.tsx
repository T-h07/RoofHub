"use client";

import { useEffect, useMemo, useState } from "react";
import { LocateFixed, MapPin, RefreshCw, X } from "lucide-react";
import MapLibre, {
  Marker,
  NavigationControl,
  ScaleControl,
} from "react-map-gl/maplibre";

import { buttonVariants } from "@/components/ui/button";
import { DEFAULT_PUBLIC_MAP_STYLE_URL } from "@/lib/config/map";
import { useThemedMapStyleUrl } from "@/lib/map/use-themed-map-style";
import { cn } from "@/lib/utils";

type ProviderLocationPickerMapProps = {
  mapStyleUrl: string;
  latitude: number | null;
  longitude: number | null;
  onCoordinateChange: (next: { latitude: number; longitude: number }) => void;
  onCoordinateClear: () => void;
  className?: string;
};

const DEFAULT_CENTER = {
  longitude: 13.404954,
  latitude: 52.520008,
};

function toRoundedCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function ProviderLocationPickerMap({
  mapStyleUrl,
  latitude,
  longitude,
  onCoordinateChange,
  onCoordinateClear,
  className,
}: ProviderLocationPickerMapProps) {
  const [isMapReady, setIsMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const themedMapStyleUrl = useThemedMapStyleUrl(mapStyleUrl);
  const [activeStyleUrl, setActiveStyleUrl] = useState(themedMapStyleUrl);
  const [didFallbackStyle, setDidFallbackStyle] = useState(false);
  const [mapRenderKey, setMapRenderKey] = useState(0);

  const initialViewState = useMemo(() => {
    if (latitude !== null && longitude !== null) {
      return {
        latitude,
        longitude,
        zoom: 15,
      };
    }

    return {
      ...DEFAULT_CENTER,
      zoom: 11.1,
    };
  }, [latitude, longitude]);

  useEffect(() => {
    setActiveStyleUrl(themedMapStyleUrl);
    setDidFallbackStyle(false);
    setIsMapReady(false);
    setMapError(null);
  }, [themedMapStyleUrl]);

  return (
    <div
      className={cn(
        "border-border/75 bg-card/55 relative h-[23rem] overflow-hidden rounded-2xl border sm:h-[27rem]",
        className
      )}
    >
      <MapLibre
        key={`provider-location-map-${mapRenderKey}`}
        mapLib={import("maplibre-gl")}
        mapStyle={activeStyleUrl}
        initialViewState={initialViewState}
        style={{ width: "100%", height: "100%" }}
        dragRotate={false}
        touchPitch={false}
        attributionControl={false}
        onClick={(event) => {
          onCoordinateChange({
            latitude: toRoundedCoordinate(event.lngLat.lat),
            longitude: toRoundedCoordinate(event.lngLat.lng),
          });
        }}
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
              : "Location map failed to load.";

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

        {latitude !== null && longitude !== null ? (
          <Marker
            draggable
            latitude={latitude}
            longitude={longitude}
            onDragEnd={(event) => {
              onCoordinateChange({
                latitude: toRoundedCoordinate(event.lngLat.lat),
                longitude: toRoundedCoordinate(event.lngLat.lng),
              });
            }}
          >
            <div className="grid place-items-center">
              <span className="border-background/80 bg-primary text-primary-foreground grid h-9 w-9 place-items-center rounded-full border-2 shadow-lg">
                <MapPin className="size-4" aria-hidden="true" />
              </span>
            </div>
          </Marker>
        ) : null}
      </MapLibre>

      <div className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/42 px-3 py-1.5 text-[11px] font-medium text-white">
        <LocateFixed className="size-3.5" aria-hidden="true" />
        {latitude !== null && longitude !== null ? "Drag pin to refine location" : "Tap map to place pin"}
      </div>

      {latitude !== null && longitude !== null ? (
        <div className="absolute right-3 bottom-3 z-10">
          <button
            type="button"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 border-white/20 bg-black/42 px-2.5 text-[11px] text-white hover:bg-black/60"
            )}
            onClick={onCoordinateClear}
          >
            <X className="size-3.5" aria-hidden="true" />
            Clear pin
          </button>
        </div>
      ) : null}

      {!isMapReady && !mapError ? (
        <div className="bg-background/58 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
          <div className="border-border/75 bg-card/96 rounded-md border px-3.5 py-2 text-xs">
            Loading location map...
          </div>
        </div>
      ) : null}

      {mapError ? (
        <div className="bg-background/72 absolute inset-0 grid place-items-center backdrop-blur-[1px]">
          <div className="border-border/75 bg-card/96 space-y-2.5 rounded-lg border px-4 py-3 text-center">
            <p className="text-sm font-semibold tracking-tight">Map unavailable</p>
            <p className="text-muted-foreground text-xs">
              Retry map loading. Coordinate fields remain editable below.
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
