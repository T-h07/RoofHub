import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/database";
import {
  normalizePublicListingCompanyAttribution,
  PUBLIC_LISTING_COMPANY_RELATION_SELECT,
  type PublicListingCompanyAttribution,
  type PublicListingCompanyRow,
} from "./public-company-attribution";
import { PUBLIC_DISCOVERY_STATUS } from "./visibility";

type ExploreListingSummaryRow = Pick<
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
  organization: PublicListingCompanyRow | null;
};

export type FavoriteListingSummary = Omit<
  ExploreListingSummaryRow,
  "listing_images" | "organization"
> & {
  coverImageUrl: string | null;
  coverImagePath: string | null;
  isFavorited: true;
  favoritedAt: string;
  company: PublicListingCompanyAttribution | null;
};

type FavoriteListingJoinRow = {
  created_at: string;
  listings: ExploreListingSummaryRow | null;
};

export type ViewerFavoriteListingsResult =
  | {
      ok: true;
      listings: FavoriteListingSummary[];
      hiddenCount: number;
      totalCount: number;
    }
  | {
      ok: false;
      listings: FavoriteListingSummary[];
      hiddenCount: number;
      totalCount: number;
      message: string;
    };

function getCoverImagePath(images: ExploreListingSummaryRow["listing_images"]): string | null {
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

async function resolveCoverImageMap(
  supabase: SupabaseClient<Database>,
  rows: ExploreListingSummaryRow[]
) {
  const coverImageUrlEntries = await Promise.all(
    rows.map(async (listing) => {
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

  return new Map(
    coverImageUrlEntries.map(([listingId, coverImagePath, signedUrl]) => [
      listingId,
      {
        coverImagePath,
        signedUrl,
      },
    ])
  );
}

export async function loadFavoriteListingIdsForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  listingIds: string[]
) {
  if (listingIds.length === 0) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", userId)
    .in("listing_id", listingIds);

  if (error || !data) {
    return new Set<string>();
  }

  return new Set(data.map((favorite) => favorite.listing_id));
}

export async function loadViewerFavoriteListings(
  userId: string
): Promise<ViewerFavoriteListingsResult> {
  try {
    const supabase = await createServerSupabaseClient();

    const [{ count: totalCount }, listingsResult] = await Promise.all([
      supabase.from("favorites").select("listing_id", { count: "exact", head: true }).eq("user_id", userId),
      supabase
        .from("favorites")
        .select(
          `
          created_at,
          listings!inner(
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
            ${PUBLIC_LISTING_COMPANY_RELATION_SELECT}
          )
        `
        )
        .eq("user_id", userId)
        .eq("listings.listing_status", PUBLIC_DISCOVERY_STATUS)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    if (listingsResult.error) {
      return {
        ok: false,
        listings: [],
        hiddenCount: 0,
        totalCount: 0,
        message: "Favorites couldn’t be loaded right now. Please try again.",
      };
    }

    const favoriteRows = (listingsResult.data ?? []) as FavoriteListingJoinRow[];
    const joinedListings = favoriteRows
      .map((row) => row.listings)
      .filter((row): row is ExploreListingSummaryRow => Boolean(row));

    const coverImageMap = await resolveCoverImageMap(supabase, joinedListings);

    const listings: FavoriteListingSummary[] = favoriteRows
      .filter((row): row is FavoriteListingJoinRow & { listings: ExploreListingSummaryRow } =>
        Boolean(row.listings)
      )
      .map((row) => {
        const listing = row.listings;
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
          isFavorited: true,
          favoritedAt: row.created_at,
          company: normalizePublicListingCompanyAttribution(
            supabase,
            listing.organization
          ),
        };
      });

    const resolvedTotalCount = totalCount ?? listings.length;
    const hiddenCount = Math.max(resolvedTotalCount - listings.length, 0);

    return {
      ok: true,
      listings,
      hiddenCount,
      totalCount: resolvedTotalCount,
    };
  } catch {
    return {
      ok: false,
      listings: [],
      hiddenCount: 0,
      totalCount: 0,
      message: "Favorites are not configured yet. Set Supabase environment variables and restart the app.",
    };
  }
}
