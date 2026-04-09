import "server-only";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Tables } from "@/types/database";

import type { ExploreSearchState } from "./explore-search-params";
import type { MapSearchBounds } from "./map-bounds";
import { applyPublicListingFilters } from "./public-listing-filters";

export const PUBLIC_MAP_MARKER_LIMIT = 350;

type PublicMapListingRow = Pick<
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
  | "latitude"
  | "longitude"
  | "public_location_mode"
  | "published_at"
  | "created_at"
> & {
  listing_images:
    | Array<Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">>
    | null;
};

export type PublicMapListing = Omit<PublicMapListingRow, "listing_images" | "latitude" | "longitude"> & {
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  coverImagePath: string | null;
};

type PublicMapSuccessResult = {
  ok: true;
  listings: PublicMapListing[];
  totalCount: number;
  markerCount: number;
  isTruncated: boolean;
  markerLimit: number;
};

type PublicMapErrorResult = {
  ok: false;
  message: string;
  listings: PublicMapListing[];
  totalCount: number;
  markerCount: number;
  isTruncated: boolean;
  markerLimit: number;
};

export type PublicMapResult = PublicMapSuccessResult | PublicMapErrorResult;

const PUBLIC_MAP_LISTINGS_SELECT = `
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
  latitude,
  longitude,
  public_location_mode,
  published_at,
  created_at,
  listing_images (
    storage_path,
    is_cover,
    sort_order
  )
`;
const STRICT_COORDINATE_PATTERN = /^-?\d+(?:\.\d+)?$/;
const MAX_COORDINATE_TOKEN_LENGTH = 32;

function parseCoordinate(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value.trim();
  if (
    normalized.length > MAX_COORDINATE_TOKEN_LENGTH ||
    !STRICT_COORDINATE_PATTERN.test(normalized)
  ) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getCoverImagePath(
  images: PublicMapListingRow["listing_images"]
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

type LoadPublicMapListingsOptions = {
  bounds: MapSearchBounds | null;
};

export async function loadPublicMapListings(
  state: ExploreSearchState,
  options: LoadPublicMapListingsOptions = { bounds: null }
): Promise<PublicMapResult> {
  try {
    const supabase = await createServerSupabaseClient();

    let query = applyPublicListingFilters(
      supabase
        .from("listings")
        .select(PUBLIC_MAP_LISTINGS_SELECT, { count: "exact" }),
      state
    ).neq("public_location_mode", "hidden");

    if (options.bounds) {
      query = query
        .gte("longitude", options.bounds.west)
        .lte("longitude", options.bounds.east)
        .gte("latitude", options.bounds.south)
        .lte("latitude", options.bounds.north);
    }

    query = query
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      });

    const { data, error, count } = await query.limit(PUBLIC_MAP_MARKER_LIMIT);

    if (error) {
      return {
        ok: false,
        message: "Map listings are temporarily unavailable. Please refresh and try again.",
        listings: [],
        totalCount: 0,
        markerCount: 0,
        isTruncated: false,
        markerLimit: PUBLIC_MAP_MARKER_LIMIT,
      };
    }

    const listingRows = (data ?? []) as PublicMapListingRow[];
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

    const listings: PublicMapListing[] = listingRows
      .map((listing) => {
        const latitude = parseCoordinate(listing.latitude as number | string);
        const longitude = parseCoordinate(listing.longitude as number | string);

        if (latitude === null || longitude === null) {
          return null;
        }

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
          latitude,
          longitude,
          public_location_mode: listing.public_location_mode,
          published_at: listing.published_at,
          created_at: listing.created_at,
          coverImagePath: coverEntry?.coverImagePath ?? null,
          coverImageUrl: coverEntry?.signedUrl ?? null,
        };
      })
      .filter((listing): listing is PublicMapListing => Boolean(listing));

    const totalCount = count ?? 0;

    return {
      ok: true,
      listings,
      totalCount,
      markerCount: listings.length,
      isTruncated: totalCount > PUBLIC_MAP_MARKER_LIMIT,
      markerLimit: PUBLIC_MAP_MARKER_LIMIT,
    };
  } catch {
    return {
      ok: false,
      message:
        "Map is not configured yet. Set Supabase and map environment variables, then restart the app.",
      listings: [],
      totalCount: 0,
      markerCount: 0,
      isTruncated: false,
      markerLimit: PUBLIC_MAP_MARKER_LIMIT,
    };
  }
}
