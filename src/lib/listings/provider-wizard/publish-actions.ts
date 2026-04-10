"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isProviderRole } from "@/lib/auth/roles";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import {
  LISTING_IMAGE_MAX_COUNT,
  LISTING_IMAGE_MAX_PATH_LENGTH,
  isListingImagePathForOwnerAndListing,
  normalizeCoverAndOrder,
} from "@/lib/storage/listing-images";
import {
  createListingImageSignedUrl,
  deleteListingImageObjects,
  toListingImageInsertRows,
} from "@/lib/supabase/storage/listing-images";

import { buildWizardValuesFromDraft } from "./mapping";
import { loadProviderDraftForEditor } from "./queries";
import { evaluateProviderPublishReadiness, type ProviderPublishBlocker } from "./publish";
import { canTransitionProviderListingStatus } from "./status-transitions";
import type { ProviderDraftImage, ProviderListingStatus } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IMAGE_SORT_ORDER = 10_000;
const LISTING_IMAGE_STORAGE_DELETE_WARNING =
  "Some removed photos could not be cleaned up from storage. Retry save to attempt cleanup again.";

type ProviderMutationContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
        ? TResult extends { ok: true; profile: infer TProfile }
          ? TProfile
          : never
        : never;
    }
  | {
      ok: false;
      message: string;
    };

type ProviderDraftAccess = {
  id: string;
  owner_id: string;
  listing_status: ProviderListingStatus;
  slug: string;
};

export type ProviderPhotoMutationImage = {
  storagePath: string;
  sortOrder: number;
  isCover: boolean;
};

export type SyncProviderListingPhotosInput = {
  draftId: string;
  images: ProviderPhotoMutationImage[];
};

export type SyncProviderListingPhotosResult = {
  ok: boolean;
  message: string;
  images: ProviderDraftImage[];
};

export type PublishProviderListingDraftInput = {
  draftId: string;
};

export type PublishProviderListingDraftResult = {
  ok: boolean;
  message: string;
  blockers?: ProviderPublishBlocker[];
  listingSlug?: string;
  nextStatus?: ProviderListingStatus;
};

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function normalizePhotoMutationInput(
  input: SyncProviderListingPhotosInput | unknown
):
  | {
      ok: true;
      draftId: string;
      images: ProviderPhotoMutationImage[];
    }
  | {
      ok: false;
      message: string;
    } {
  if (!isRecord(input) || typeof input.draftId !== "string") {
    return {
      ok: false,
      message: "Draft listing payload is invalid.",
    };
  }

  if (!Array.isArray(input.images)) {
    return {
      ok: false,
      message: "Photo payload is invalid.",
    };
  }

  if (input.images.length > LISTING_IMAGE_MAX_COUNT) {
    return {
      ok: false,
      message: `Only ${LISTING_IMAGE_MAX_COUNT} photos are allowed per listing.`,
    };
  }

  const normalizedImages: ProviderPhotoMutationImage[] = [];

  for (const image of input.images) {
    if (!isRecord(image) || typeof image.storagePath !== "string") {
      return {
        ok: false,
        message: "Photo payload contained an invalid storage path.",
      };
    }

    if (typeof image.sortOrder !== "number" || !Number.isFinite(image.sortOrder)) {
      return {
        ok: false,
        message: "Photo payload contained an invalid sort order.",
      };
    }

    if (typeof image.isCover !== "boolean") {
      return {
        ok: false,
        message: "Photo payload contained an invalid cover-flag value.",
      };
    }

    const sortOrder = Math.trunc(image.sortOrder);
    if (sortOrder < 0 || sortOrder > MAX_IMAGE_SORT_ORDER) {
      return {
        ok: false,
        message: "Photo payload contained an out-of-range sort order.",
      };
    }

    normalizedImages.push({
      storagePath: image.storagePath.trim(),
      sortOrder,
      isCover: image.isCover,
    });
  }

  return {
    ok: true,
    draftId: input.draftId,
    images: normalizedImages,
  };
}

