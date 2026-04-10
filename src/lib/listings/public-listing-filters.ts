import type {
  ExploreListingType,
  ExplorePropertyType,
  ExploreSearchState,
} from "./explore-search-params";
import { PUBLIC_DISCOVERY_STATUS } from "./visibility";

type PublicListingFilterQuery<TQuery> = {
  eq(column: string, value: unknown): TQuery;
  ilike(column: string, pattern: string): TQuery;
  gte(column: string, value: number | string): TQuery;
  lte(column: string, value: number | string): TQuery;
  or(filters: string): TQuery;
};

function sanitizeKeywordForOrQuery(keyword: string) {
  return keyword
    .replace(/[^a-z0-9\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROPERTY_TYPE_KEYWORD_ALIASES: Record<ExplorePropertyType, readonly string[]> = {
  apartment: ["apartment", "flat", "condo"],
  house: ["house", "home", "villa", "townhouse"],
  studio: ["studio", "loft"],
  land: ["land", "plot"],
  commercial: ["commercial", "office", "retail", "shop", "warehouse"],
};

const LISTING_TYPE_KEYWORD_ALIASES: Record<ExploreListingType, readonly string[]> = {
  rent: ["rent", "rental", "lease", "monthly"],
  sale: ["sale", "buy", "purchase", "owned"],
};

function collectEnumKeywordMatches<TValue extends string>(
  keyword: string,
  aliases: Record<TValue, readonly string[]>
) {
  const normalizedKeyword = keyword.toLowerCase();
  const matchedValues: TValue[] = [];

  for (const [value, aliasList] of Object.entries(aliases) as Array<[TValue, readonly string[]]>) {
    if (aliasList.some((alias) => normalizedKeyword.includes(alias))) {
      matchedValues.push(value);
    }
  }

  return matchedValues;
}

export function applyPublicListingFilters<TQuery extends PublicListingFilterQuery<TQuery>>(
  inputQuery: TQuery,
  state: ExploreSearchState
) {
  let query = inputQuery.eq("listing_status", PUBLIC_DISCOVERY_STATUS);

  if (state.listingType) {
    query = query.eq("listing_type", state.listingType);
  }

  if (state.propertyType) {
    query = query.eq("property_type", state.propertyType);
  }

  if (state.keyword) {
    const keyword = sanitizeKeywordForOrQuery(state.keyword);

    if (keyword.length > 0) {
      const orConditions = [
        `title.ilike.%${keyword}%`,
        `description.ilike.%${keyword}%`,
        `city.ilike.%${keyword}%`,
        `neighborhood.ilike.%${keyword}%`,
      ];

      const propertyTypeMatches = collectEnumKeywordMatches(
        keyword,
        PROPERTY_TYPE_KEYWORD_ALIASES
      );
      const listingTypeMatches = collectEnumKeywordMatches(
        keyword,
        LISTING_TYPE_KEYWORD_ALIASES
      );

      for (const propertyType of propertyTypeMatches) {
        orConditions.push(`property_type.eq.${propertyType}`);
      }

      for (const listingType of listingTypeMatches) {
        orConditions.push(`listing_type.eq.${listingType}`);
      }

      query = query.or(orConditions.join(","));
    }
  }

  if (state.city) {
    query = query.ilike("city", `%${state.city}%`);
  }

  if (state.neighborhood) {
    query = query.ilike("neighborhood", `%${state.neighborhood}%`);
  }

  if (state.priceMin !== null) {
    query = query.gte("price_amount", state.priceMin);
  }

  if (state.priceMax !== null) {
    query = query.lte("price_amount", state.priceMax);
  }

  if (state.areaMin !== null) {
    query = query.gte("area_m2", state.areaMin);
  }

  if (state.areaMax !== null) {
    query = query.lte("area_m2", state.areaMax);
  }

  if (state.bedsMin !== null) {
    query = query.gte("bedrooms", state.bedsMin);
  }

  if (state.bathsMin !== null) {
    query = query.gte("bathrooms", state.bathsMin);
  }

  if (state.furnished) {
    query = query.eq("furnished", true);
  }

  if (state.parking) {
    query = query.eq("parking", true);
  }

  if (state.pets) {
    query = query.eq("pets_allowed", true);
  }

  if (state.availableNow) {
    const todayIso = new Date().toISOString().slice(0, 10);
    query = query.lte("available_from", todayIso);
  }

  return query;
}
