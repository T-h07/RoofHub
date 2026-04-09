import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Database } from "@/types/database";

import type {
  ProviderListingOverviewMetrics,
  ProviderListingStatus,
  ProviderListingStatusFilter,
  ProviderManagedListing,
  ProviderManagedListingRow,
} from "./types";

const PROVIDER_MANAGED_LISTINGS_SELECT = `
  id,
  slug,
  title,
  listing_status,
  listing_type,
  property_type,
  price_amount,
  currency_code,
  city,
  neighborhood,
  published_at,
  archived_at,
  updated_at,
  created_at,
  listing_images (
    storage_path,
    is_cover,
    sort_order
  )
`;

function getCoverImagePath(images: ProviderManagedListingRow["listing_images"]): string | null {
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

async function countProviderListingsByStatus(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    isAdmin: boolean;
    status?: ProviderListingStatus;
  }
) {
  let query = supabase.from("listings").select("id", { count: "exact", head: true });

  if (!input.isAdmin) {
    query = query.eq("owner_id", input.userId);
  }

  if (input.status) {
    query = query.eq("listing_status", input.status);
  }

  const { count, error } = await query;

  if (error) {
    return {
      ok: false as const,
      message: "Listing metrics are temporarily unavailable.",
      count: 0,
    };
  }

  return {
    ok: true as const,
    count: count ?? 0,
  };
}

export async function loadProviderListingOverviewMetrics(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    isAdmin: boolean;
  }
) {
  const [
    totalResult,
    publishedResult,
    draftResult,
    pausedResult,
    archivedResult,
    soldResult,
    rentedResult,
  ] = await Promise.all([
    countProviderListingsByStatus(supabase, input),
    countProviderListingsByStatus(supabase, { ...input, status: "published" }),
    countProviderListingsByStatus(supabase, { ...input, status: "draft" }),
    countProviderListingsByStatus(supabase, { ...input, status: "paused" }),
    countProviderListingsByStatus(supabase, { ...input, status: "archived" }),
    countProviderListingsByStatus(supabase, { ...input, status: "sold" }),
    countProviderListingsByStatus(supabase, { ...input, status: "rented" }),
  ]);

  const failedResult = [
    totalResult,
    publishedResult,
    draftResult,
    pausedResult,
    archivedResult,
    soldResult,
    rentedResult,
  ].find((result) => !result.ok);

  if (failedResult && !failedResult.ok) {
    return {
      ok: false as const,
      message: failedResult.message,
      metrics: {
        total: 0,
        published: 0,
        draft: 0,
        paused: 0,
        archived: 0,
        sold: 0,
        rented: 0,
        unreadLeadsPlaceholder: 0,
      } satisfies ProviderListingOverviewMetrics,
    };
  }

  return {
    ok: true as const,
    metrics: {
      total: totalResult.count,
      published: publishedResult.count,
      draft: draftResult.count,
      paused: pausedResult.count,
      archived: archivedResult.count,
      sold: soldResult.count,
      rented: rentedResult.count,
      unreadLeadsPlaceholder: 0,
    } satisfies ProviderListingOverviewMetrics,
  };
}

export async function loadProviderManagedListings(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    isAdmin: boolean;
    statusFilter?: ProviderListingStatusFilter;
    limit?: number;
  }
) {
  let query = supabase
    .from("listings")
    .select(PROVIDER_MANAGED_LISTINGS_SELECT)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 120);

  if (!input.isAdmin) {
    query = query.eq("owner_id", input.userId);
  }

  if (input.statusFilter && input.statusFilter !== "all") {
    query = query.eq("listing_status", input.statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false as const,
      message: "Your listings are temporarily unavailable.",
      listings: [] as ProviderManagedListing[],
    };
  }

  const listingRows = (data ?? []) as ProviderManagedListingRow[];
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

  const listings: ProviderManagedListing[] = listingRows.map((listing) => {
    const coverEntry = coverImageMap.get(listing.id);

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      listing_status: listing.listing_status,
      listing_type: listing.listing_type,
      property_type: listing.property_type,
      price_amount: listing.price_amount,
      currency_code: listing.currency_code,
      city: listing.city,
      neighborhood: listing.neighborhood,
      published_at: listing.published_at,
      archived_at: listing.archived_at,
      updated_at: listing.updated_at,
      created_at: listing.created_at,
      coverImagePath: coverEntry?.coverImagePath ?? null,
      coverImageUrl: coverEntry?.signedUrl ?? null,
    } satisfies ProviderManagedListing;
  });

  return {
    ok: true as const,
    listings,
  };
}
