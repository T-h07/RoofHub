import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { LISTING_IMAGES_BUCKET } from "@/lib/storage/listing-images";
import { PROFILE_AVATARS_BUCKET } from "@/lib/storage/profile-avatar";
import { createAdminSupabaseClient } from "@/lib/supabase";
import type { Database } from "@/types/database";

const STORAGE_LIST_PAGE_SIZE = 100;
const STORAGE_REMOVE_CHUNK_SIZE = 100;
const IN_FILTER_CHUNK_SIZE = 100;
const ORGANIZATION_ROLE_PRIORITY: Record<
  Database["public"]["Enums"]["organization_member_role"],
  number
> = {
  owner: 0,
  admin: 1,
  manager: 2,
  agent: 3,
};

type ListingReference = {
  id: string;
  owner_id: string;
};

type ActiveOrganizationMember = {
  organization_id: string;
  user_id: string;
  role: Database["public"]["Enums"]["organization_member_role"];
};

type AccountDeletionOrganizationMode = "delete_company" | "transfer_company";

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

function isStorageObjectMissingError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();

  return (
    normalized.includes("object") &&
    normalized.includes("not found")
  ) ||
    normalized.includes("resource was not found") ||
    normalized.includes("no such key");
}

function isInvalidStoragePathError(message: string | null | undefined) {
  const normalized = (message ?? "").toLowerCase();

  return (
    normalized.includes("invalid key") ||
    normalized.includes("invalid path") ||
    normalized.includes("invalid object")
  );
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

    // Fallback to path-by-path removal so one stale key cannot block account deletion.
    for (const storagePath of pathChunk) {
      const { error: singleError } = await supabase.storage.from(input.bucket).remove([storagePath]);
      if (!singleError) {
        continue;
      }

      if (input.optionalBucket && isBucketMissingError(singleError.message)) {
        return;
      }

      if (
        isStorageObjectMissingError(singleError.message) ||
        isInvalidStoragePathError(singleError.message)
      ) {
        console.warn("[Profile][DeleteAccount] storage path cleanup skipped", {
          bucket: input.bucket,
          storage_path: storagePath,
          reason: singleError.message,
        });
        continue;
      }

      throw new Error(`Failed to remove ${input.bucket} objects: ${singleError.message}`);
    }
  }
}

async function loadOwnedListings(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("owner_id", userId);
  if (error) {
    throw new Error(`Failed to load owned listings for account deletion: ${error.message}`);
  }

  return (data ?? []) as ListingReference[];
}

async function loadCreatedOrganizationIds(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("created_by_user_id", userId);

  if (error) {
    throw new Error(
      `Failed to load creator-linked organizations for account deletion: ${error.message}`
    );
  }

  return (data ?? []).map((row) => row.id);
}

async function loadActiveOwnerOrganizationIds(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("member_status", "active");

  if (error) {
    throw new Error(
      `Failed to load owner-linked organizations for account deletion: ${error.message}`
    );
  }

  return (data ?? [])
    .map((row) => row.organization_id)
    .filter((organizationId): organizationId is string => typeof organizationId === "string");
}

async function loadActiveOrganizationMembers(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
  }
) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, user_id, role")
    .eq("organization_id", input.organizationId)
    .eq("member_status", "active");

  if (error) {
    throw new Error(
      `Failed to resolve active organization members during account deletion: ${error.message}`
    );
  }

  return (data ?? []).filter(
    (row): row is ActiveOrganizationMember => Boolean(row.organization_id && row.user_id && row.role)
  );
}

function pickOrganizationSuccessorMember(input: {
  members: readonly ActiveOrganizationMember[];
  userId: string;
}): ActiveOrganizationMember | null {
  const candidateMembers = input.members
    .filter((member) => member.user_id !== input.userId)
    .sort(
      (left, right) =>
        ORGANIZATION_ROLE_PRIORITY[left.role] - ORGANIZATION_ROLE_PRIORITY[right.role]
    );

  return candidateMembers.at(0) ?? null;
}

async function promoteOrganizationMemberToOwner(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    memberUserId: string;
  }
) {
  const { error } = await supabase
    .from("organization_members")
    .update({
      role: "owner",
    })
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.memberUserId)
    .eq("member_status", "active");

  if (error) {
    throw new Error(
      `Failed to promote organization owner successor during account deletion: ${error.message}`
    );
  }
}

