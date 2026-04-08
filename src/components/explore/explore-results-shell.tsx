"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, SlidersHorizontal, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  EXPLORE_BATHS_MIN_OPTIONS,
  EXPLORE_BEDS_MIN_OPTIONS,
  EXPLORE_LISTING_TYPE_LABELS,
  EXPLORE_PROPERTY_TYPE_LABELS,
  EXPLORE_SORT_LABELS,
  hasActiveExploreFilters,
  type ExploreSearchState,
  type ExploreSortOption,
} from "@/lib/listings/explore-search-params";

type ExploreResultsShellProps = {
  state: ExploreSearchState;
  totalCount: number;
  cityOptions: string[];
  children: ReactNode;
};

type ExploreFilterDraft = {
  keyword: string;
  city: string;
  neighborhood: string;
  listingType: string;
  propertyType: string;
  priceMin: string;
  priceMax: string;
  areaMin: string;
  areaMax: string;
  bedsMin: string;
  bathsMin: string;
  furnished: boolean;
  parking: boolean;
  pets: boolean;
  availableNow: boolean;
};

type ActiveFilterChip = {
  key: string;
  label: string;
  updates: Record<string, string | null>;
};

function toDraftValue(value: number | null) {
  if (value === null) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toString();
}

function createDraftFromState(state: ExploreSearchState): ExploreFilterDraft {
  return {
    keyword: state.keyword ?? "",
    city: state.city ?? "",
    neighborhood: state.neighborhood ?? "",
    listingType: state.listingType ?? "",
    propertyType: state.propertyType ?? "",
    priceMin: toDraftValue(state.priceMin),
    priceMax: toDraftValue(state.priceMax),
    areaMin: toDraftValue(state.areaMin),
    areaMax: toDraftValue(state.areaMax),
    bedsMin: toDraftValue(state.bedsMin),
    bathsMin: toDraftValue(state.bathsMin),
    furnished: state.furnished,
    parking: state.parking,
    pets: state.pets,
    availableNow: state.availableNow,
  };
}

function formatDecimalValue(value: number | null) {
  if (value === null) {
    return "";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(1);
}

function formatCurrencyValue(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(value);
}

function formatAreaValue(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(value);
}

function getActiveFilterChips(state: ExploreSearchState): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (state.keyword) {
    chips.push({
      key: "q",
      label: `Search: ${state.keyword}`,
      updates: { q: null },
    });
  }

  if (state.city) {
    chips.push({
      key: "city",
      label: `City: ${state.city}`,
      updates: { city: null },
    });
  }

  if (state.neighborhood) {
    chips.push({
      key: "neighborhood",
      label: `Neighborhood: ${state.neighborhood}`,
      updates: { neighborhood: null },
    });
  }

  if (state.listingType) {
    chips.push({
      key: "listingType",
      label: `Type: ${EXPLORE_LISTING_TYPE_LABELS[state.listingType]}`,
      updates: { listingType: null },
    });
  }

  if (state.propertyType) {
    chips.push({
      key: "propertyType",
      label: `Property: ${EXPLORE_PROPERTY_TYPE_LABELS[state.propertyType]}`,
      updates: { propertyType: null },
    });
  }

  if (state.priceMin !== null || state.priceMax !== null) {
    const rangeLabel =
      state.priceMin !== null && state.priceMax !== null
        ? `${formatCurrencyValue(state.priceMin)} - ${formatCurrencyValue(state.priceMax)}`
        : state.priceMin !== null
          ? `from ${formatCurrencyValue(state.priceMin)}`
          : `up to ${formatCurrencyValue(state.priceMax!)}`;
    chips.push({
      key: "price",
      label: `Price: ${rangeLabel}`,
      updates: { priceMin: null, priceMax: null },
    });
  }

  if (state.areaMin !== null || state.areaMax !== null) {
    const rangeLabel =
      state.areaMin !== null && state.areaMax !== null
        ? `${formatAreaValue(state.areaMin)} - ${formatAreaValue(state.areaMax)} m²`
        : state.areaMin !== null
          ? `from ${formatAreaValue(state.areaMin)} m²`
          : `up to ${formatAreaValue(state.areaMax!)} m²`;
    chips.push({
      key: "area",
      label: `Area: ${rangeLabel}`,
      updates: { areaMin: null, areaMax: null },
    });
  }

  if (state.bedsMin !== null) {
    chips.push({
      key: "bedsMin",
      label: `${state.bedsMin}+ beds`,
      updates: { bedsMin: null },
    });
  }

  if (state.bathsMin !== null) {
    chips.push({
      key: "bathsMin",
      label: `${formatDecimalValue(state.bathsMin)}+ baths`,
      updates: { bathsMin: null },
    });
  }

  if (state.furnished) {
    chips.push({
      key: "furnished",
      label: "Furnished",
      updates: { furnished: null },
    });
  }

  if (state.parking) {
    chips.push({
      key: "parking",
      label: "Parking",
      updates: { parking: null },
    });
  }

  if (state.pets) {
    chips.push({
      key: "pets",
      label: "Pets allowed",
      updates: { pets: null },
    });
  }

  if (state.availableNow) {
    chips.push({
      key: "availableNow",
      label: "Available now",
      updates: { availableNow: null },
    });
  }

  return chips;
}

