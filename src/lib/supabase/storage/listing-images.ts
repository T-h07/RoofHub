import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  LISTING_IMAGE_MAX_PATH_LENGTH,
  LISTING_IMAGES_BUCKET,
  buildListingImageInsertRows,
  createListingImageObjectPath,
  detectListingImageMimeTypeFromFile,
  isAllowedListingImageMimeType,
  isListingImagePathForOwnerAndListing,
  normalizeCoverAndOrder,
  parseListingImageObjectPath,
  validateListingImageFile,
  type ListingImageInsertSeed,
  type ListingImageUploadDescriptor,
} from "@/lib/storage/listing-images";

export type ListingImageUploadInput = {
  localId: string;
  file: File;
  sortOrder: number;
  isCover: boolean;
};

export type ListingImageUploadResult = ListingImageUploadDescriptor;

export type ListingImageDeleteResult = {
  removedPaths: string[];
  failedPaths: string[];
};

export async function uploadListingImage(
  supabase: SupabaseClient<Database>,
  input: {
    ownerId: string;
    listingId: string;
    image: ListingImageUploadInput;
  }
): Promise<ListingImageUploadResult> {
  const issues = validateListingImageFile(input.image.file);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  const sniffedMimeType = await detectListingImageMimeTypeFromFile(input.image.file);
  if (!sniffedMimeType) {
    throw new Error("Unsupported image file signature. Allowed: JPEG, PNG, WEBP.");
  }

  if (
    input.image.file.type &&
    isAllowedListingImageMimeType(input.image.file.type) &&
    input.image.file.type !== sniffedMimeType
  ) {
    throw new Error("Image MIME type does not match file contents.");
  }

  const storagePath = createListingImageObjectPath({
    ownerId: input.ownerId,
    listingId: input.listingId,
    mimeType: sniffedMimeType,
  });

  const { error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(storagePath, input.image.file, {
      upsert: false,
      contentType: sniffedMimeType,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error("Upload failed. Please retry.");
  }

  return {
    localId: input.image.localId,
    storagePath,
    sortOrder: input.image.sortOrder,
    isCover: input.image.isCover,
    mimeType: sniffedMimeType,
    size: input.image.file.size,
  };
}

export async function uploadListingImages(
  supabase: SupabaseClient<Database>,
  input: {
    ownerId: string;
    listingId: string;
    images: readonly ListingImageUploadInput[];
  }
) {
  const normalizedImages = normalizeCoverAndOrder(input.images);
  const uploaded: ListingImageUploadResult[] = [];

  for (const image of normalizedImages) {
    // Sequential upload keeps ordering deterministic and simplifies failure handling.
    const uploadedImage = await uploadListingImage(supabase, {
      ownerId: input.ownerId,
      listingId: input.listingId,
      image,
    });
    uploaded.push(uploadedImage);
  }

  return uploaded;
}

export async function createListingImageSignedUrl(
  supabase: SupabaseClient<Database>,
  storagePath: string,
  expiresInSeconds = 60 * 60
) {
  const { data, error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(`Failed to create signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

export async function deleteListingImageObjects(
  supabase: SupabaseClient<Database>,
  storagePaths: readonly string[],
  ownerAndListing?: {
    ownerId: string;
    listingId: string;
  }
): Promise<ListingImageDeleteResult> {
  if (storagePaths.length === 0) {
    return {
      removedPaths: [],
      failedPaths: [],
    };
  }

  const uniquePaths = [...new Set(storagePaths)];
  const validatedPaths = uniquePaths.map((path) => path.trim());

  for (const path of validatedPaths) {
    if (!path || path.length > LISTING_IMAGE_MAX_PATH_LENGTH) {
      throw new Error("Invalid listing image path.");
    }

    if (!parseListingImageObjectPath(path)) {
      throw new Error("Listing image path format is invalid.");
    }

    if (
      ownerAndListing &&
      !isListingImagePathForOwnerAndListing({
        path,
        ownerId: ownerAndListing.ownerId,
        listingId: ownerAndListing.listingId,
      })
    ) {
      throw new Error("Listing image path does not match the expected owner/listing.");
    }
  }

  const { data, error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(validatedPaths);

  if (error) {
    throw new Error(`Failed to remove image objects: ${error.message}`);
  }

  const removedPaths = (data ?? [])
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === "string");
  const removedPathSet = new Set(removedPaths);
  const failedPaths = validatedPaths.filter((path) => !removedPathSet.has(path));

  return {
    removedPaths,
    failedPaths,
  };
}

export function toListingImageInsertRows(
  listingId: string,
  uploadedImages: readonly Pick<ListingImageUploadResult, "storagePath" | "sortOrder" | "isCover">[]
) {
  const rows: ListingImageInsertSeed[] = uploadedImages.map((image) => ({
    storagePath: image.storagePath,
    sortOrder: image.sortOrder,
    isCover: image.isCover,
  }));

  return buildListingImageInsertRows(listingId, rows);
}

export async function syncRemovedListingImages(
  supabase: SupabaseClient<Database>,
  input: {
    listingId: string;
    storagePaths: readonly string[];
  }
) {
  const storageResult = await deleteListingImageObjects(supabase, input.storagePaths);

  if (storageResult.removedPaths.length > 0) {
    const { error } = await supabase
      .from("listing_images")
      .delete()
      .eq("listing_id", input.listingId)
      .in("storage_path", storageResult.removedPaths);

    if (error) {
      throw new Error(`Failed to remove listing image records: ${error.message}`);
    }
  }

  return storageResult;
}
