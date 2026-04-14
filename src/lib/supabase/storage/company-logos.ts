import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { isAllowedListingImageMimeType } from "@/lib/storage/listing-images";
import {
  COMPANY_LOGOS_BUCKET,
  createCompanyLogoObjectPath,
  detectCompanyLogoMimeType,
  extractCompanyLogoPathFromUrl,
  isCompanyLogoPathForOrganization,
  validateCompanyLogoFile,
} from "@/lib/storage/company-logo";

export async function uploadCompanyLogo(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    file: File;
  }
) {
  const issues = validateCompanyLogoFile(input.file);
  if (issues.length > 0) {
    throw new Error(issues.map((issue) => issue.message).join(" "));
  }

  const sniffedMimeType = await detectCompanyLogoMimeType(input.file);
  if (!sniffedMimeType) {
    throw new Error("Unsupported logo signature. Allowed: JPEG, PNG, WEBP.");
  }

  if (
    input.file.type &&
    isAllowedListingImageMimeType(input.file.type) &&
    input.file.type !== sniffedMimeType
  ) {
    throw new Error("Company logo MIME type does not match file contents.");
  }

  const storagePath = createCompanyLogoObjectPath({
    organizationId: input.organizationId,
    mimeType: sniffedMimeType,
  });

  const { error: uploadError } = await supabase.storage
    .from(COMPANY_LOGOS_BUCKET)
    .upload(storagePath, input.file, {
      upsert: false,
      contentType: sniffedMimeType,
      cacheControl: "3600",
    });

  if (uploadError) {
    throw new Error(`Company logo upload failed: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(COMPANY_LOGOS_BUCKET).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
  };
}

export async function removeCompanyLogoByPath(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    storagePath: string;
  }
) {
  if (
    !isCompanyLogoPathForOrganization({
      path: input.storagePath,
      organizationId: input.organizationId,
    })
  ) {
    return {
      removed: false,
    };
  }

  const { error, data } = await supabase.storage
    .from(COMPANY_LOGOS_BUCKET)
    .remove([input.storagePath]);

  if (error) {
    throw new Error(`Company logo removal failed: ${error.message}`);
  }

  return {
    removed: Boolean(data?.some((entry) => entry.name === input.storagePath)),
  };
}

export async function removeCompanyLogoByUrl(
  supabase: SupabaseClient<Database>,
  input: {
    organizationId: string;
    logoUrl: string | null | undefined;
  }
) {
  const storagePath = extractCompanyLogoPathFromUrl(input.logoUrl);
  if (!storagePath) {
    return {
      removed: false,
      storagePath: null,
    };
  }

  const result = await removeCompanyLogoByPath(supabase, {
    organizationId: input.organizationId,
    storagePath,
  });

  return {
    removed: result.removed,
    storagePath,
  };
}
