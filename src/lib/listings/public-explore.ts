import "server-only";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/types/database";

import { EXPLORE_PAGE_SIZE, type ExploreSearchState } from "./explore-search-params";
import { applyPublicListingFilters } from "./public-listing-filters";

type PublicExploreListingRow = Pick<
  Tables<"listings">,
  | "id"
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

export type PublicExploreListing = Omit<PublicExploreListingRow, "listing_images"> & {
  coverImageUrl: string | null;
  coverImagePath: string | null;
};

type PublicExploreSuccessResult = {
  ok: true;
  listings: PublicExploreListing[];
  totalCount: number;
  totalPages: number;
  cityOptions: string[];
};

type PublicExploreErrorResult = {
  ok: false;
  message: string;
  listings: PublicExploreListing[];
  totalCount: number;
  totalPages: number;
  cityOptions: string[];
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
  )
`;

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
    .eq("listing_status", "published")
    .order("city", { ascending: true })
    .limit(250);

  return normalizeCityOptions((data ?? []) as Array<{ city: string }>);
}

export async function loadPublicExploreListings(state: ExploreSearchState): Promise<PublicExploreResult> {
  try {
    const cityOptions = await loadPublishedCityOptions();
    const supabase = await createServerSupabaseClient();
    const rangeStart = (state.page - 1) * EXPLORE_PAGE_SIZE;
    const rangeEnd = rangeStart + EXPLORE_PAGE_SIZE - 1;

    let query = applyPublicListingFilters(
      supabase
        .from("listings")
        .select(PUBLIC_EXPLORE_LISTINGS_SELECT, { count: "exact" }),
      state
    );

    if (state.sort === "price_asc") {
      query = query.order("price_amount", { ascending: true }).order("published_at", {
        ascending: false,
        nullsFirst: false,
      });
    } else if (state.sort === "price_desc") {
      query = query.order("price_amount", { ascending: false }).order("published_at", {
        ascending: false,
        nullsFirst: false,
      });
    } else {
      query = query.order("published_at", {
        ascending: false,
        nullsFirst: false,
      }).order("created_at", {
        ascending: false,
      });
    }

    const { data, error, count } = await query.range(rangeStart, rangeEnd);

    if (error) {
      return {
        ok: false,
        message: "Listings are temporarily unavailable. Please refresh and try again.",
        listings: [],
        totalCount: 0,
        totalPages: 0,
        cityOptions,
      };
    }

    const listingRows = (data ?? []) as PublicExploreListingRow[];
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
      };
    });

    const totalCount = count ?? 0;
    const totalPages = totalCount > 0 ? Math.ceil(totalCount / EXPLORE_PAGE_SIZE) : 0;

    return {
      ok: true,
      listings,
      totalCount,
      totalPages,
      cityOptions,
    };
  } catch {
    return {
      ok: false,
      message:
        "Explore is not configured yet. Set Supabase environment variables and restart the app.",
      listings: [],
      totalCount: 0,
      totalPages: 0,
      cityOptions: [],
    };
  }
}
