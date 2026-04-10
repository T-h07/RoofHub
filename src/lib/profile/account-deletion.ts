import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { LISTING_IMAGES_BUCKET } from "@/lib/storage/listing-images";
import { PROFILE_AVATARS_BUCKET } from "@/lib/storage/profile-avatar";
import { createAdminSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const IN_FILTER_CHUNK_SIZE = 100;

function chunkArray<T>(items: readonly T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isBucketMissingError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();
  return normalized.includes("bucket") && normalized.includes("not found");
}

function normalizeStoragePath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

async function listBucketPathsByPrefix(
  supabase: SupabaseClient<Database>,
  input: {
    bucket: string;
    prefix: string;
    optionalBucket?: boolean;
  }
) {
  const normalizedPrefix = normalizeStoragePath(input.prefix);
  if (!normalizedPrefix) {
    return [];
  }

  const collectedPaths = new Set<string>();
  let offset = 0;

  while (true) {
    const { data, error } = await supabase.storage.from(input.bucket).list(normalizedPrefix, {
      limit: STORAGE_LIST_PAGE_SIZE,
      offset,
    });

    if (error) {
      if (input.optionalBucket && isBucketMissingError(error.message)) {
        return [];
      }

      throw new Error(`Failed to inspect ${input.bucket} objects: ${error.message}`);
    }

    const entries = data ?? [];
    for (const entry of entries) {
      if (!entry?.name) {
        continue;
      }

      collectedPaths.add(`${normalizedPrefix}/${entry.name}`);
    }

    if (entries.length < STORAGE_LIST_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_LIST_PAGE_SIZE;
  }

  return Array.from(collectedPaths);
}

async function removeBucketPaths(
  supabase: SupabaseClient<Database>,
  input: {
    bucket: string;
    paths: readonly string[];
    optionalBucket?: boolean;
  }
) {
  const uniquePaths = Array.from(new Set(input.paths.map(normalizeStoragePath).filter(Boolean)));
  if (uniquePaths.length === 0) {
    return;
  }

  const pathChunks = chunkArray(uniquePaths, STORAGE_REMOVE_CHUNK_SIZE);
  for (const pathChunk of pathChunks) {
    const { error } = await supabase.storage.from(input.bucket).remove(pathChunk);
    if (!error) {
      continue;
    }

    if (input.optionalBucket && isBucketMissingError(error.message)) {
      return;
    }

    throw new Error(`Failed to remove ${input.bucket} objects: ${error.message}`);
  }
}

async function loadOwnedListingIds(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.from("listings").select("id").eq("owner_id", userId);
  if (error) {
    throw new Error(`Failed to load owned listings for account deletion: ${error.message}`);
  }

  return (data ?? []).map((row) => row.id);
}

async function loadConversationIds(supabase: SupabaseClient<Database>, userId: string) {
  const [providerResult, seekerResult] = await Promise.all([
    supabase.from("conversations").select("id").eq("provider_id", userId),
    supabase.from("conversations").select("id").eq("seeker_id", userId),
  ]);

  if (providerResult.error) {
    throw new Error(
      `Failed to load provider conversations for account deletion: ${providerResult.error.message}`
    );
  }

  if (seekerResult.error) {
    throw new Error(
      `Failed to load seeker conversations for account deletion: ${seekerResult.error.message}`
    );
  }

  const conversationIds = new Set<string>();
  for (const row of providerResult.data ?? []) {
    conversationIds.add(row.id);
  }
  for (const row of seekerResult.data ?? []) {
    conversationIds.add(row.id);
  }

  return Array.from(conversationIds);
}

async function loadReportIds(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    listingIds: readonly string[];
  }
) {
  const reportIdSet = new Set<string>();

  const reporterResult = await supabase
    .from("listing_reports")
    .select("id")
    .eq("reporter_id", input.userId);

  if (reporterResult.error) {
    throw new Error(
      `Failed to load reporter-linked reports for account deletion: ${reporterResult.error.message}`
    );
  }

  for (const row of reporterResult.data ?? []) {
    reportIdSet.add(row.id);
  }

  if (input.listingIds.length === 0) {
    return Array.from(reportIdSet);
  }

  for (const listingIdChunk of chunkArray(input.listingIds, IN_FILTER_CHUNK_SIZE)) {
    const listingResult = await supabase
      .from("listing_reports")
      .select("id")
      .in("listing_id", listingIdChunk);

    if (listingResult.error) {
      throw new Error(
        `Failed to load listing-linked reports for account deletion: ${listingResult.error.message}`
      );
    }

    for (const row of listingResult.data ?? []) {
      reportIdSet.add(row.id);
    }
  }

  return Array.from(reportIdSet);
}

async function loadListingImagePaths(
  supabase: SupabaseClient<Database>,
  listingIds: readonly string[]
) {
  if (listingIds.length === 0) {
    return [];
  }

  const pathSet = new Set<string>();
  for (const listingIdChunk of chunkArray(listingIds, IN_FILTER_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("listing_images")
      .select("storage_path")
      .in("listing_id", listingIdChunk);

    if (error) {
      throw new Error(`Failed to load listing images for account deletion: ${error.message}`);
    }

    for (const row of data ?? []) {
      if (row.storage_path) {
        pathSet.add(normalizeStoragePath(row.storage_path));
      }
    }
  }

  return Array.from(pathSet);
}

async function loadListingImagePathsFromStorage(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    listingIds: readonly string[];
  }
) {
  const pathSet = new Set<string>();

  for (const listingId of input.listingIds) {
    const prefix = `owner/${input.userId}/listing/${listingId}`;
    const listedPaths = await listBucketPathsByPrefix(supabase, {
      bucket: LISTING_IMAGES_BUCKET,
      prefix,
    });
    listedPaths.forEach((path) => pathSet.add(path));
  }

  return Array.from(pathSet);
}

async function loadProfileAvatarPaths(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
  }
) {
  return listBucketPathsByPrefix(supabase, {
    bucket: PROFILE_AVATARS_BUCKET,
    prefix: `user/${input.userId}`,
    optionalBucket: true,
  });
}

