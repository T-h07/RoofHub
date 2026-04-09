import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Database } from "@/types/database";

import type {
  ProviderContactSettings,
  ProviderDraftEditorRecord,
  ProviderDraftImage,
  ProviderDraftSummary,
} from "./types";

const PROVIDER_DRAFT_SUMMARY_SELECT = `
  id,
  slug,
  title,
  listing_status,
  listing_type,
  property_type,
  city,
  price_amount,
  updated_at,
  created_at
`;

const PROVIDER_DRAFT_EDITOR_SELECT = `
  id,
  owner_id,
  slug,
  title,
  description,
  listing_type,
  property_type,
  listing_status,
  price_amount,
  currency_code,
  deposit_amount,
  area_m2,
  bedrooms,
  bathrooms,
  floor_number,
  total_floors,
  city,
  neighborhood,
  address_text,
  available_from,
  furnished,
  parking,
  pets_allowed,
  elevator,
  balcony,
  internet_included,
  utilities_included,
  heating_type,
  public_location_mode,
  latitude,
  longitude,
  updated_at,
  created_at
`;

const PROVIDER_CONTACT_SELECT = "preferred_contact_method, phone";

export async function loadProviderDraftSummaries(
  supabase: SupabaseClient<Database>,
  userId: string,
  isAdmin = false
) {
  let query = supabase
    .from("listings")
    .select(PROVIDER_DRAFT_SUMMARY_SELECT)
    .order("updated_at", { ascending: false })
    .limit(24);

  if (!isAdmin) {
    query = query.eq("owner_id", userId);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false as const,
      message: "Draft listings could not be loaded right now.",
      drafts: [] as ProviderDraftSummary[],
    };
  }

  return {
    ok: true as const,
    drafts: (data ?? []) as ProviderDraftSummary[],
  };
}

export async function loadProviderDraftForEditor(
  supabase: SupabaseClient<Database>,
  userId: string,
  draftId: string,
  isAdmin = false
) {
  let query = supabase
    .from("listings")
    .select(PROVIDER_DRAFT_EDITOR_SELECT)
    .eq("id", draftId)
    .limit(1);

  if (!isAdmin) {
    query = query.eq("owner_id", userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      message: "Listing not found or inaccessible.",
      draft: null as ProviderDraftEditorRecord | null,
    };
  }

  return {
    ok: true as const,
    draft: data as ProviderDraftEditorRecord,
  };
}

export async function loadProviderContactSettings(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROVIDER_CONTACT_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      message: "Contact settings could not be loaded.",
      settings: {
        preferredContactMethod: "",
        phone: "",
      } satisfies ProviderContactSettings,
    };
  }

  return {
    ok: true as const,
    settings: {
      preferredContactMethod: data.preferred_contact_method ?? "",
      phone: data.phone ?? "",
    } satisfies ProviderContactSettings,
  };
}

export async function loadProviderDraftImages(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  const { data, error } = await supabase
    .from("listing_images")
    .select("id, storage_path, sort_order, is_cover")
    .eq("listing_id", listingId)
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
