import Link from "next/link";
import { AlertTriangle, Compass, SearchX } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { MapResultsPane } from "@/components/map/map-results-pane";
import { PublicListingsMap } from "@/components/map/public-listings-map";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
import {
  MAP_BOUNDS_PARAM,
  parseMapSearchBoundsFromParams,
  serializeMapSearchBounds,
} from "@/lib/listings/map-bounds";
import {
  buildExploreHref,
  buildMapHref,
  hasActiveExploreFilters,
  parseExploreSearchParams,
  type ExploreSearchState,
} from "@/lib/listings/explore-search-params";
import { loadPublicMapListings } from "@/lib/listings/public-map";
import { cn } from "@/lib/utils";

type MapPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function clearMapFilters(state: ExploreSearchState): ExploreSearchState {
  return {
    ...state,
    page: 1,
    keyword: null,
    city: null,
    neighborhood: null,
    listingType: null,
    propertyType: null,
    priceMin: null,
    priceMax: null,
    areaMin: null,
    areaMax: null,
    bedsMin: null,
    bathsMin: null,
    furnished: false,
    parking: false,
    pets: false,
    availableNow: false,
  };
}

function toQueryString(params: Record<string, string | string[] | undefined>) {
  const urlSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      urlSearchParams.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          urlSearchParams.append(key, entry);
        }
      }
    }
  }

  return urlSearchParams.toString();
}

function buildMapHrefWithBounds(state: ExploreSearchState, serializedBounds: string | null) {
  const baseHref = buildMapHref(state);
  const [path, rawQueryString] = baseHref.split("?");

  if (!serializedBounds) {
    return baseHref;
  }

  const params = new URLSearchParams(rawQueryString ?? "");
  params.set(MAP_BOUNDS_PARAM, serializedBounds);

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

export default async function MapPage({ searchParams }: MapPageProps) {
  const resolvedSearchParams = await searchParams;
  const searchState = parseExploreSearchParams(resolvedSearchParams);
  const appliedBounds = parseMapSearchBoundsFromParams(resolvedSearchParams);
  const serializedAppliedBounds = appliedBounds ? serializeMapSearchBounds(appliedBounds) : null;

  const hasActiveFilters = hasActiveExploreFilters(searchState);
  const hasAppliedBounds = Boolean(appliedBounds);

  const mapStyleUrl = getMapStyleUrl();
  const mapResult = await loadPublicMapListings(searchState, {
    bounds: appliedBounds,
  });

  const mapErrorMessage = mapResult.ok ? null : mapResult.message;
  const markerCount = mapResult.ok ? mapResult.markerCount : 0;
  const totalCount = mapResult.ok ? mapResult.totalCount : 0;

  const exploreHref = buildExploreHref({
    ...searchState,
    page: 1,
  });
  const mapQueryString = toQueryString(resolvedSearchParams);
  const mapHref = mapQueryString ? `/map?${mapQueryString}` : "/map";
  const resetFiltersHref = buildMapHrefWithBounds(
    clearMapFilters(searchState),
    serializedAppliedBounds
  );

  const statusTitle = mapErrorMessage
    ? "Map data unavailable"
    : totalCount === 0
      ? hasAppliedBounds
        ? "No listings in the applied area"
        : "No mapped listings available yet"
      : hasAppliedBounds
        ? `${totalCount} ${totalCount === 1 ? "listing" : "listings"} in the applied area`
        : `${totalCount} ${totalCount === 1 ? "listing" : "listings"} matching current filters`;

  const statusDescription = mapErrorMessage
    ? "Map style or listing data could not be loaded."
    : totalCount === 0
      ? hasAppliedBounds
        ? "Move the map and search again, or clear area search to widen coverage."
        : "Map is live. Add and publish listings with public location visibility to see markers."
      : `${markerCount} ${markerCount === 1 ? "marker" : "markers"} currently rendered on map.`;

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/70 bg-card/88 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Map discovery</Badge>
        <h1 className="type-page-title max-w-4xl">
          Search RoofHub listings spatially with map clusters and area-based filtering.
        </h1>
        <p className="type-body-muted max-w-3xl">
          Move the map, apply filters, and run area searches across company public inventory while
          keeping your list and map views in sync.
        </p>
      </section>

      <section className="border-border/70 bg-card/88 space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tracking-tight">{statusTitle}</p>
            <p className="text-muted-foreground text-xs">{statusDescription}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={exploreHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Refine in list
            </Link>
            {hasActiveFilters ? (
              <Link
                href={resetFiltersHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>

        {mapResult.ok && mapResult.isTruncated ? (
          <div className="border-warning/35 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-xs">
            Showing up to {mapResult.markerLimit} listings for smooth map performance. Tighten
            filters or search a smaller area to narrow results further.
          </div>
        ) : null}
      </section>

      {!mapResult.ok ? (
        <EmptyState
          icon={AlertTriangle}
          title="Map couldn’t load right now"
          description={mapResult.message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href={mapHref} className={buttonVariants({ size: "sm" })}>
                Retry
              </Link>
              <Link
                href={exploreHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Open list view
              </Link>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,0.95fr)]">
            <PublicListingsMap
              mapStyleUrl={mapStyleUrl}
              listings={mapResult.listings}
              appliedBounds={appliedBounds}
            />

            <div className="hidden lg:block">
              <MapResultsPane
                listings={mapResult.listings}
                totalCount={mapResult.totalCount}
                hasAppliedBounds={hasAppliedBounds}
                isTruncated={mapResult.isTruncated}
                markerLimit={mapResult.markerLimit}
                exploreHref={exploreHref}
                hasActiveFilters={hasActiveFilters}
              />
            </div>
          </div>

          <div className="lg:hidden">
            {mapResult.markerCount === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No mapped listings for this search"
                description={
                  hasActiveFilters || hasAppliedBounds
                    ? "Adjust filters or move map and search another area to widen results."
                    : "Published listings with public map visibility will appear here as inventory goes live."
                }
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {hasActiveFilters ? (
                      <Link
                        href={resetFiltersHref}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Reset filters
                      </Link>
                    ) : null}
                    <Link href={exploreHref} className={buttonVariants({ size: "sm" })}>
                      Browse list view
                    </Link>
                  </div>
                }
              />
            ) : (
              <p className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs")}>
                <Compass className="size-3.5" aria-hidden="true" />
                Search-this-area applies current viewport bounds before refreshing markers.
              </p>
            )}
          </div>

          {mapResult.markerCount > 0 ? (
            <p
              className={cn(
                "text-muted-foreground hidden items-center gap-1.5 text-xs lg:inline-flex"
              )}
            >
              <Compass className="size-3.5" aria-hidden="true" />
              Clustered markers stay map-first while the side pane keeps scanning fast on desktop.
            </p>
          ) : null}
        </div>
      )}
    </MainContainer>
  );
}
