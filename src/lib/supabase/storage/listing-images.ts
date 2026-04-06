import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  LISTING_IMAGES_BUCKET,
  buildListingImageInsertRows,
  createListingImageObjectPath,
  isAllowedListingImageMimeType,
  normalizeCoverAndOrder,
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

  if (!isAllowedListingImageMimeType(input.image.file.type)) {
    throw new Error("Unsupported image MIME type.");
  }

  const storagePath = createListingImageObjectPath({
    ownerId: input.ownerId,
    listingId: input.listingId,
    mimeType: input.image.file.type,
  });

  const { error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(storagePath, input.image.file, {
      upsert: false,
      contentType: input.image.file.type,
      cacheControl: "3600",
    });

  if (error) {
    throw new Error(`Upload failed for ${input.image.file.name}: ${error.message}`);
  }

  return {
    localId: input.image.localId,
    storagePath,
    sortOrder: input.image.sortOrder,
    isCover: input.image.isCover,
    mimeType: input.image.file.type,
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
  storagePaths: readonly string[]
): Promise<ListingImageDeleteResult> {
  if (storagePaths.length === 0) {
    return {
      removedPaths: [],
      failedPaths: [],
    };
  }

  const uniquePaths = [...new Set(storagePaths)];
  const { data, error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).remove(uniquePaths);

  if (error) {
    throw new Error(`Failed to remove image objects: ${error.message}`);
  }

  const removedPaths = (data ?? [])
    .map((entry) => entry.name)
    .filter((name): name is string => typeof name === "string");
  const removedPathSet = new Set(removedPaths);
  const failedPaths = uniquePaths.filter((path) => !removedPathSet.has(path));

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
