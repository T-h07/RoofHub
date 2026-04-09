import type { TablesInsert } from "@/types/database";
import { createUuid } from "@/lib/utils/id";

export const LISTING_IMAGES_BUCKET = "listing-images" as const;
export const LISTING_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const LISTING_IMAGE_MAX_COUNT = 20;
export const LISTING_IMAGE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type ListingImageMimeType = (typeof LISTING_IMAGE_ALLOWED_MIME_TYPES)[number];

const LISTING_IMAGE_MIME_TO_EXTENSION: Record<ListingImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATH_PATTERN =
  /^owner\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/listing\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/([a-z0-9][a-z0-9._-]*\.(?:jpg|jpeg|png|webp))$/i;

export type ListingImageValidationIssueCode =
  | "empty-file"
  | "invalid-type"
  | "file-too-large"
  | "too-many-files"
  | "duplicate-file";

export type ListingImageValidationIssue = {
  code: ListingImageValidationIssueCode;
  message: string;
  fileName?: string;
};

export type ListingImageUploadDescriptor = {
  localId: string;
  storagePath: string;
  sortOrder: number;
  isCover: boolean;
  mimeType: ListingImageMimeType;
  size: number;
};

export type ListingImageInsertSeed = Pick<
  ListingImageUploadDescriptor,
  "storagePath" | "sortOrder" | "isCover"
>;

export function isAllowedListingImageMimeType(
  mimeType: string
): mimeType is ListingImageMimeType {
  return LISTING_IMAGE_ALLOWED_MIME_TYPES.includes(mimeType as ListingImageMimeType);
}

export function getListingImageExtension(mimeType: string) {
  if (!isAllowedListingImageMimeType(mimeType)) {
    return null;
  }

  return LISTING_IMAGE_MIME_TO_EXTENSION[mimeType];
}

export function validateListingImageFile(file: File): ListingImageValidationIssue[] {
  const issues: ListingImageValidationIssue[] = [];

  if (file.size <= 0) {
    issues.push({
      code: "empty-file",
      message: "Image file is empty.",
      fileName: file.name,
    });
  }

  if (!isAllowedListingImageMimeType(file.type)) {
    issues.push({
      code: "invalid-type",
      message: `Unsupported image type: ${file.type || "unknown"}. Allowed: JPEG, PNG, WEBP.`,
      fileName: file.name,
    });
  }

  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    issues.push({
      code: "file-too-large",
      message: `Image exceeds max size of ${Math.round(LISTING_IMAGE_MAX_BYTES / (1024 * 1024))}MB.`,
      fileName: file.name,
    });
  }

  return issues;
}

export function validateListingImageSelection(
  incomingFiles: readonly File[],
  existingCount = 0
) {
  const issues: ListingImageValidationIssue[] = [];
  const acceptedFiles: File[] = [];
  const seen = new Set<string>();

  for (const file of incomingFiles) {
    const duplicateKey = `${file.name}:${file.size}:${file.lastModified}`;

    if (seen.has(duplicateKey)) {
      issues.push({
        code: "duplicate-file",
        message: "Duplicate file selection ignored.",
        fileName: file.name,
      });
      continue;
    }

    seen.add(duplicateKey);

    const fileIssues = validateListingImageFile(file);
    if (fileIssues.length > 0) {
      issues.push(...fileIssues);
      continue;
    }

    if (existingCount + acceptedFiles.length >= LISTING_IMAGE_MAX_COUNT) {
      issues.push({
        code: "too-many-files",
        message: `Only ${LISTING_IMAGE_MAX_COUNT} images are allowed per listing.`,
        fileName: file.name,
      });
      continue;
    }

    acceptedFiles.push(file);
  }

  return {
    acceptedFiles,
    issues,
  };
}

function assertUuid(value: string, fieldName: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${fieldName} UUID.`);
  }
}

export function createListingImageObjectPath(input: {
  ownerId: string;
  listingId: string;
  mimeType: ListingImageMimeType;
}) {
  assertUuid(input.ownerId, "ownerId");
  assertUuid(input.listingId, "listingId");

  const extension = LISTING_IMAGE_MIME_TO_EXTENSION[input.mimeType];
  const fileName = `${createUuid()}.${extension}`;

  return `owner/${input.ownerId}/listing/${input.listingId}/${fileName}`;
}

export function parseListingImageObjectPath(path: string) {
  const match = PATH_PATTERN.exec(path);

  if (!match) {
    return null;
  }

  return {
    ownerId: match[1].toLowerCase(),
    listingId: match[2].toLowerCase(),
    fileName: match[3].toLowerCase(),
  };
}

export function normalizeCoverAndOrder<T extends { sortOrder: number; isCover: boolean }>(
  images: readonly T[]
) {
  const sorted = [...images]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((image, index) => ({
      ...image,
      sortOrder: index,
    }));

  const selectedCoverIndex = sorted.findIndex((image) => image.isCover);
  const coverIndex = selectedCoverIndex >= 0 ? selectedCoverIndex : 0;

  return sorted.map((image, index) => ({
    ...image,
    isCover: sorted.length > 0 ? index === coverIndex : false,
  }));
}

export function buildListingImageInsertRows(
  listingId: string,
  images: readonly ListingImageInsertSeed[]
): TablesInsert<"listing_images">[] {
  return normalizeCoverAndOrder(images).map((image) => ({
    listing_id: listingId,
    storage_path: image.storagePath,
    public_url: null,
    sort_order: image.sortOrder,
    is_cover: image.isCover,
  }));
}
