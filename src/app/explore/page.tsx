import Link from "next/link";
import { AlertTriangle, SearchX } from "lucide-react";

import { ExplorePagination } from "@/components/explore/explore-pagination";
import { ExploreResultsShell } from "@/components/explore/explore-results-shell";
import { MainContainer } from "@/components/layout/main-container";
import { ListingCard } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  buildExploreHref,
  hasActiveExploreFilters,
  parseExploreSearchParams,
  type ExploreSearchState,
} from "@/lib/listings/explore-search-params";
import { loadPublicExploreListings } from "@/lib/listings/public-explore";
import { cn } from "@/lib/utils";

type ExplorePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function clearExploreFilters(state: ExploreSearchState): ExploreSearchState {
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

export default async function ExplorePage({ searchParams }: ExplorePageProps) {
  const resolvedSearchParams = await searchParams;
  const searchState = parseExploreSearchParams(resolvedSearchParams);
  const listingsResult = await loadPublicExploreListings(searchState);

  const hasActiveFilters = hasActiveExploreFilters(searchState);
  const isOutOfRangePage =
    listingsResult.ok &&
    listingsResult.totalCount > 0 &&
    listingsResult.listings.length === 0 &&
    searchState.page > 1;

  const resetFiltersHref = buildExploreHref(clearExploreFilters(searchState));
  const firstPageHref = buildExploreHref({ ...searchState, page: 1 });

  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Explore listings</Badge>
        <h1 className="type-page-title max-w-4xl">Browse RoofHub rentals and homes for sale.</h1>
        <p className="type-body-muted max-w-3xl">
          Use keyword search, location filters, and smart sorting to scan company public inventory
          quickly, then switch to map view without losing your search state.
        </p>
      </section>

      <ExploreResultsShell
        state={searchState}
        totalCount={listingsResult.totalCount}
        cityOptions={listingsResult.cityOptions}
      >
        {!listingsResult.ok ? (
          <EmptyState
            icon={AlertTriangle}
            title="Listings couldn’t load right now"
            description={listingsResult.message}
            action={
              <Link
                href={buildExploreHref(searchState)}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Retry
              </Link>
            }
          />
        ) : isOutOfRangePage ? (
          <EmptyState
            icon={SearchX}
            title="This page has no listings"
            description="The current result page is out of range for your selected filters. Return to page one to continue browsing."
            action={
              <Link
                href={firstPageHref}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Go to page 1
              </Link>
            }
          />
        ) : listingsResult.listings.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No listings match these filters"
            description={
              hasActiveFilters
                ? "Try resetting one or more filters to widen the result set."
                : "Published listings will appear here as inventory goes live."
            }
            action={
              hasActiveFilters ? (
                <Link
                  href={resetFiltersHref}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Reset filters
                </Link>
              ) : (
                <Link
                  href="/"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
                >
                  Back to home
                </Link>
              )
            }
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {listingsResult.listings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isAuthenticated={Boolean(listingsResult.viewerUserId)}
                />
              ))}
            </div>

            <ExplorePagination state={searchState} totalPages={listingsResult.totalPages} />
          </>
        )}
      </ExploreResultsShell>
    </MainContainer>
  );
}
