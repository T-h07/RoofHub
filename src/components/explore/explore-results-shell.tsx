"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  EXPLORE_LISTING_TYPE_LABELS,
  EXPLORE_PROPERTY_TYPE_LABELS,
  EXPLORE_SORT_LABELS,
  type ExploreSearchState,
  type ExploreSortOption,
} from "@/lib/listings/explore-search-params";

type ExploreResultsShellProps = {
  state: ExploreSearchState;
  totalCount: number;
  cityOptions: string[];
  children: ReactNode;
};

function countActiveFilters(state: ExploreSearchState) {
  let count = 0;

  if (state.listingType) {
    count += 1;
  }
  if (state.propertyType) {
    count += 1;
  }
  if (state.city) {
    count += 1;
  }

  return count;
}

function buildCitySelectOptions(cityOptions: string[], selectedCity: string | null) {
  const deduped = new Map<string, string>();

  if (selectedCity) {
    deduped.set(selectedCity.toLocaleLowerCase(), selectedCity);
  }

  for (const cityOption of cityOptions) {
    const trimmedCity = cityOption.trim();
    if (!trimmedCity) {
      continue;
    }

    const dedupeKey = trimmedCity.toLocaleLowerCase();
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, trimmedCity);
    }
  }

  return [...deduped.values()];
}

export function ExploreResultsShell({
  state,
  totalCount,
  cityOptions,
  children,
}: ExploreResultsShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeFilterCount = countActiveFilters(state);
  const citySelectOptions = useMemo(
    () => buildCitySelectOptions(cityOptions, state.city),
    [cityOptions, state.city]
  );

  function pushUpdatedParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = {}
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (options.resetPage) {
      params.delete("page");
    }

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }

    if ("listingType" in updates) {
      params.delete("intent");
    }

    if ("city" in updates) {
      params.delete("location");
    }

    const queryString = params.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;

    router.push(target, { scroll: false });
  }

  function handleSortChange(nextSortValue: string) {
    const nextSort = nextSortValue as ExploreSortOption;

    pushUpdatedParams(
      {
        sort: nextSort === "newest" ? null : nextSort,
      },
      { resetPage: true }
    );
  }

  function renderFilterControls(idPrefix: "desktop" | "mobile") {
    const listingTypeId = `${idPrefix}-listing-type`;
    const propertyTypeId = `${idPrefix}-property-type`;
    const cityId = `${idPrefix}-city`;

    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor={listingTypeId} className="type-label">
            Listing type
          </label>
          <Select
            id={listingTypeId}
            value={state.listingType ?? ""}
            onChange={(event) =>
              pushUpdatedParams(
                {
                  listingType: event.currentTarget.value || null,
                },
                { resetPage: true }
              )
            }
          >
            <option value="">All listing types</option>
            {Object.entries(EXPLORE_LISTING_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={propertyTypeId} className="type-label">
            Property type
          </label>
          <Select
            id={propertyTypeId}
            value={state.propertyType ?? ""}
            onChange={(event) =>
              pushUpdatedParams(
                {
                  propertyType: event.currentTarget.value || null,
                },
                { resetPage: true }
              )
            }
          >
            <option value="">All property types</option>
            {Object.entries(EXPLORE_PROPERTY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={cityId} className="type-label">
            City
          </label>
          <Select
            id={cityId}
            value={state.city ?? ""}
            onChange={(event) =>
              pushUpdatedParams(
                {
                  city: event.currentTarget.value || null,
                },
                { resetPage: true }
              )
            }
          >
            <option value="">All cities</option>
            {citySelectOptions.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <section className="border-border/75 bg-card/65 sticky top-[5.5rem] space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Filters</h2>
            {activeFilterCount > 0 ? <Badge variant="primary">{activeFilterCount} active</Badge> : null}
          </div>
          {renderFilterControls("desktop")}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={activeFilterCount === 0}
            onClick={() =>
              pushUpdatedParams(
                {
                  listingType: null,
                  propertyType: null,
                  city: null,
                },
                { resetPage: true }
              )
            }
          >
            Clear filters
          </Button>
        </section>
      </aside>

      <section className="space-y-4">
        <div className="border-border/75 bg-card/60 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold tracking-tight">
              {totalCount === 0 ? "No listings found" : `${totalCount} listings available`}
            </p>
            <p className="type-caption">
              Public, published listings only. Sort and filter changes update the URL.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="explore-sort" className="sr-only">
              Sort listings
            </label>
            <Select
              id="explore-sort"
              value={state.sort}
              onChange={(event) => handleSortChange(event.currentTarget.value)}
              className="w-[210px]"
            >
              {Object.entries(EXPLORE_SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>

            <Sheet>
              <SheetTrigger
                className={cn(buttonVariants({ variant: "outline", size: "default" }), "lg:hidden")}
              >
                <Filter className="size-4" aria-hidden="true" />
                Filters
              </SheetTrigger>
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 text-base">
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    Explore filters
                  </SheetTitle>
                  <SheetDescription>
                    Keep this panel lean for PT10. PT11 extends it with advanced discovery controls.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  {renderFilterControls("mobile")}
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={activeFilterCount === 0}
                    onClick={() =>
                      pushUpdatedParams(
                        {
                          listingType: null,
                          propertyType: null,
                          city: null,
                        },
                        { resetPage: true }
                      )
                    }
                  >
                    Clear filters
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {children}
      </section>
    </div>
  );
}