async function transferOrganizationCreator(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    previousCreatorUserId: string;
    nextCreatorUserId: string;
  }
) {
  const { error } = await supabase
    .from("organizations")
    .update({
      created_by_user_id: input.nextCreatorUserId,
    })
    .eq("id", input.organizationId)
    .eq("created_by_user_id", input.previousCreatorUserId);

  if (error) {
    throw new Error(
      `Failed to transfer organization creator before account deletion: ${error.message}`
    );
  }
}

async function loadDistinctOrganizationMemberUserIds(
  supabase: SupabaseClient<Database>,
  organizationIds: readonly string[]
) {
  if (organizationIds.length === 0) {
    return [] as string[];
  }

  const userIdSet = new Set<string>();
  for (const organizationIdChunk of chunkArray(organizationIds, IN_FILTER_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("organization_members")
      .select("user_id")
      .in("organization_id", organizationIdChunk);

    if (error) {
      throw new Error(
        `Failed to load organization members during account deletion: ${error.message}`
      );
    }

    for (const row of data ?? []) {
      if (row.user_id) {
        userIdSet.add(row.user_id);
      }
    }
  }

  return Array.from(userIdSet);
}

async function loadUsersWithRemainingActiveCompanyMemberships(
  supabase: SupabaseClient<Database>,
  input: {
    userIds: readonly string[];
    excludedOrganizationIds: readonly string[];
  }
) {
  if (input.userIds.length === 0) {
    return new Set<string>();
  }

  const excludedOrganizationIdSet = new Set(input.excludedOrganizationIds);
  const memberUserIds = new Set<string>();
  for (const userIdChunk of chunkArray(input.userIds, IN_FILTER_CHUNK_SIZE)) {
    const query = supabase
      .from("organization_members")
      .select("user_id, organization_id")
      .in("user_id", userIdChunk)
      .eq("member_status", "active");

    const { data, error } = await query;
    if (error) {
      throw new Error(
        `Failed to inspect remaining active organization memberships during account deletion: ${error.message}`
      );
    }

    for (const row of data ?? []) {
      if (
        row.user_id &&
        row.organization_id &&
        !excludedOrganizationIdSet.has(row.organization_id)
      ) {
        memberUserIds.add(row.user_id);
      }
    }
  }

  return memberUserIds;
}

async function normalizeRemovedOrganizationMemberProfiles(
  supabase: SupabaseClient<Database>,
  organizationIds: readonly string[]
) {
  if (organizationIds.length === 0) {
    return;
  }

  const memberUserIds = await loadDistinctOrganizationMemberUserIds(supabase, organizationIds);
  if (memberUserIds.length === 0) {
    return;
  }

  for (const userIdChunk of chunkArray(memberUserIds, IN_FILTER_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("profiles")
      .update({
        active_organization_id: null,
      })
      .in("id", userIdChunk)
      .in("active_organization_id", organizationIds);

    if (error) {
      throw new Error(
        `Failed to clear active company workspace from removed members during account deletion: ${error.message}`
      );
    }
  }

  const usersWithRemainingMemberships = await loadUsersWithRemainingActiveCompanyMemberships(supabase, {
    userIds: memberUserIds,
    excludedOrganizationIds: organizationIds,
  });

  const usersToDowngrade = memberUserIds.filter((userId) => !usersWithRemainingMemberships.has(userId));
  if (usersToDowngrade.length === 0) {
    return;
  }

  for (const userIdChunk of chunkArray(usersToDowngrade, IN_FILTER_CHUNK_SIZE)) {
    const { error } = await supabase
      .from("profiles")
      .update({
        provider_account_type: "individual",
      })
      .eq("role", "provider")
      .in("id", userIdChunk);

    if (error) {
      throw new Error(
        `Failed to downgrade removed company members to individual providers during account deletion: ${error.message}`
      );
    }
  }
}

function parseOrganizationMode(value: string | null | undefined): AccountDeletionOrganizationMode | null {
  if (value === "delete_company" || value === "transfer_company") {
    return value;
  }

  return null;
}

async function resolveOrganizationDeletePlan(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    organizationMode: AccountDeletionOrganizationMode | null;
    transferTargetUserId: string | null;
  }
) {
  const createdOrganizationIds = await loadCreatedOrganizationIds(supabase, input.userId);
  const ownerOrganizationIds = await loadActiveOwnerOrganizationIds(supabase, input.userId);
  const createdOrganizationSet = new Set(createdOrganizationIds);
  const organizationIdsToDelete: string[] = [];

  if (ownerOrganizationIds.length > 0 && !input.organizationMode) {
    throw new Error(
      "Choose whether to transfer company ownership or delete the company profile before deleting your account."
    );
  }

  const allScopedOrganizationIds = Array.from(
    new Set<string>([...createdOrganizationIds, ...ownerOrganizationIds])
  );

  for (const organizationId of allScopedOrganizationIds) {
    const activeMembers = await loadActiveOrganizationMembers(supabase, { organizationId });
    const isOwnedByUser = ownerOrganizationIds.includes(organizationId);

    if (isOwnedByUser && input.organizationMode === "delete_company") {
      organizationIdsToDelete.push(organizationId);
      continue;
    }

    let successor = pickOrganizationSuccessorMember({
      members: activeMembers,
      userId: input.userId,
    });

    if (isOwnedByUser && input.organizationMode === "transfer_company") {
      if (!input.transferTargetUserId) {
        throw new Error("Select a team member who will receive company ownership before continuing.");
      }

      successor =
        activeMembers.find(
          (member) => member.user_id === input.transferTargetUserId && member.user_id !== input.userId
        ) ?? null;
      if (!successor) {
        throw new Error(
          "Selected ownership transfer member must be an active team member in the company workspace."
        );
      }
    }

    if (!successor) {
      if (createdOrganizationSet.has(organizationId)) {
        organizationIdsToDelete.push(organizationId);
        continue;
      }

      throw new Error(
        "Cannot delete this account while it is the last active owner of a company workspace. Transfer ownership first."
      );
    }

    const hasOtherActiveOwner = activeMembers.some(
      (member) => member.user_id !== input.userId && member.role === "owner"
    );
    if (isOwnedByUser && !hasOtherActiveOwner) {
      await promoteOrganizationMemberToOwner(supabase, {
        organizationId,
        memberUserId: successor.user_id,
      });
    }

    if (createdOrganizationSet.has(organizationId)) {
      await transferOrganizationCreator(supabase, {
        organizationId,
        previousCreatorUserId: input.userId,
        nextCreatorUserId: successor.user_id,
      });
    }
  }

  return {
    organizationIdsToDelete: Array.from(new Set(organizationIdsToDelete)),
    ownerOrganizationIds,
  };
}

async function loadOrganizationListings(
  supabase: SupabaseClient<Database>,
  organizationIds: readonly string[]
) {
  if (organizationIds.length === 0) {
    return [] as ListingReference[];
  }

  const collected: ListingReference[] = [];
  for (const organizationIdChunk of chunkArray(organizationIds, IN_FILTER_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("listings")
      .select("id, owner_id")
      .in("organization_id", organizationIdChunk);

    if (error) {
      throw new Error(
        `Failed to load organization listings for account deletion: ${error.message}`
      );
    }

    collected.push(...((data ?? []) as ListingReference[]));
  }

  return collected;
}

async function reassignCrossOwnerListingCreators(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("created_by_user_id", userId)
    .neq("owner_id", userId);

  if (error) {
    throw new Error(
      `Failed to load cross-owner listings for account deletion: ${error.message}`
    );
  }

  for (const listing of (data ?? []) as ListingReference[]) {
    const { error: updateError } = await supabase
      .from("listings")
      .update({
        created_by_user_id: listing.owner_id,
      })
      .eq("id", listing.id)
      .eq("created_by_user_id", userId);

    if (updateError) {
      throw new Error(
        `Failed to detach listing creator reference during account deletion: ${updateError.message}`
      );
    }
  }
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
  listings: readonly ListingReference[]
) {
  const pathSet = new Set<string>();

  for (const listing of listings) {
    const prefix = `owner/${listing.owner_id}/listing/${listing.id}`;
    const listedPaths = await listBucketPathsByPrefix(supabase, {
      bucket: LISTING_IMAGES_BUCKET,
      prefix,
      optionalBucket: true,
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

async function deleteListingsForOrganizations(
  supabase: SupabaseClient<Database>,
  organizationIds: readonly string[]
) {
  if (organizationIds.length === 0) {
    return;
  }

  for (const organizationIdChunk of chunkArray(organizationIds, IN_FILTER_CHUNK_SIZE)) {
    const { error } = await supabase.from("listings").delete().in("organization_id", organizationIdChunk);
    if (error) {
      throw new Error(
        `Failed to remove organization listings during account deletion: ${error.message}`
      );
    }
  }
}

async function deleteOrganizationsById(
  supabase: SupabaseClient<Database>,
  organizationIds: readonly string[]
) {
  if (organizationIds.length === 0) {
    return;
  }

  for (const organizationIdChunk of chunkArray(organizationIds, IN_FILTER_CHUNK_SIZE)) {
    const { error } = await supabase.from("organizations").delete().in("id", organizationIdChunk);
    if (error) {
      throw new Error(`Failed to remove organizations during account deletion: ${error.message}`);
    }
  }
}

function mergeUniqueListings(...collections: readonly ListingReference[][]) {
  const listingMap = new Map<string, ListingReference>();

  for (const collection of collections) {
    for (const listing of collection) {
      if (!listing?.id || !listing?.owner_id) {
        continue;
      }

      listingMap.set(listing.id, listing);
    }
  }

  return Array.from(listingMap.values());
}

export async function hardDeleteAccount(input: {
  userId: string;
  organizationMode?: string | null;
  transferTargetUserId?: string | null;
}) {
  const adminSupabase = createAdminSupabaseClient();
  await reassignCrossOwnerListingCreators(adminSupabase, input.userId);
  const resolvedOrganizationMode = parseOrganizationMode(input.organizationMode ?? null);
  const { organizationIdsToDelete } = await resolveOrganizationDeletePlan(adminSupabase, {
    userId: input.userId,
    organizationMode: resolvedOrganizationMode,
    transferTargetUserId: input.transferTargetUserId ?? null,
  });

  const [ownedListings, organizationListingsToDelete] = await Promise.all([
    loadOwnedListings(adminSupabase, input.userId),
    loadOrganizationListings(adminSupabase, organizationIdsToDelete),
  ]);

  const listingsToDelete = mergeUniqueListings(ownedListings, organizationListingsToDelete);
  const listingIds = listingsToDelete.map((listing) => listing.id);
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
      loadListingImagePathsFromStorage(adminSupabase, listingsToDelete),
      loadProfileAvatarPaths(adminSupabase, {
        userId: input.userId,
      }),
    ]);

  try {
    await removeBucketPaths(adminSupabase, {
      bucket: LISTING_IMAGES_BUCKET,
      paths: [...listingImagePathsFromRows, ...listingImagePathsFromStorage],
      optionalBucket: true,
    });
  } catch (error) {
    console.warn("[Profile][DeleteAccount] listing image cleanup skipped", {
      user_id: input.userId,
      reason: error instanceof Error ? error.message : "unknown_storage_cleanup_error",
    });
  }

  try {
    await removeBucketPaths(adminSupabase, {
      bucket: PROFILE_AVATARS_BUCKET,
      paths: profileAvatarPaths,
      optionalBucket: true,
    });
  } catch (error) {
    console.warn("[Profile][DeleteAccount] profile avatar cleanup skipped", {
      user_id: input.userId,
      reason: error instanceof Error ? error.message : "unknown_storage_cleanup_error",
    });
  }

  await deleteLinkedAuditRows(adminSupabase, {
    userId: input.userId,
    listingIds,
    conversationIds,
    reportIds,
  });

  await normalizeRemovedOrganizationMemberProfiles(adminSupabase, organizationIdsToDelete);
  await deleteListingsForOrganizations(adminSupabase, organizationIdsToDelete);
  await deleteOrganizationsById(adminSupabase, organizationIdsToDelete);

  const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(input.userId);
  if (deleteUserError) {
    throw new Error(
      `Failed to permanently delete account: ${deleteUserError.code ?? "unknown"} ${deleteUserError.message}`
    );
  }
}
