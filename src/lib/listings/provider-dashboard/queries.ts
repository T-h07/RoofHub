import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { loadProviderUnreadLeadCount } from "@/lib/messaging/queries";
import { createSchemaDriftMessage, isSupabaseSchemaDriftError, logSupabaseSchemaDrift } from "@/lib/supabase/schema-drift";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Database } from "@/types/database";

import type {
  ProviderInventoryMapListing,
  ProviderInventoryMapListingRow,
  ProviderInventoryMapScope,
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

const PROVIDER_INVENTORY_MAP_LISTINGS_SELECT = `
  id,
  organization_id,
  slug,
  title,
  listing_status,
  listing_type,
  property_type,
  price_amount,
  currency_code,
  city,
  neighborhood,
  latitude,
  longitude,
  public_location_mode,
  updated_at
`;

const STRICT_COORDINATE_PATTERN = /^-?\d+(?:\.\d+)?$/;
const MAX_COORDINATE_TOKEN_LENGTH = 32;

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

function parseCoordinate(value: number | string | null) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
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

  if (!error) {
    return {
      ok: true as const,
      count: count ?? 0,
    };
  }

  if (
    isSupabaseSchemaDriftError(error, [
      "listings",
      "organization_id",
      "created_by_user_id",
      "assigned_agent_user_id",
      "published_by_user_id",
    ])
  ) {
    logSupabaseSchemaDrift("provider_dashboard_metrics", error, {
      user_id: input.userId,
      organization_id: input.organizationId ?? null,
      status: input.status ?? null,
    });
    return {
      ok: false as const,
      message: createSchemaDriftMessage("Listing metrics"),
      count: 0,
    };
  }

  return {
    ok: false as const,
    message: "Listing metrics are temporarily unavailable.",
    count: 0,
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

  const buildPrimaryQuery = () =>
    supabase
      .from("listings")
      .select(PROVIDER_MANAGED_LISTINGS_SELECT)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(normalizedLimit);

  let query = buildPrimaryQuery();

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

  const primaryResult = await query;

  if (primaryResult.error) {
    if (
      isSupabaseSchemaDriftError(primaryResult.error, [
        "listings",
        "organization_id",
        "created_by_user_id",
        "assigned_agent_user_id",
        "published_by_user_id",
      ])
    ) {
      logSupabaseSchemaDrift("provider_managed_listings", primaryResult.error, {
        user_id: input.userId,
        organization_id: input.organizationId ?? null,
        status_filter: statusFilter,
      });
      return {
        ok: false as const,
        message: createSchemaDriftMessage("Listing workspace"),
        listings: [] as ProviderManagedListing[],
      };
    }

    return {
      ok: false as const,
      message: "Your listings are temporarily unavailable.",
      listings: [] as ProviderManagedListing[],
    };
  }

  const unifiedRows = (primaryResult.data ?? []) as ProviderManagedListingRow[];

  const coverImageUrlEntries = await Promise.all(
    unifiedRows.map(async (listing) => {
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

  const listings: ProviderManagedListing[] = unifiedRows.map((listing) => {
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

export async function loadProviderInventoryMapListings(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    organizationId?: string | null;
    scope?: ProviderInventoryMapScope;
    statusFilter?: ProviderListingStatusFilter;
    limit?: number;
  }
) {
  const normalizedLimit =
    typeof input.limit === "number" && Number.isFinite(input.limit)
      ? Math.max(1, Math.min(500, Math.trunc(input.limit)))
      : 250;
  const normalizedScope = input.scope ?? "owner";
  const statusFilter = isProviderListingStatusFilter(input.statusFilter)
    ? input.statusFilter
    : "all";

  let query = supabase
    .from("listings")
    .select(PROVIDER_INVENTORY_MAP_LISTINGS_SELECT, { count: "exact" })
    .order("updated_at", { ascending: false })
    .limit(normalizedLimit);

  if (normalizedScope === "organization") {
    if (!input.organizationId) {
      return {
        ok: false as const,
        message: "Company inventory map context is missing organization scope.",
        listings: [] as ProviderInventoryMapListing[],
        totalCount: 0,
        mappableCount: 0,
      };
    }

    query = query.eq("organization_id", input.organizationId);
  } else if (normalizedScope === "mixed" && input.organizationId) {
    query = query.or(
      `organization_id.eq.${input.organizationId},and(organization_id.is.null,owner_id.eq.${input.userId})`
    );
  } else {
    query = query.eq("owner_id", input.userId);
  }

  if (statusFilter !== "all") {
    query = query.eq("listing_status", statusFilter);
  }

  const primaryResult = await query;

  if (primaryResult.error) {
    if (
      isSupabaseSchemaDriftError(primaryResult.error, [
        "listings",
        "organization_id",
        "latitude",
        "longitude",
        "public_location_mode",
      ])
    ) {
      logSupabaseSchemaDrift("provider_inventory_map", primaryResult.error, {
        user_id: input.userId,
        organization_id: input.organizationId ?? null,
        scope: normalizedScope,
        status_filter: statusFilter,
      });
      return {
        ok: false as const,
        message: createSchemaDriftMessage("Inventory map"),
        listings: [] as ProviderInventoryMapListing[],
        totalCount: 0,
        mappableCount: 0,
      };
    }

    return {
      ok: false as const,
      message: "Inventory map listings are temporarily unavailable.",
      listings: [] as ProviderInventoryMapListing[],
      totalCount: 0,
      mappableCount: 0,
    };
  }

  const unifiedRows = (primaryResult.data ?? []) as ProviderInventoryMapListingRow[];
  const totalCount = primaryResult.count ?? 0;

  const listings = unifiedRows
    .map((listing) => {
      const latitude = parseCoordinate(listing.latitude);
      const longitude = parseCoordinate(listing.longitude);

      if (latitude === null || longitude === null) {
        return null;
      }

      return {
        id: listing.id,
        organization_id: listing.organization_id,
        slug: listing.slug,
        title: listing.title,
        listing_status: listing.listing_status,
        listing_type: listing.listing_type,
        property_type: listing.property_type,
        price_amount: listing.price_amount,
        currency_code: listing.currency_code,
        city: listing.city,
        neighborhood: listing.neighborhood,
        public_location_mode: listing.public_location_mode,
        updated_at: listing.updated_at,
        ownershipMode: listing.organization_id ? "company" : "individual",
        latitude,
        longitude,
      } satisfies ProviderInventoryMapListing;
    })
    .filter((listing): listing is ProviderInventoryMapListing => Boolean(listing));

  return {
    ok: true as const,
    listings,
    totalCount,
    mappableCount: listings.length,
  };
}
