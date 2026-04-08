import Link from "next/link";
import { AlertTriangle, Compass, SearchX } from "lucide-react";

import { PublicListingsMap } from "@/components/map/public-listings-map";
import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
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

export default async function MapPage({ searchParams }: MapPageProps) {
  const resolvedSearchParams = await searchParams;
  const searchState = parseExploreSearchParams(resolvedSearchParams);
  const hasActiveFilters = hasActiveExploreFilters(searchState);

  const exploreHref = buildExploreHref({
    ...searchState,
    page: 1,
  });
  const mapHref = buildMapHref(searchState);
  const resetFiltersHref = buildMapHref(clearMapFilters(searchState));

  let mapStyleUrl: string | null = null;
  let mapStyleMessage: string | null = null;

  try {
    mapStyleUrl = getMapStyleUrl();
  } catch {
    mapStyleMessage =
      "Map is not configured yet. Set NEXT_PUBLIC_MAP_STYLE_URL and restart the app.";
  }

  const mapResult = mapStyleUrl ? await loadPublicMapListings(searchState) : null;
  const mapErrorMessage =
    mapStyleMessage ?? (mapResult && !mapResult.ok ? mapResult.message : null);
  const markerCount = mapResult?.ok ? mapResult.markerCount : 0;
  const totalCount = mapResult?.ok ? mapResult.totalCount : 0;

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Map discovery</Badge>
        <h1 className="type-page-title max-w-4xl">
          Explore published listings spatially with the same URL-driven search model as list view.
        </h1>
        <p className="type-body-muted max-w-3xl">
          This map route consumes PT11 filters and public listing visibility rules, establishing
          the marker and popup foundation for PT13 bounds and clustering work.
        </p>
      </section>

      <section className="border-border/75 bg-card/60 space-y-4 rounded-xl border p-4 sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <p className="text-sm font-semibold tracking-tight">
              {mapErrorMessage
                ? "Map data unavailable"
                : `${markerCount} map ${markerCount === 1 ? "marker" : "markers"} shown`}
            </p>
            <p className="text-muted-foreground text-xs">
              {mapErrorMessage
                ? "Map style or listing data could not be loaded."
                : `Discovery state is URL-synced. ${
                    totalCount === markerCount
                      ? "All matching listings are mapped."
                      : `${totalCount} match your filters.`
                  }`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href={exploreHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Refine in list
            </Link>
            {hasActiveFilters ? (
              <Link href={resetFiltersHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Clear filters
              </Link>
            ) : null}
          </div>
        </div>

        {mapResult?.ok && mapResult.isTruncated ? (
          <div className="border-warning/35 bg-warning/10 text-warning-foreground rounded-lg border px-3 py-2 text-xs">
            Showing the first {mapResult.markerLimit} markers. PT13 will add bounds-driven map
            updates and clustering for larger result sets.
          </div>
        ) : null}
      </section>

      {mapErrorMessage ? (
        <EmptyState
          icon={AlertTriangle}
          title="Map couldn’t load right now"
          description={mapErrorMessage}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href={mapHref} className={buttonVariants({ size: "sm" })}>
                Retry
              </Link>
              <Link href={exploreHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Open list view
              </Link>
            </div>
          }
        />
      ) : mapResult && mapResult.ok && mapResult.markerCount === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No mapped listings for this filter set"
          description={
            hasActiveFilters
              ? "Try clearing one or more filters, then refresh the map results."
              : "Published listings with public map visibility will appear here as inventory goes live."
          }
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters ? (
                <Link href={resetFiltersHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Reset filters
                </Link>
              ) : null}
              <Link href={exploreHref} className={buttonVariants({ size: "sm" })}>
                Browse list view
              </Link>
            </div>
          }
        />
      ) : mapResult && mapResult.ok ? (
        <div className="space-y-3">
          <PublicListingsMap mapStyleUrl={mapStyleUrl!} listings={mapResult.listings} />

          <p className={cn("text-muted-foreground inline-flex items-center gap-1.5 text-xs")}>
            <Compass className="size-3.5" aria-hidden="true" />
            Marker popups stay compact by design. Listing detail pages land in PT14.
          </p>
        </div>
      ) : null}
    </MainContainer>
  );
}