function normalizeSupabaseError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to edit this listing draft.";
  }

  if (normalized.includes("check constraint")) {
    return "Some values do not match listing requirements. Review highlighted fields and retry.";
  }

  return "Listing update failed. Please retry.";
}

async function ensureProviderMutationContext(): Promise<ProviderMutationContext> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  if (!isProviderRole(profileResult.profile.role)) {
    return {
      ok: false,
      message: "Switch your profile role to provider before managing listing photos.",
    };
  }

  return {
    ok: true,
    supabase,
    profile: profileResult.profile,
  };
}

async function ensureDraftAccess(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    draftId: string;
    userId: string;
  }
) {
  const query = supabase
    .from("listings")
    .select("id, owner_id, listing_status, slug")
    .eq("id", input.draftId)
    .eq("owner_id", input.userId)
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      message: "Draft listing not found or inaccessible.",
      listing: null as ProviderDraftAccess | null,
    };
  }

  return {
    ok: true as const,
    listing: data as ProviderDraftAccess,
  };
}

async function loadListingImages(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  draftId: string
) {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, storage_path, sort_order, is_cover")
    .eq("listing_id", draftId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    return {
      ok: false as const,
      message: "Listing photos could not be loaded.",
      images: [] as ProviderDraftImage[],
    };
  }

  const rows = data ?? [];
  const images = await Promise.all(
    rows.map(async (row) => {
      try {
        const signedUrl = await createListingImageSignedUrl(supabase, row.storage_path, 30 * 60);
        return {
          id: row.id,
          storagePath: row.storage_path,
          sortOrder: row.sort_order,
          isCover: row.is_cover,
          signedUrl,
        } satisfies ProviderDraftImage;
      } catch {
        return {
          id: row.id,
          storagePath: row.storage_path,
          sortOrder: row.sort_order,
          isCover: row.is_cover,
          signedUrl: null,
        } satisfies ProviderDraftImage;
      }
    })
  );

  return {
    ok: true as const,
    images,
  };
}

function validatePhotoPayload(input: {
  images: ProviderPhotoMutationImage[];
  listingId: string;
  listingOwnerId: string;
}) {
  if (input.images.length > LISTING_IMAGE_MAX_COUNT) {
    return {
      ok: false as const,
      message: `Only ${LISTING_IMAGE_MAX_COUNT} photos are allowed per listing.`,
    };
  }

  const uniquePathSet = new Set<string>();
  for (const image of input.images) {
    const normalizedPath = image.storagePath.trim();
    if (!normalizedPath) {
      return {
        ok: false as const,
        message: "Photo payload contained an empty storage path.",
      };
    }

    if (normalizedPath.length > LISTING_IMAGE_MAX_PATH_LENGTH) {
      return {
        ok: false as const,
        message: "Photo payload contained an invalid storage path length.",
      };
    }

    if (uniquePathSet.has(normalizedPath)) {
      return {
        ok: false as const,
        message: "Duplicate photo storage paths were submitted.",
      };
    }

    uniquePathSet.add(normalizedPath);

    if (
      !isListingImagePathForOwnerAndListing({
        path: normalizedPath,
        ownerId: input.listingOwnerId,
        listingId: input.listingId,
      })
    ) {
      return {
        ok: false as const,
        message: "Photo payload does not belong to the selected draft listing.",
      };
    }
  }

  return {
    ok: true as const,
  };
}

type ListingImageSnapshotRow = {
  storage_path: string;
  sort_order: number;
  is_cover: boolean;
};

async function restoreListingImageRows(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    listingId: string;
    snapshotRows: readonly ListingImageSnapshotRow[];
  }
) {
  const { error: clearError } = await supabase
    .from("listing_images")
    .delete()
    .eq("listing_id", input.listingId);

  if (clearError) {
    return false;
  }

  if (input.snapshotRows.length === 0) {
    return true;
  }

  const restoreRows = toListingImageInsertRows(
    input.listingId,
    input.snapshotRows.map((row) => ({
      storagePath: row.storage_path,
      sortOrder: row.sort_order,
      isCover: row.is_cover,
    }))
  );

  const { error: restoreError } = await supabase.from("listing_images").insert(restoreRows);
  return !restoreError;
}

