import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadProviderUnreadLeadCount } from "@/lib/messaging/queries";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Database } from "@/types/database";

import type {
  ProviderListingOverviewMetrics,
  ProviderListingStatus,
  ProviderListingStatusFilter,
  ProviderManagedListing,
  ProviderManagedListingRow,
} from "./types";
import { isProviderListingStatusFilter } from "./types";

const PROVIDER_MANAGED_LISTINGS_SELECT = `
  id,
  organization_id,
  created_by_user_id,
  assigned_agent_user_id,
  published_by_user_id,
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
    organizationId?: string | null;
    status?: ProviderListingStatus;
  }
) {
  let query = supabase
    .from("listings")
    .select("id", { count: "exact", head: true });

  if (input.organizationId) {
    query = query.or(
      `organization_id.eq.${input.organizationId},and(organization_id.is.null,owner_id.eq.${input.userId})`
    );
  } else {
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
    organizationId?: string | null;
  }
) {
  const scopedInput = {
    userId: input.userId,
    organizationId: input.organizationId ?? null,
  };

  const [
    totalResult,
    publishedResult,
    draftResult,
    submittedForReviewResult,
    needsChangesResult,
    approvedResult,
    unpublishedResult,
    pausedResult,
    archivedResult,
    soldResult,
    rentedResult,
    hiddenByAdminResult,
    unreadResult,
  ] = await Promise.all([
    countProviderListingsByStatus(supabase, scopedInput),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "published" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "draft" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "submitted_for_review" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "needs_changes" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "approved" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "unpublished" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "paused" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "archived" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "sold" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "rented" }),
    countProviderListingsByStatus(supabase, { ...scopedInput, status: "hidden_by_admin" }),
    loadProviderUnreadLeadCount(supabase, scopedInput.userId),
  ]);

  const failedResult = [
    totalResult,
    publishedResult,
    draftResult,
    submittedForReviewResult,
    needsChangesResult,
    approvedResult,
    unpublishedResult,
    pausedResult,
    archivedResult,
    soldResult,
    rentedResult,
    hiddenByAdminResult,
  ].find((result) => !result.ok);

  if (failedResult && !failedResult.ok) {
    return {
      ok: false as const,
      message: failedResult.message,
      metrics: {
        total: 0,
        published: 0,
        draft: 0,
        submittedForReview: 0,
        needsChanges: 0,
        approved: 0,
        unpublished: 0,
        paused: 0,
        archived: 0,
        sold: 0,
        rented: 0,
        hiddenByAdmin: 0,
        unreadLeadsCount: 0,
      } satisfies ProviderListingOverviewMetrics,
    };
  }

  return {
    ok: true as const,
    metrics: {
      total: totalResult.count,
      published: publishedResult.count,
      draft: draftResult.count,
      submittedForReview: submittedForReviewResult.count,
      needsChanges: needsChangesResult.count,
      approved: approvedResult.count,
      unpublished: unpublishedResult.count,
      paused: pausedResult.count,
      archived: archivedResult.count,
      sold: soldResult.count,
      rented: rentedResult.count,
      hiddenByAdmin: hiddenByAdminResult.count,
      unreadLeadsCount: unreadResult.ok ? unreadResult.count : 0,
    } satisfies ProviderListingOverviewMetrics,
  };
}

export async function loadProviderManagedListings(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    organizationId?: string | null;
    statusFilter?: ProviderListingStatusFilter;
    limit?: number;
  }
) {
  const normalizedLimit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(300, Math.trunc(input.limit)))
      : 120;
  const statusFilter = isProviderListingStatusFilter(input.statusFilter)
    ? input.statusFilter
    : "all";

  let query = supabase
    .from("listings")
    .select(PROVIDER_MANAGED_LISTINGS_SELECT)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(normalizedLimit);

  if (input.organizationId) {
    query = query.or(
      `organization_id.eq.${input.organizationId},and(organization_id.is.null,owner_id.eq.${input.userId})`
    );
  } else {
    query = query.eq("owner_id", input.userId);
  }

  if (statusFilter !== "all") {
    query = query.eq("listing_status", statusFilter);
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
      organization_id: listing.organization_id,
      created_by_user_id: listing.created_by_user_id,
      assigned_agent_user_id: listing.assigned_agent_user_id,
      published_by_user_id: listing.published_by_user_id,
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
      ownershipMode: listing.organization_id ? "company" : "individual",
      coverImagePath: coverEntry?.coverImagePath ?? null,
      coverImageUrl: coverEntry?.signedUrl ?? null,
    } satisfies ProviderManagedListing;
  });

  return {
    ok: true as const,
    listings,
  };
}
