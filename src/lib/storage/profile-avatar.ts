import { createUuid } from "@/lib/utils/id";
import {
  detectListingImageMimeTypeFromFile,
  isAllowedListingImageMimeType,
  type ListingImageMimeType,
} from "@/lib/storage/listing-images";

export const PROFILE_AVATARS_BUCKET = "profile-avatars" as const;
export const PROFILE_AVATAR_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const PROFILE_AVATAR_MAX_PATH_LENGTH = 180;

const PROFILE_AVATAR_EXTENSION_BY_MIME: Record<ListingImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_PATTERN_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID_PATTERN_SOURCE}$`, "i");
const PROFILE_AVATAR_PATH_PATTERN = new RegExp(
  `^user\\/(${UUID_PATTERN_SOURCE})\\/(${UUID_PATTERN_SOURCE}\\.(?:jpg|jpeg|png|webp))$`,
  "i"
);

export type ProfileAvatarValidationIssueCode =
  | "empty-file"
  | "invalid-type"
  | "file-too-large"
  | "invalid-content-signature";

export type ProfileAvatarValidationIssue = {
  code: ProfileAvatarValidationIssueCode;
  message: string;
};

export type ProfileAvatarMimeType = ListingImageMimeType;

function assertUuid(value: string, fieldName: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${fieldName} UUID.`);
  }
}

export function validateProfileAvatarFile(file: File): ProfileAvatarValidationIssue[] {
  const issues: ProfileAvatarValidationIssue[] = [];

  if (file.size <= 0) {
    issues.push({
      code: "empty-file",
      message: "Selected profile photo is empty.",
    });
  }

  if (!isAllowedListingImageMimeType(file.type)) {
    issues.push({
      code: "invalid-type",
      message: "Unsupported profile photo type. Allowed: JPEG, PNG, WEBP.",
    });
  }

  if (file.size > PROFILE_AVATAR_MAX_BYTES) {
    issues.push({
      code: "file-too-large",
      message: `Profile photo exceeds max size of ${Math.round(
        PROFILE_AVATAR_MAX_BYTES / (1024 * 1024)
      )}MB.`,
    });
  }

  return issues;
}

export async function detectProfileAvatarMimeType(file: File) {
  return detectListingImageMimeTypeFromFile(file);
}

export function createProfileAvatarObjectPath(input: {
  userId: string;
  mimeType: ProfileAvatarMimeType;
}) {
  assertUuid(input.userId, "userId");

  const extension = PROFILE_AVATAR_EXTENSION_BY_MIME[input.mimeType];
  const fileName = `${createUuid()}.${extension}`;

  return `user/${input.userId}/${fileName}`;
}

export function parseProfileAvatarObjectPath(path: string) {
  if (!path || path.length > PROFILE_AVATAR_MAX_PATH_LENGTH || path.includes(" ")) {
    return null;
  }

  const match = PROFILE_AVATAR_PATH_PATTERN.exec(path);
  if (!match) {
    return null;
  }

  return {
    userId: match[1].toLowerCase(),
    fileName: match[2].toLowerCase(),
  };
}

export function isProfileAvatarPathForUser(input: { path: string; userId: string }) {
  const parsed = parseProfileAvatarObjectPath(input.path);
  if (!parsed) {
    return false;
  }

  return parsed.userId === input.userId.toLowerCase();
}

function decodeStoragePathFromUrlPath(pathname: string) {
  const publicMarker = `/storage/v1/object/public/${PROFILE_AVATARS_BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${PROFILE_AVATARS_BUCKET}/`;

  if (pathname.includes(publicMarker)) {
    return pathname.split(publicMarker)[1] ?? null;
  }

  if (pathname.includes(signedMarker)) {
    return pathname.split(signedMarker)[1] ?? null;
  }

  return null;
}

export function extractProfileAvatarPathFromUrl(urlValue: string | null | undefined) {
  if (!urlValue) {
    return null;
  }

  try {
    const parsedUrl = new URL(urlValue);
    const decodedStoragePath = decodeStoragePathFromUrlPath(parsedUrl.pathname);
    if (!decodedStoragePath) {
      return null;
    }

    const normalizedPath = decodeURIComponent(decodedStoragePath).split("?")[0]?.trim() ?? "";
    return parseProfileAvatarObjectPath(normalizedPath) ? normalizedPath : null;
  } catch {
    return null;
  }
}
