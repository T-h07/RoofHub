import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Database, Tables } from "@/types/database";

import type {
  ListingModerationStatus,
  ModerationOverviewMetrics,
  ModerationReportQueueItem,
  ModerationReportQueueRow,
  ModerationStatusFilter,
} from "./types";

const MODERATION_REPORT_QUEUE_SELECT = `
  id,
  listing_id,
  reporter_id,
  reason_code,
  details,
  status,
  created_at,
  updated_at,
  reviewed_at,
  listing:listings (
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
    owner_id,
    updated_at
  ),
  reporter:profiles!listing_reports_reporter_id_fkey (
    id,
    display_name
  )
`;

type ListingImageRow = Pick<
  Tables<"listing_images">,
  "listing_id" | "storage_path" | "is_cover" | "sort_order"
>;

type MetricsCountResult =
  | {
      ok: true;
      count: number;
    }
  | {
      ok: false;
      count: number;
      message: string;
    };

async function countReportsByStatus(
  supabase: SupabaseClient<Database>,
  status: ModerationStatusFilter
): Promise<MetricsCountResult> {
  let query = supabase.from("listing_reports").select("id", { count: "exact", head: true });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { count, error } = await query;

  if (error) {
    return {
      ok: false,
      count: 0,
      message: "Moderation report metrics are temporarily unavailable.",
    };
  }

  return {
    ok: true,
    count: count ?? 0,
  };
}

async function countListingsByStatus(
  supabase: SupabaseClient<Database>,
  status: ListingModerationStatus
): Promise<MetricsCountResult> {
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("listing_status", status);

  if (error) {
    return {
      ok: false,
      count: 0,
      message: "Moderation listing metrics are temporarily unavailable.",
    };
  }

  return {
    ok: true,
    count: count ?? 0,
  };
}

export async function loadModerationOverviewMetrics(
  supabase: SupabaseClient<Database>
): Promise<{ ok: true; metrics: ModerationOverviewMetrics } | { ok: false; message: string }> {
  const [
    totalReportsResult,
    openReportsResult,
    underReviewReportsResult,
    resolvedReportsResult,
    dismissedReportsResult,
    hiddenListingsResult,
  ] = await Promise.all([
    countReportsByStatus(supabase, "all"),
    countReportsByStatus(supabase, "open"),
    countReportsByStatus(supabase, "under_review"),
    countReportsByStatus(supabase, "resolved"),
    countReportsByStatus(supabase, "dismissed"),
    countListingsByStatus(supabase, "hidden_by_admin"),
  ]);

  const failedResult = [
    totalReportsResult,
    openReportsResult,
    underReviewReportsResult,
    resolvedReportsResult,
    dismissedReportsResult,
    hiddenListingsResult,
  ].find((result) => !result.ok);

  if (failedResult && !failedResult.ok) {
    return {
      ok: false,
      message: failedResult.message,
    };
  }

  return {
    ok: true,
    metrics: {
      totalReports: totalReportsResult.count,
      openReports: openReportsResult.count,
      underReviewReports: underReviewReportsResult.count,
      resolvedReports: resolvedReportsResult.count,
      dismissedReports: dismissedReportsResult.count,
      hiddenListings: hiddenListingsResult.count,
    },
  };
}

export async function loadModerationReportQueue(
  supabase: SupabaseClient<Database>,
  input: {
    statusFilter?: ModerationStatusFilter;
    limit?: number;
  } = {}
): Promise<{ ok: true; reports: ModerationReportQueueItem[] } | { ok: false; message: string; reports: [] }> {
  const statusFilter = input.statusFilter ?? "open";
  const limit = typeof input.limit === "number" ? Math.max(1, Math.min(200, Math.trunc(input.limit))) : 120;

  let query = supabase
    .from("listing_reports")
    .select(MODERATION_REPORT_QUEUE_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false,
      message: "Moderation queue is temporarily unavailable.",
      reports: [],
    };
  }

  const rows = (data ?? []) as ModerationReportQueueRow[];
  const rowsWithListing = rows.filter(
    (row): row is ModerationReportQueueRow & { listing: NonNullable<ModerationReportQueueRow["listing"]> } =>
      Boolean(row.listing)
  );

  if (rowsWithListing.length === 0) {
    return {
      ok: true,
      reports: [],
    };
  }

  const listingIds = Array.from(new Set(rowsWithListing.map((row) => row.listing.id)));
  const listingImageResult = await supabase
    .from("listing_images")
    .select("listing_id, storage_path, is_cover, sort_order")
    .in("listing_id", listingIds)
    .order("is_cover", { ascending: false })
    .order("sort_order", { ascending: true });

  const coverImagePathByListing = new Map<string, string>();
  if (!listingImageResult.error) {
    for (const image of (listingImageResult.data ?? []) as ListingImageRow[]) {
      if (!coverImagePathByListing.has(image.listing_id)) {
        coverImagePathByListing.set(image.listing_id, image.storage_path);
      }
    }
  }

  const signedUrlEntries = await Promise.all(
    listingIds.map(async (listingId) => {
      const path = coverImagePathByListing.get(listingId) ?? null;
      if (!path) {
        return [listingId, null] as const;
      }

      try {
        const signedUrl = await createListingImageSignedUrl(supabase, path, 30 * 60);
        return [listingId, signedUrl] as const;
      } catch {
        return [listingId, null] as const;
      }
    })
  );

  const signedUrlByListing = new Map<string, string | null>(signedUrlEntries);

  return {
    ok: true,
    reports: rowsWithListing.map((row) => ({
      ...row,
      listing: row.listing,
      coverImagePath: coverImagePathByListing.get(row.listing.id) ?? null,
      coverImageUrl: signedUrlByListing.get(row.listing.id) ?? null,
    })),
  };
}
