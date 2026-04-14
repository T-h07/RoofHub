import { createUuid } from "@/lib/utils/id";
import {
  detectListingImageMimeTypeFromFile,
  isAllowedListingImageMimeType,
  type ListingImageMimeType,
} from "@/lib/storage/listing-images";

export const COMPANY_LOGOS_BUCKET = "company-logos" as const;
export const COMPANY_LOGO_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const COMPANY_LOGO_MAX_PATH_LENGTH = 200;

const COMPANY_LOGO_EXTENSION_BY_MIME: Record<ListingImageMimeType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const UUID_PATTERN_SOURCE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID_PATTERN_SOURCE}$`, "i");
const COMPANY_LOGO_PATH_PATTERN = new RegExp(
  `^organization\\/(${UUID_PATTERN_SOURCE})\\/(${UUID_PATTERN_SOURCE}\\.(?:jpg|jpeg|png|webp))$`,
  "i"
);

export type CompanyLogoValidationIssueCode =
  | "empty-file"
  | "invalid-type"
  | "file-too-large"
  | "invalid-content-signature";

export type CompanyLogoValidationIssue = {
  code: CompanyLogoValidationIssueCode;
  message: string;
};

export type CompanyLogoMimeType = ListingImageMimeType;

function assertUuid(value: string, fieldName: string) {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`Invalid ${fieldName} UUID.`);
  }
}

export function validateCompanyLogoFile(file: File): CompanyLogoValidationIssue[] {
  const issues: CompanyLogoValidationIssue[] = [];

  if (file.size <= 0) {
    issues.push({
      code: "empty-file",
      message: "Selected logo file is empty.",
    });
  }

  if (!isAllowedListingImageMimeType(file.type)) {
    issues.push({
      code: "invalid-type",
      message: "Unsupported logo type. Allowed: JPEG, PNG, WEBP.",
    });
  }

  if (file.size > COMPANY_LOGO_MAX_BYTES) {
    issues.push({
      code: "file-too-large",
      message: `Logo exceeds max size of ${Math.round(COMPANY_LOGO_MAX_BYTES / (1024 * 1024))}MB.`,
    });
  }

  return issues;
}

export async function detectCompanyLogoMimeType(file: File) {
  return detectListingImageMimeTypeFromFile(file);
}

export function createCompanyLogoObjectPath(input: {
  organizationId: string;
  mimeType: CompanyLogoMimeType;
}) {
  assertUuid(input.organizationId, "organizationId");

  const extension = COMPANY_LOGO_EXTENSION_BY_MIME[input.mimeType];
  const fileName = `${createUuid()}.${extension}`;

  return `organization/${input.organizationId}/${fileName}`;
}

export function parseCompanyLogoObjectPath(path: string) {
  if (!path || path.length > COMPANY_LOGO_MAX_PATH_LENGTH || path.includes(" ")) {
    return null;
  }

  const match = COMPANY_LOGO_PATH_PATTERN.exec(path);
  if (!match) {
    return null;
  }

  return {
    organizationId: match[1].toLowerCase(),
    fileName: match[2].toLowerCase(),
  };
}

export function isCompanyLogoPathForOrganization(input: { path: string; organizationId: string }) {
  const parsed = parseCompanyLogoObjectPath(input.path);
  if (!parsed) {
    return false;
  }

  return parsed.organizationId === input.organizationId.toLowerCase();
}

function decodeStoragePathFromUrlPath(pathname: string) {
  const publicMarker = `/storage/v1/object/public/${COMPANY_LOGOS_BUCKET}/`;
  const signedMarker = `/storage/v1/object/sign/${COMPANY_LOGOS_BUCKET}/`;

  if (pathname.includes(publicMarker)) {
    return pathname.split(publicMarker)[1] ?? null;
  }

  if (pathname.includes(signedMarker)) {
    return pathname.split(signedMarker)[1] ?? null;
  }

  return null;
}

export function extractCompanyLogoPathFromUrl(urlValue: string | null | undefined) {
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
    return parseCompanyLogoObjectPath(normalizedPath) ? normalizedPath : null;
  } catch {
    return null;
  }
}

export function getCompanyLogoPublicUrlPath(storagePath: string | null | undefined) {
  if (!storagePath) {
    return null;
  }

  return parseCompanyLogoObjectPath(storagePath) ? storagePath : null;
}