function areDraftsEqual(left: ExploreFilterDraft, right: ExploreFilterDraft) {
  return (
    left.keyword === right.keyword &&
    left.city === right.city &&
    left.neighborhood === right.neighborhood &&
    left.listingType === right.listingType &&
    left.propertyType === right.propertyType &&
    left.priceMin === right.priceMin &&
    left.priceMax === right.priceMax &&
    left.areaMin === right.areaMin &&
    left.areaMax === right.areaMax &&
    left.bedsMin === right.bedsMin &&
    left.bathsMin === right.bathsMin &&
    left.furnished === right.furnished &&
    left.parking === right.parking &&
    left.pets === right.pets &&
    left.availableNow === right.availableNow
  );
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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const canonicalDraft = useMemo(() => createDraftFromState(state), [state]);
  const [draft, setDraft] = useState<ExploreFilterDraft>(canonicalDraft);

  useEffect(() => {
    setDraft(canonicalDraft);
  }, [canonicalDraft]);

  const hasActiveFilters = hasActiveExploreFilters(state);
  const hasPendingChanges = !areDraftsEqual(draft, canonicalDraft);
  const activeFilterChips = getActiveFilterChips(state);

  function pushUpdatedParams(
    updates: Record<string, string | null>,
    options: { resetPage?: boolean } = {}
  ) {
    const params = new URLSearchParams(searchParams.toString());

    if (options.resetPage ?? true) {
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

    if ("q" in updates) {
      params.delete("query");
      params.delete("keyword");
    }

    const queryString = params.toString();
    const target = queryString ? `${pathname}?${queryString}` : pathname;

    router.push(target, { scroll: false });
  }

  function applyDraftFilters(options: { closeMobile?: boolean } = {}) {
    const trimmedKeyword = draft.keyword.trim();
    const trimmedCity = draft.city.trim();
    const trimmedNeighborhood = draft.neighborhood.trim();
    const trimmedPriceMin = draft.priceMin.trim();
    const trimmedPriceMax = draft.priceMax.trim();
    const trimmedAreaMin = draft.areaMin.trim();
    const trimmedAreaMax = draft.areaMax.trim();
    const trimmedBedsMin = draft.bedsMin.trim();
    const trimmedBathsMin = draft.bathsMin.trim();

    pushUpdatedParams(
      {
        q: trimmedKeyword || null,
        city: trimmedCity || null,
        neighborhood: trimmedNeighborhood || null,
        listingType: draft.listingType || null,
        propertyType: draft.propertyType || null,
        priceMin: trimmedPriceMin || null,
        priceMax: trimmedPriceMax || null,
        areaMin: trimmedAreaMin || null,
        areaMax: trimmedAreaMax || null,
        bedsMin: trimmedBedsMin || null,
        bathsMin: trimmedBathsMin || null,
        furnished: draft.furnished ? "1" : null,
        parking: draft.parking ? "1" : null,
        pets: draft.pets ? "1" : null,
        availableNow: draft.availableNow ? "1" : null,
      },
      { resetPage: true }
    );

    if (options.closeMobile) {
      setMobileFiltersOpen(false);
    }
  }

  function clearAllFilters(options: { closeMobile?: boolean } = {}) {
    setDraft({
      ...draft,
      keyword: "",
      city: "",
      neighborhood: "",
      listingType: "",
      propertyType: "",
      priceMin: "",
      priceMax: "",
      areaMin: "",
      areaMax: "",
      bedsMin: "",
      bathsMin: "",
      furnished: false,
      parking: false,
      pets: false,
      availableNow: false,
    });

    pushUpdatedParams(
      {
        q: null,
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
        furnished: null,
        parking: null,
        pets: null,
        availableNow: null,
      },
      { resetPage: true }
    );

    if (options.closeMobile) {
      setMobileFiltersOpen(false);
    }
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

  function renderListingTypeSegment() {
    const options: Array<{
      value: string;
      label: string;
    }> = [
      { value: "", label: "All" },
      ...Object.entries(EXPLORE_LISTING_TYPE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    ];

    return (
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => {
          const isActive = draft.listingType === option.value;

          return (
            <button
              key={option.value || "all"}
              type="button"
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: isActive ? "default" : "outline",
                }),
                "h-8"
              )}
              onClick={() =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  listingType: option.value,
                }))
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderAmenityToggle({
    label,
    value,
    onToggle,
  }: {
    label: string;
    value: boolean;
    onToggle: () => void;
  }) {
    return (
      <button
        type="button"
        className={cn(
          buttonVariants({
            size: "sm",
            variant: value ? "default" : "outline",
          }),
          "h-8 justify-start px-3"
        )}
        onClick={onToggle}
      >
        {label}
      </button>
    );
  }

  function renderFilterFields() {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="filter-keyword" className="type-label">
            Keyword
          </label>
          <Input
            id="filter-keyword"
            value={draft.keyword}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                keyword: event.currentTarget.value,
              }))
            }
            placeholder="Title, description, city..."
            autoComplete="off"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="filter-city" className="type-label">
              City
            </label>
            <Input
              id="filter-city"
              list="explore-city-options"
              value={draft.city}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  city: event.currentTarget.value,
                }))
              }
              placeholder="City"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="filter-neighborhood" className="type-label">
              Neighborhood
            </label>
            <Input
              id="filter-neighborhood"
              value={draft.neighborhood}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  neighborhood: event.currentTarget.value,
                }))
              }
              placeholder="Neighborhood"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="type-label">Listing type</p>
          {renderListingTypeSegment()}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="filter-property-type" className="type-label">
            Property type
          </label>
          <Select
            id="filter-property-type"
            value={draft.propertyType}
            onChange={(event) =>
              setDraft((currentDraft) => ({
                ...currentDraft,
                propertyType: event.currentTarget.value,
              }))
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

        <div className="space-y-2">
          <p className="type-label">Price range</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="numeric"
              type="number"
              min="0"
              step="1"
              value={draft.priceMin}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  priceMin: event.currentTarget.value,
                }))
              }
              placeholder="Min"
            />
            <Input
              inputMode="numeric"
              type="number"
              min="0"
              step="1"
              value={draft.priceMax}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  priceMax: event.currentTarget.value,
                }))
              }
              placeholder="Max"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="type-label">Area range (m²)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.1"
              value={draft.areaMin}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  areaMin: event.currentTarget.value,
                }))
              }
              placeholder="Min"
            />
            <Input
              inputMode="decimal"
              type="number"
              min="0"
              step="0.1"
              value={draft.areaMax}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  areaMax: event.currentTarget.value,
                }))
              }
              placeholder="Max"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="filter-beds-min" className="type-label">
              Bedrooms (min)
            </label>
            <Select
              id="filter-beds-min"
              value={draft.bedsMin}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  bedsMin: event.currentTarget.value,
                }))
              }
            >
              <option value="">Any</option>
              {EXPLORE_BEDS_MIN_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}+
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="filter-baths-min" className="type-label">
              Bathrooms (min)
            </label>
            <Select
              id="filter-baths-min"
              value={draft.bathsMin}
              onChange={(event) =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  bathsMin: event.currentTarget.value,
                }))
              }
            >
              <option value="">Any</option>
              {EXPLORE_BATHS_MIN_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value}+
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <p className="type-label">Amenities and availability</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {renderAmenityToggle({
              label: "Furnished",
              value: draft.furnished,
              onToggle: () =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  furnished: !currentDraft.furnished,
                })),
            })}
            {renderAmenityToggle({
              label: "Parking",
              value: draft.parking,
              onToggle: () =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  parking: !currentDraft.parking,
                })),
            })}
            {renderAmenityToggle({
              label: "Pets allowed",
              value: draft.pets,
              onToggle: () =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  pets: !currentDraft.pets,
                })),
            })}
            {renderAmenityToggle({
              label: "Available now",
              value: draft.availableNow,
              onToggle: () =>
                setDraft((currentDraft) => ({
                  ...currentDraft,
                  availableNow: !currentDraft.availableNow,
                })),
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <section className="border-border/75 bg-card/65 sticky top-[5.5rem] space-y-4 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Search filters</h2>
            {hasActiveFilters ? <Badge variant="primary">{activeFilterChips.length} active</Badge> : null}
          </div>

          {renderFilterFields()}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              className="flex-1"
              disabled={!hasPendingChanges}
              onClick={() => applyDraftFilters()}
            >
              <Search className="size-4" aria-hidden="true" />
              Apply
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={!hasActiveFilters && !hasPendingChanges}
              onClick={() => clearAllFilters()}
            >
              Clear all
            </Button>
          </div>
        </section>
      </aside>

      <section className="space-y-4">
        <datalist id="explore-city-options">
          {cityOptions.map((cityOption) => (
            <option key={cityOption} value={cityOption} />
          ))}
        </datalist>

        <div className="border-border/75 bg-card/60 space-y-3 rounded-xl border px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <form
              className="flex w-full max-w-xl items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                applyDraftFilters();
              }}
            >
              <Input
                value={draft.keyword}
                onChange={(event) =>
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    keyword: event.currentTarget.value,
                  }))
                }
                placeholder="Search listings by title, description, city, or property type"
                autoComplete="off"
              />
              <Button type="submit" size="sm" disabled={!hasPendingChanges}>
                Search
              </Button>
            </form>

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

              <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
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
                      Search filters
                    </SheetTitle>
                    <SheetDescription>
                      Filters are URL-synced and shared with the explore list view for stable map/list coordination.
                    </SheetDescription>
                  </SheetHeader>

                  <div className="mt-6 space-y-4">
                    {renderFilterFields()}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        disabled={!hasPendingChanges}
                        onClick={() => applyDraftFilters({ closeMobile: true })}
                      >
                        Apply
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        disabled={!hasActiveFilters && !hasPendingChanges}
                        onClick={() => clearAllFilters({ closeMobile: true })}
                      >
                        Clear all
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold tracking-tight">
              {totalCount === 0 ? "No listings found" : `${totalCount} listings available`}
            </p>
            {hasActiveFilters ? (
              <>
                <span className="text-muted-foreground text-xs">with active filters:</span>
                {activeFilterChips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: "outline",
                      }),
                      "h-7 gap-1 rounded-full px-2.5 text-xs"
                    )}
                    onClick={() => pushUpdatedParams(chip.updates, { resetPage: true })}
                  >
                    {chip.label}
                    <X className="size-3" aria-hidden="true" />
                  </button>
                ))}
                <button
                  type="button"
                  className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 rounded-full px-2.5 text-xs")}
                  onClick={() => clearAllFilters()}
                >
                  Reset all
                </button>
              </>
            ) : (
              <p className="type-caption">Public, published listings only. Search and filter state is URL-driven.</p>
            )}
          </div>
        </div>

        {children}
      </section>
    </div>
  );
}

