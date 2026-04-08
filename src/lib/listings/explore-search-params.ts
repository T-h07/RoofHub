import type { Database } from "@/types/database";

export const EXPLORE_PAGE_SIZE = 12;

const EXPLORE_SORT_VALUES = ["newest", "price_asc", "price_desc"] as const;
const LISTING_TYPE_VALUES = ["rent", "sale"] as const;
const PROPERTY_TYPE_VALUES = ["apartment", "house", "studio", "land", "commercial"] as const;
const BOOLEAN_TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

export type ExploreSortOption = (typeof EXPLORE_SORT_VALUES)[number];
export type ExploreListingType = Database["public"]["Enums"]["listing_type"];
export type ExplorePropertyType = Database["public"]["Enums"]["property_type"];

export type ExploreSearchState = {
  page: number;
  sort: ExploreSortOption;
  keyword: string | null;
  city: string | null;
  neighborhood: string | null;
  listingType: ExploreListingType | null;
  propertyType: ExplorePropertyType | null;
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  bedsMin: number | null;
  bathsMin: number | null;
  furnished: boolean;
  parking: boolean;
  pets: boolean;
  availableNow: boolean;
};

export const EXPLORE_DEFAULT_STATE: ExploreSearchState = {
  page: 1,
  sort: "newest",
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

export const EXPLORE_BEDS_MIN_OPTIONS = [1, 2, 3, 4, 5] as const;
export const EXPLORE_BATHS_MIN_OPTIONS = [1, 1.5, 2, 2.5, 3, 4] as const;

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

function normalizeBooleanValue(value: string | null) {
  if (!value) {
    return false;
  }

  return BOOLEAN_TRUE_VALUES.has(value.trim().toLowerCase());
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

function normalizeIntegerFilter(value: string | null, options: { min?: number; max?: number } = {}) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const min = options.min ?? 0;
  const max = options.max ?? Number.POSITIVE_INFINITY;

  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
}

function normalizeFloatFilter(
  value: string | null,
  options: { min?: number; max?: number; precision?: number } = {}
) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  const min = options.min ?? 0;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  const precision = options.precision ?? 2;

  if (parsed < min || parsed > max) {
    return null;
  }

  return Number.parseFloat(parsed.toFixed(precision));
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

function normalizeRange(minValue: number | null, maxValue: number | null) {
  if (minValue !== null && maxValue !== null && minValue > maxValue) {
    return {
      min: maxValue,
      max: minValue,
    };
  }

  return {
    min: minValue,
    max: maxValue,
  };
}

function formatNumberParam(value: number) {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toString();
}

export function parseExploreSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): ExploreSearchState {
  const listingTypeValue =
    readFirstParamValue(searchParams, "listingType") ?? readFirstParamValue(searchParams, "intent");
  const cityValue = readFirstParamValue(searchParams, "city") ?? readFirstParamValue(searchParams, "location");
  const keywordValue =
    readFirstParamValue(searchParams, "q") ??
    readFirstParamValue(searchParams, "query") ??
    readFirstParamValue(searchParams, "keyword");

  const normalizedPrice = normalizeRange(
    normalizeFloatFilter(readFirstParamValue(searchParams, "priceMin"), {
      min: 0,
      max: 10_000_000,
      precision: 0,
    }),
    normalizeFloatFilter(readFirstParamValue(searchParams, "priceMax"), {
      min: 0,
      max: 10_000_000,
      precision: 0,
    })
  );
  const normalizedArea = normalizeRange(
    normalizeFloatFilter(readFirstParamValue(searchParams, "areaMin"), {
      min: 0,
      max: 100_000,
      precision: 2,
    }),
    normalizeFloatFilter(readFirstParamValue(searchParams, "areaMax"), {
      min: 0,
      max: 100_000,
      precision: 2,
    })
  );

  return {
    page: normalizePositiveInteger(readFirstParamValue(searchParams, "page"), EXPLORE_DEFAULT_STATE.page),
    sort: normalizeSort(readFirstParamValue(searchParams, "sort")),
    keyword: normalizeStringValue(keywordValue, 120),
    city: normalizeStringValue(cityValue, 80),
    neighborhood: normalizeStringValue(readFirstParamValue(searchParams, "neighborhood"), 80),
    listingType: normalizeListingType(listingTypeValue),
    propertyType: normalizePropertyType(readFirstParamValue(searchParams, "propertyType")),
    priceMin: normalizedPrice.min,
    priceMax: normalizedPrice.max,
    areaMin: normalizedArea.min,
    areaMax: normalizedArea.max,
    bedsMin: normalizeIntegerFilter(readFirstParamValue(searchParams, "bedsMin"), {
      min: 0,
      max: 20,
    }),
    bathsMin: normalizeFloatFilter(readFirstParamValue(searchParams, "bathsMin"), {
      min: 0,
      max: 20,
      precision: 1,
    }),
    furnished: normalizeBooleanValue(readFirstParamValue(searchParams, "furnished")),
    parking: normalizeBooleanValue(readFirstParamValue(searchParams, "parking")),
    pets: normalizeBooleanValue(readFirstParamValue(searchParams, "pets")),
    availableNow: normalizeBooleanValue(readFirstParamValue(searchParams, "availableNow")),
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

  if (state.keyword) {
    params.set("q", state.keyword);
  }

  if (state.city) {
    params.set("city", state.city);
  }

  if (state.neighborhood) {
    params.set("neighborhood", state.neighborhood);
  }

  if (state.listingType) {
    params.set("listingType", state.listingType);
  }

  if (state.propertyType) {
    params.set("propertyType", state.propertyType);
  }

  if (state.priceMin !== null) {
    params.set("priceMin", formatNumberParam(state.priceMin));
  }

  if (state.priceMax !== null) {
    params.set("priceMax", formatNumberParam(state.priceMax));
  }

  if (state.areaMin !== null) {
    params.set("areaMin", formatNumberParam(state.areaMin));
  }

  if (state.areaMax !== null) {
    params.set("areaMax", formatNumberParam(state.areaMax));
  }

  if (state.bedsMin !== null) {
    params.set("bedsMin", formatNumberParam(state.bedsMin));
  }

  if (state.bathsMin !== null) {
    params.set("bathsMin", formatNumberParam(state.bathsMin));
  }

  if (state.furnished) {
    params.set("furnished", "1");
  }

  if (state.parking) {
    params.set("parking", "1");
  }

  if (state.pets) {
    params.set("pets", "1");
  }

  if (state.availableNow) {
    params.set("availableNow", "1");
  }

  return params;
}

export function buildExploreHref(state: ExploreSearchState) {
  const params = toExploreSearchParams(state);
  const queryString = params.toString();

  return queryString ? `/explore?${queryString}` : "/explore";
}

export function buildMapHref(
  state: ExploreSearchState,
  options: {
    includePage?: boolean;
  } = {}
) {
  const params = toExploreSearchParams(state);

  if (!(options.includePage ?? false)) {
    params.delete("page");
  }

  const queryString = params.toString();

  return queryString ? `/map?${queryString}` : "/map";
}

export function hasActiveExploreFilters(state: ExploreSearchState) {
  return Boolean(
    state.keyword ||
      state.city ||
      state.neighborhood ||
      state.listingType ||
      state.propertyType ||
      state.priceMin !== null ||
      state.priceMax !== null ||
      state.areaMin !== null ||
      state.areaMax !== null ||
      state.bedsMin !== null ||
      state.bathsMin !== null ||
      state.furnished ||
      state.parking ||
      state.pets ||
      state.availableNow
  );
}
