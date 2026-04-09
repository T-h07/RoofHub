"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isProviderRole } from "@/lib/auth/roles";
import {
  LISTING_IMAGE_MAX_COUNT,
  normalizeCoverAndOrder,
  parseListingImageObjectPath,
} from "@/lib/storage/listing-images";
import {
  createListingImageSignedUrl,
  syncRemovedListingImages,
  toListingImageInsertRows,
} from "@/lib/supabase/storage/listing-images";

import { buildWizardValuesFromDraft } from "./mapping";
import { loadProviderDraftForEditor } from "./queries";
import { evaluateProviderPublishReadiness, type ProviderPublishBlocker } from "./publish";
import { canTransitionProviderListingStatus } from "./status-transitions";
import type { ProviderDraftImage, ProviderListingStatus } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

    if (uniquePathSet.has(normalizedPath)) {
      return {
        ok: false as const,
        message: "Duplicate photo storage paths were submitted.",
      };
    }

    uniquePathSet.add(normalizedPath);

    const parsedPath = parseListingImageObjectPath(normalizedPath);
    if (!parsedPath) {
      return {
        ok: false as const,
        message: "Photo payload contained an invalid storage path.",
      };
    }

    if (
      parsedPath.ownerId !== input.listingOwnerId.toLowerCase() ||
      parsedPath.listingId !== input.listingId.toLowerCase()
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

export async function syncProviderListingPhotosAction(
  input: SyncProviderListingPhotosInput
): Promise<SyncProviderListingPhotosResult> {
  const context = await ensureProviderMutationContext();

  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
      images: [],
    };
  }

  if (!isUuid(input.draftId)) {
    return {
      ok: false,
      message: "Draft listing id is invalid.",
      images: [],
    };
  }

  const { supabase, profile } = context;
  const draftAccess = await ensureDraftAccess(supabase, {
    draftId: input.draftId,
    userId: profile.id,
  });

  if (!draftAccess.ok || !draftAccess.listing) {
    return {
      ok: false,
      message: draftAccess.ok ? "Draft listing could not be resolved." : draftAccess.message,
      images: [],
    };
  }

  const normalizedImages = normalizeCoverAndOrder(input.images);
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
      .select("storage_path")
      .eq("listing_id", draftAccess.listing.id);

    if (existingError) {
      return {
        ok: false,
        message: normalizeSupabaseError(existingError.message),
        images: [],
      };
    }

    const existingPathSet = new Set((existingRows ?? []).map((row) => row.storage_path));
    const desiredPathSet = new Set(normalizedImages.map((image) => image.storagePath));
    const pathsToRemove = [...existingPathSet].filter((path) => !desiredPathSet.has(path));

    if (pathsToRemove.length > 0) {
      await syncRemovedListingImages(supabase, {
        listingId: draftAccess.listing.id,
        storagePaths: pathsToRemove,
      });
    }

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
        return {
          ok: false,
          message: normalizeSupabaseError(insertError.message),
          images: [],
        };
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
      message: "Listing photos saved.",
      images: refreshedImages.images,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Listing photos could not be saved.";

    return {
      ok: false,
      message,
      images: [],
    };
  }
}

export async function publishProviderListingDraftAction(
  input: PublishProviderListingDraftInput
): Promise<PublishProviderListingDraftResult> {
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