export async function syncProviderListingPhotosAction(
  input: SyncProviderListingPhotosInput
): Promise<SyncProviderListingPhotosResult> {
  const normalizedInput = normalizePhotoMutationInput(input);
  if (!normalizedInput.ok) {
    return {
      ok: false,
      message: normalizedInput.message,
      images: [],
    };
  }

  const context = await ensureProviderMutationContext();

  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
      images: [],
    };
  }

  if (!isUuid(normalizedInput.draftId)) {
    return {
      ok: false,
      message: "Draft listing id is invalid.",
      images: [],
    };
  }

  const { supabase, profile } = context;
  const draftAccess = await ensureDraftAccess(supabase, {
    draftId: normalizedInput.draftId,
    userId: profile.id,
  });

  if (!draftAccess.ok || !draftAccess.listing) {
    return {
      ok: false,
      message: draftAccess.ok ? "Draft listing could not be resolved." : draftAccess.message,
      images: [],
    };
  }

  const photoSyncTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.providerPhotoSyncPerListing,
    identity: {
      userId: profile.id,
      scope: draftAccess.listing.id,
      includeIp: false,
    },
    throttledMessage: "Photo save limit reached for this listing.",
    unavailableMessage: "Photo save is temporarily unavailable. Please retry shortly.",
  });
  if (!photoSyncTrafficControl.ok) {
    return {
      ok: false,
      message: photoSyncTrafficControl.message,
      images: [],
    };
  }

  const normalizedImages = normalizeCoverAndOrder(normalizedInput.images);
  const payloadValidation = validatePhotoPayload({
    images: normalizedImages,
    listingId: draftAccess.listing.id,
    listingOwnerId: draftAccess.listing.owner_id,
  });

  if (!payloadValidation.ok) {
    return {
      ok: false,
      message: payloadValidation.message,
      images: [],
    };
  }

  if (draftAccess.listing.listing_status === "published") {
    if (normalizedImages.length < 1) {
      return {
        ok: false,
        message: "Active listings must keep at least one photo.",
        images: [],
      };
    }

    if (!normalizedImages.some((image) => image.isCover)) {
      return {
        ok: false,
        message: "Active listings must keep a cover photo.",
        images: [],
      };
    }
  }

  try {
    const { data: existingRows, error: existingError } = await supabase
      .from("listing_images")
      .select("storage_path, sort_order, is_cover")
      .eq("listing_id", draftAccess.listing.id);

    if (existingError) {
      return {
        ok: false,
        message: normalizeSupabaseError(existingError.message),
        images: [],
      };
    }

    const existingSnapshotRows = (existingRows ?? []) as ListingImageSnapshotRow[];
    const existingPathSet = new Set(existingSnapshotRows.map((row) => row.storage_path));
    const desiredPathSet = new Set(normalizedImages.map((image) => image.storagePath));
    const pathsToRemove = [...existingPathSet].filter((path) => !desiredPathSet.has(path));

    const { error: resetError } = await supabase
      .from("listing_images")
      .delete()
      .eq("listing_id", draftAccess.listing.id);

    if (resetError) {
      return {
        ok: false,
        message: normalizeSupabaseError(resetError.message),
        images: [],
      };
    }

    if (normalizedImages.length > 0) {
      const rowsToInsert = toListingImageInsertRows(draftAccess.listing.id, normalizedImages);
      const { error: insertError } = await supabase.from("listing_images").insert(rowsToInsert);

      if (insertError) {
        await restoreListingImageRows(supabase, {
          listingId: draftAccess.listing.id,
          snapshotRows: existingSnapshotRows,
        });

        return {
          ok: false,
          message: normalizeSupabaseError(insertError.message),
          images: [],
        };
      }
    }

    let warningMessage: string | null = null;
    if (pathsToRemove.length > 0) {
      try {
        const deleteResult = await deleteListingImageObjects(supabase, pathsToRemove, {
          ownerId: draftAccess.listing.owner_id,
          listingId: draftAccess.listing.id,
        });

        if (deleteResult.failedPaths.length > 0) {
          warningMessage = LISTING_IMAGE_STORAGE_DELETE_WARNING;
        }
      } catch {
        warningMessage = LISTING_IMAGE_STORAGE_DELETE_WARNING;
      }
    }

    const refreshedImages = await loadListingImages(supabase, draftAccess.listing.id);

    if (!refreshedImages.ok) {
      return {
        ok: false,
        message: refreshedImages.message,
        images: [],
      };
    }

    return {
      ok: true,
      message: warningMessage
        ? `Listing photos saved. ${warningMessage}`
        : "Listing photos saved.",
      images: refreshedImages.images,
    };
  } catch {
    return {
      ok: false,
      message: "Listing photos could not be saved. Please retry.",
      images: [],
    };
  }
}

