import type { Database } from "@/types/database";

export const EXPLORE_PAGE_SIZE = 12;

const EXPLORE_SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;
const LISTING_TYPE_VALUES = ["rent", "sale"] as const;
const PROPERTY_TYPE_VALUES = ["apartment", "house", "studio", "land", "commercial"] as const;

export type ExploreSortOption = (typeof EXPLORE_SORT_VALUES)[number];
export type ExploreListingType = Database["public"]["Enums"]["listing_type"];
export type ExplorePropertyType = Database["public"]["Enums"]["property_type"];

export type ExploreSearchState = {
  page: number;
  sort: ExploreSortOption;
  listingType: ExploreListingType | null;
  propertyType: ExplorePropertyType | null;
  city: string | null;
};

export const EXPLORE_DEFAULT_STATE: ExploreSearchState = {
  page: 1,
  sort: "newest",
  listingType: null,
  propertyType: null,
  city: null,
};

export const EXPLORE_SORT_LABELS: Record<ExploreSortOption, string> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export const EXPLORE_LISTING_TYPE_LABELS: Record<ExploreListingType, string> = {
  rent: "Rent",
  sale: "Sale",
};

export const EXPLORE_PROPERTY_TYPE_LABELS: Record<ExplorePropertyType, string> = {
  apartment: "Apartment",
  house: "House",
  studio: "Studio",
  land: "Land",
  commercial: "Commercial",
};

function readFirstParamValue(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const rawValue = params[key];

  if (typeof rawValue === "string") {
    return rawValue;
  }

  if (Array.isArray(rawValue)) {
    return rawValue.find((entry) => typeof entry === "string") ?? null;
  }

  return null;
}

function normalizeStringValue(value: string | null, maxLength = 80) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizePositiveInteger(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function normalizeSort(value: string | null): ExploreSortOption {
  if (!value) {
    return EXPLORE_DEFAULT_STATE.sort;
  }

  return EXPLORE_SORT_VALUES.includes(value as ExploreSortOption)
    ? (value as ExploreSortOption)
    : EXPLORE_DEFAULT_STATE.sort;
}

function normalizeListingType(value: string | null): ExploreListingType | null {
  if (!value) {
    return null;
  }

  return LISTING_TYPE_VALUES.includes(value as ExploreListingType)
    ? (value as ExploreListingType)
    : null;
}

function normalizePropertyType(value: string | null): ExplorePropertyType | null {
  if (!value) {
    return null;
  }

  return PROPERTY_TYPE_VALUES.includes(value as ExplorePropertyType)
    ? (value as ExplorePropertyType)
    : null;
}

export function parseExploreSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): ExploreSearchState {
  const listingTypeValue =
    readFirstParamValue(searchParams, "listingType") ?? readFirstParamValue(searchParams, "intent");
  const cityValue =
    readFirstParamValue(searchParams, "city") ?? readFirstParamValue(searchParams, "location");

  return {
    page: normalizePositiveInteger(readFirstParamValue(searchParams, "page"), EXPLORE_DEFAULT_STATE.page),
    sort: normalizeSort(readFirstParamValue(searchParams, "sort")),
    listingType: normalizeListingType(listingTypeValue),
    propertyType: normalizePropertyType(readFirstParamValue(searchParams, "propertyType")),
    city: normalizeStringValue(cityValue),
  };
}

export function toExploreSearchParams(state: ExploreSearchState) {
  const params = new URLSearchParams();

  if (state.sort !== EXPLORE_DEFAULT_STATE.sort) {
    params.set("sort", state.sort);
  }

  if (state.page > 1) {
    params.set("page", String(state.page));
  }

  if (state.listingType) {
    params.set("listingType", state.listingType);
  }

  if (state.propertyType) {
    params.set("propertyType", state.propertyType);
  }

  if (state.city) {
    params.set("city", state.city);
  }

  return params;
}

export function buildExploreHref(state: ExploreSearchState) {
  const params = toExploreSearchParams(state);
  const queryString = params.toString();

  return queryString ? `/explore?${queryString}` : "/explore";
}

