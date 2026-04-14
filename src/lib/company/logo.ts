import type { SupabaseClient } from "@supabase/supabase-js";

import { COMPANY_LOGOS_BUCKET, parseCompanyLogoObjectPath } from "@/lib/storage/company-logo";
import type { Database } from "@/types/database";

export function isValidCompanyLogoPath(path: string | null | undefined) {
  if (!path) {
    return false;
  }

  return parseCompanyLogoObjectPath(path) !== null;
}

export function toCompanyLogoPublicUrl(
  supabase: SupabaseClient<Database>,
  logoPath: string | null | undefined
) {
  if (!logoPath || !isValidCompanyLogoPath(logoPath)) {
    return null;
  }

  const { data } = supabase.storage.from(COMPANY_LOGOS_BUCKET).getPublicUrl(logoPath);
  return data.publicUrl;
}