export async function publishProviderListingDraftAction(
  input: PublishProviderListingDraftInput
): Promise<PublishProviderListingDraftResult> {
  if (!input || typeof input !== "object" || typeof input.draftId !== "string") {
    return {
      ok: false,
      message: "Draft listing payload is invalid.",
    };
  }

  const context = await ensureProviderMutationContext();

  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
    };
  }

  if (!isUuid(input.draftId)) {
    return {
      ok: false,
      message: "Draft listing id is invalid.",
    };
  }

  const { supabase, profile } = context;
  const publishTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.providerPublishPerListing,
    identity: {
      userId: profile.id,
      scope: input.draftId,
      includeIp: false,
    },
    throttledMessage: "Publish attempt limit reached for this listing.",
    unavailableMessage: "Publish action is temporarily unavailable. Please retry shortly.",
  });
  if (!publishTrafficControl.ok) {
    return {
      ok: false,
      message: publishTrafficControl.message,
    };
  }

  const draftResult = await loadProviderDraftForEditor(supabase, profile.id, input.draftId);

  if (!draftResult.ok || !draftResult.draft) {
    return {
      ok: false,
      message: "Draft listing not found or inaccessible.",
    };
  }

  const imagesResult = await loadListingImages(supabase, input.draftId);
  if (!imagesResult.ok) {
    return {
      ok: false,
      message: imagesResult.message,
    };
  }

  const draftValues = buildWizardValuesFromDraft(draftResult.draft, {
    preferredContactMethod: "",
    contactMethods: ["in_app"],
    contactEmail: "",
    phone: "",
    whatsappPhone: "",
    viberPhone: "",
  });

  const hasCoverImage = imagesResult.images.some((image) => image.isCover);
  const publishReadiness = evaluateProviderPublishReadiness({
    values: draftValues,
    imageCount: imagesResult.images.length,
    hasCoverImage,
  });

  if (!publishReadiness.isReady) {
    return {
      ok: false,
      message: "Listing is not publish-ready yet.",
      blockers: publishReadiness.blockers,
    };
  }

  if (
    !canTransitionProviderListingStatus(draftResult.draft.listing_status, "published")
  ) {
    if (draftResult.draft.listing_status === "hidden_by_admin") {
      return {
        ok: false,
        message:
          "This listing is hidden by admin moderation and cannot be republished from provider controls.",
      };
    }

    return {
      ok: false,
      message: `Listing cannot transition from ${draftResult.draft.listing_status} to published.`,
    };
  }

  const updateQuery = supabase
    .from("listings")
    .update({
      listing_status: "published",
      published_at: new Date().toISOString(),
      archived_at: null,
    })
    .eq("id", draftResult.draft.id)
    .eq("owner_id", profile.id)
    .select("slug, listing_status")
    .limit(1);

  const { data, error } = await updateQuery.maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error ? normalizeSupabaseError(error.message) : "Publish action could not be completed.",
    };
  }

  return {
    ok: true,
    message: "Listing published successfully.",
    listingSlug: data.slug,
    nextStatus: data.listing_status,
  };
}
