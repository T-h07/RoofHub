import "server-only";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/types/database";

import { EXPLORE_PAGE_SIZE, type ExploreSearchState } from "./explore-search-params";
import { loadFavoriteListingIdsForUser } from "./favorites";
import {
  normalizePublicListingCompanyAttribution,
  type PublicListingCompanyAttribution,
  type PublicListingCompanyRow,
} from "./public-company-attribution";
import { applyPublicListingFilters } from "./public-listing-filters";
import { PUBLIC_DISCOVERY_STATUS } from "./visibility";

type PublicExploreListingRow = Pick<
  Tables<"listings">,
  | "id"
  | "organization_id"
  | "slug"
  | "title"
  | "listing_type"
  | "property_type"
  | "price_amount"
  | "currency_code"
  | "city"
  | "neighborhood"
  | "bedrooms"
  | "bathrooms"
  | "area_m2"
  | "published_at"
  | "created_at"
> & {
  listing_images:
    | Array<Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">>
    | null;
};

export type PublicExploreListing = Omit<
  PublicExploreListingRow,
  "listing_images" | "organization_id"
> & {
  coverImageUrl: string | null;
  coverImagePath: string | null;
  isFavorited: boolean;
  company: PublicListingCompanyAttribution | null;
};

type PublicExploreSuccessResult = {
  ok: true;
  listings: PublicExploreListing[];
  totalCount: number;
  totalPages: number;
  cityOptions: string[];
  viewerUserId: string | null;
};

type PublicExploreErrorResult = {
  ok: false;
  message: string;
  listings: PublicExploreListing[];
  totalCount: number;
  totalPages: number;
  cityOptions: string[];
  viewerUserId: string | null;
};

export type PublicExploreResult = PublicExploreSuccessResult | PublicExploreErrorResult;

const PUBLIC_EXPLORE_LISTINGS_SELECT = `
  id,
  slug,
  title,
  listing_type,
  property_type,
  price_amount,
  currency_code,
  city,
  neighborhood,
  bedrooms,
  bathrooms,
  area_m2,
  published_at,
  created_at,
  listing_images (
    storage_path,
    is_cover,
    sort_order
  ),
  organization_id
`;

const PUBLIC_EXPLORE_LISTINGS_LEGACY_SELECT = `
  id,
  slug,
  title,
  listing_type,
  property_type,
  price_amount,
  currency_code,
  city,
  neighborhood,
  bedrooms,
  bathrooms,
  area_m2,
  published_at,
  created_at,
  listing_images (
    storage_path,
    is_cover,
    sort_order
  )
`;

function isMissingOrganizationOwnershipColumnError(input: {
  code?: string | null;
  message?: string | null;
}) {
  const message = (input.message ?? "").toLowerCase();
  return (
    input.code === "42703" &&
    message.includes("organization_id") &&
    message.includes("listings")
  );
}

function getCoverImagePath(
  images: PublicExploreListingRow["listing_images"]
): string | null {
  if (!images || images.length === 0) {
    return null;
  }

  const sortedImages = [...images].sort((left, right) => {
    if (left.is_cover === right.is_cover) {
      return left.sort_order - right.sort_order;
    }

    return left.is_cover ? -1 : 1;
  });

  return sortedImages[0]?.storage_path ?? null;
}

function normalizeCityOptions(cities: Array<{ city: string }>) {
  const deduped = new Map<string, string>();

  for (const cityRow of cities) {
    const city = cityRow.city?.trim();
    if (!city) {
      continue;
    }

    const dedupeKey = city.toLocaleLowerCase();
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, city);
    }
  }

  return [...deduped.values()].sort((left, right) => left.localeCompare(right));
}

async function loadPublishedCityOptions() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("listings")
    .select("city")
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
    .order("city", { ascending: true })
    .limit(180);

  return normalizeCityOptions((data ?? []) as Array<{ city: string }>);
}

async function loadExploreOrganizationRowsByIds(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationIds: string[]
) {
  if (organizationIds.length === 0) {
    return new Map<string, PublicListingCompanyRow>();
  }

  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, logo_path, status")
    .in("id", organizationIds);

  if (error) {
    console.error("[Explore] organization attribution query failed", {
      code: error.code ?? null,
      message: error.message ?? null,
      details: error.details ?? null,
      hint: error.hint ?? null,
      organization_ids_count: organizationIds.length,
    });
    return new Map<string, PublicListingCompanyRow>();
  }

  return new Map(
    ((data ?? []) as PublicListingCompanyRow[]).map((organization) => [
      organization.id,
      organization,
    ])
  );
}