async function deleteAuditRowsByColumn(
  supabase: SupabaseClient<Database>,
  input: {
    column: "listing_id" | "conversation_id" | "report_id";
    values: readonly string[];
  }
) {
  if (input.values.length === 0) {
    return;
  }

  for (const valueChunk of chunkArray(input.values, IN_FILTER_CHUNK_SIZE)) {
    const deleteResult = await supabase
      .from("security_audit_events")
      .delete()
      .in(input.column, valueChunk);

    if (deleteResult.error) {
      throw new Error(
        `Failed to remove ${input.column}-linked audit history during account deletion: ${deleteResult.error.message}`
      );
    }
  }
}

async function deleteLinkedAuditRows(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    listingIds: readonly string[];
    conversationIds: readonly string[];
    reportIds: readonly string[];
  }
) {
  const actorDeleteResult = await supabase
    .from("security_audit_events")
    .delete()
    .eq("actor_user_id", input.userId);

  if (actorDeleteResult.error) {
    throw new Error(
      `Failed to remove actor-linked audit history during account deletion: ${actorDeleteResult.error.message}`
    );
  }

  const targetDeleteResult = await supabase
    .from("security_audit_events")
    .delete()
    .eq("target_type", "profile")
    .eq("target_id", input.userId);

  if (targetDeleteResult.error) {
    throw new Error(
      `Failed to remove target-linked audit history during account deletion: ${targetDeleteResult.error.message}`
    );
  }

  await deleteAuditRowsByColumn(supabase, {
    column: "listing_id",
    values: input.listingIds,
  });

  await deleteAuditRowsByColumn(supabase, {
    column: "conversation_id",
    values: input.conversationIds,
  });

  await deleteAuditRowsByColumn(supabase, {
    column: "report_id",
    values: input.reportIds,
  });
}

export async function hardDeleteAccount(input: { userId: string }) {
  const adminSupabase = createAdminSupabaseClient();
  const listingIds = await loadOwnedListingIds(adminSupabase, input.userId);
  const [conversationIds, reportIds] = await Promise.all([
    loadConversationIds(adminSupabase, input.userId),
    loadReportIds(adminSupabase, {
      userId: input.userId,
      listingIds,
    }),
  ]);

  const [listingImagePathsFromRows, listingImagePathsFromStorage, profileAvatarPaths] =
    await Promise.all([
      loadListingImagePaths(adminSupabase, listingIds),
      loadListingImagePathsFromStorage(adminSupabase, {
        userId: input.userId,
        listingIds,
      }),
      loadProfileAvatarPaths(adminSupabase, {
        userId: input.userId,
      }),
    ]);

  await removeBucketPaths(adminSupabase, {
    bucket: LISTING_IMAGES_BUCKET,
    paths: [...listingImagePathsFromRows, ...listingImagePathsFromStorage],
  });

  await removeBucketPaths(adminSupabase, {
    bucket: PROFILE_AVATARS_BUCKET,
    paths: profileAvatarPaths,
    optionalBucket: true,
  });

  await deleteLinkedAuditRows(adminSupabase, {
    userId: input.userId,
    listingIds,
    conversationIds,
    reportIds,
  });

  const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(input.userId);
  if (deleteUserError) {
    throw new Error(`Failed to permanently delete account: ${deleteUserError.message}`);
  }
}