export async function loadPublicExploreListings(state: ExploreSearchState): Promise<PublicExploreResult> {
  try {
    const cityOptions = await loadPublishedCityOptions();
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rangeStart = (state.page - 1) * EXPLORE_PAGE_SIZE;
    const rangeEnd = rangeStart + EXPLORE_PAGE_SIZE - 1;

    const primaryQuery = applyPublicListingFilters(
      supabase
        .from("listings")
        .select(PUBLIC_EXPLORE_LISTINGS_SELECT, { count: "exact" }),
      state
    );

    let sortedPrimaryQuery = primaryQuery;
    if (state.sort === "price_asc") {
      sortedPrimaryQuery = sortedPrimaryQuery
        .order("price_amount", { ascending: true })
        .order("published_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else if (state.sort === "price_desc") {
      sortedPrimaryQuery = sortedPrimaryQuery
        .order("price_amount", { ascending: false })
        .order("published_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else {
      sortedPrimaryQuery = sortedPrimaryQuery
        .order("published_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
        });
    }

    const primaryResult = await sortedPrimaryQuery.range(rangeStart, rangeEnd);

    let listingRows: PublicExploreListingRow[] = [];
    let totalCount = 0;
    let ownershipColumnMissing = false;

    if (primaryResult.error) {
      ownershipColumnMissing = isMissingOrganizationOwnershipColumnError({
        code: primaryResult.error.code ?? null,
        message: primaryResult.error.message ?? null,
      });

      if (!ownershipColumnMissing) {
        console.error("[Explore] public listings query failed", {
          code: primaryResult.error.code ?? null,
          message: primaryResult.error.message ?? null,
          details: primaryResult.error.details ?? null,
          hint: primaryResult.error.hint ?? null,
          query_page: state.page,
          query_sort: state.sort,
        });
        return {
          ok: false,
          message: "We couldn’t load listings right now. Please refresh and try again.",
          listings: [],
          totalCount: 0,
          totalPages: 0,
          cityOptions,
          viewerUserId: user?.id ?? null,
        };
      }

      const legacyQuery = applyPublicListingFilters(
        supabase
          .from("listings")
          .select(PUBLIC_EXPLORE_LISTINGS_LEGACY_SELECT, { count: "exact" }),
        state
      );

      let sortedLegacyQuery = legacyQuery;
      if (state.sort === "price_asc") {
        sortedLegacyQuery = sortedLegacyQuery
          .order("price_amount", { ascending: true })
          .order("published_at", {
            ascending: false,
            nullsFirst: false,
          });
      } else if (state.sort === "price_desc") {
        sortedLegacyQuery = sortedLegacyQuery
          .order("price_amount", { ascending: false })
          .order("published_at", {
            ascending: false,
            nullsFirst: false,
          });
      } else {
        sortedLegacyQuery = sortedLegacyQuery
          .order("published_at", {
            ascending: false,
            nullsFirst: false,
          })
          .order("created_at", {
            ascending: false,
          });
      }

      const legacyResult = await sortedLegacyQuery.range(rangeStart, rangeEnd);

      if (legacyResult.error) {
        console.error("[Explore] public listings legacy fallback failed", {
          code: legacyResult.error.code ?? null,
          message: legacyResult.error.message ?? null,
          details: legacyResult.error.details ?? null,
          hint: legacyResult.error.hint ?? null,
          query_page: state.page,
          query_sort: state.sort,
        });
        return {
          ok: false,
          message: "We couldn’t load listings right now. Please refresh and try again.",
          listings: [],
          totalCount: 0,
          totalPages: 0,
          cityOptions,
          viewerUserId: user?.id ?? null,
        };
      }

      listingRows = (
        (legacyResult.data ?? []) as Array<Omit<PublicExploreListingRow, "organization_id">>
      ).map((listing) => ({
        ...listing,
        organization_id: null,
      }));
      totalCount = legacyResult.count ?? 0;
    } else {
      listingRows = (primaryResult.data ?? []) as PublicExploreListingRow[];
      totalCount = primaryResult.count ?? 0;
    }

    if (ownershipColumnMissing) {
      console.warn(
        "[Explore] listings.organization_id is missing; running legacy explore projection without company attribution."
      );
    }

    const organizationIds = Array.from(
      new Set(
        listingRows
          .map((listing) => listing.organization_id ?? null)
          .filter((organizationId): organizationId is string => Boolean(organizationId))
      )
    );
    const organizationById = await loadExploreOrganizationRowsByIds(
      supabase,
      organizationIds
    );
    const favoriteListingIds =
      user && listingRows.length > 0
        ? await loadFavoriteListingIdsForUser(
            supabase,
            user.id,
            listingRows.map((listing) => listing.id)
          )
        : new Set<string>();
    const coverImageUrlEntries = await Promise.all(
      listingRows.map(async (listing) => {
        const coverImagePath = getCoverImagePath(listing.listing_images);
        if (!coverImagePath) {
          return [listing.id, null, null] as const;
        }

        try {
          const signedUrl = await createListingImageSignedUrl(supabase, coverImagePath, 30 * 60);
          return [listing.id, coverImagePath, signedUrl] as const;
        } catch {
          return [listing.id, coverImagePath, null] as const;
        }
      })
    );

    const coverImageMap = new Map(
      coverImageUrlEntries.map(([listingId, coverImagePath, signedUrl]) => [
        listingId,
        {
          coverImagePath,
          signedUrl,
        },
      ])
    );

    const listings: PublicExploreListing[] = listingRows.map((listing) => {
      const coverEntry = coverImageMap.get(listing.id);

      return {
        id: listing.id,
        slug: listing.slug,
        title: listing.title,
        listing_type: listing.listing_type,
        property_type: listing.property_type,
        price_amount: listing.price_amount,
        currency_code: listing.currency_code,
        city: listing.city,
        neighborhood: listing.neighborhood,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        area_m2: listing.area_m2,
        published_at: listing.published_at,
        created_at: listing.created_at,
        coverImagePath: coverEntry?.coverImagePath ?? null,
        coverImageUrl: coverEntry?.signedUrl ?? null,
        isFavorited: favoriteListingIds.has(listing.id),
        company: normalizePublicListingCompanyAttribution(
          supabase,
          listing.organization_id ? organizationById.get(listing.organization_id) ?? null : null
        ),
      };
    });

    const totalPages = totalCount > 0 ? Math.ceil(totalCount / EXPLORE_PAGE_SIZE) : 0;

    return {
      ok: true,
      listings,
      totalCount,
      totalPages,
      cityOptions,
      viewerUserId: user?.id ?? null,
    };
  } catch {
    return {
      ok: false,
      message: "Listings couldn’t load because core configuration is incomplete.",
      listings: [],
      totalCount: 0,
      totalPages: 0,
      cityOptions: [],
      viewerUserId: null,
    };
  }
}
