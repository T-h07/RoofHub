import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isPreferredContactMethod } from "@/lib/auth/roles";
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
  organization_id,
  created_by_user_id,
  assigned_agent_user_id,
  published_by_user_id,
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
  organization_id,
  created_by_user_id,
  assigned_agent_user_id,
  published_by_user_id,
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

const PROVIDER_CONTACT_SELECT =
  "preferred_contact_method, contact_methods, phone, contact_email, whatsapp_phone, viber_phone";
const PROVIDER_CONTACT_COMPAT_SELECT = "preferred_contact_method, contact_methods, phone";
const PROVIDER_CONTACT_LEGACY_SELECT = "preferred_contact_method, phone";

function isMissingContactMethodsColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("contact_methods") &&
    (normalized.includes("does not exist") || normalized.includes("column"))
  );
}

function isMissingContactChannelColumnError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_email") ||
      normalized.includes("whatsapp_phone") ||
      normalized.includes("viber_phone"))
  );
}

export async function loadProviderDraftSummaries(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  const query = supabase
    .from("listings")
    .select(PROVIDER_DRAFT_SUMMARY_SELECT)
    .eq("owner_id", userId)
    .order("updated_at", { ascending: false })
    .limit(24);

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
  draftId: string
) {
  const query = supabase
    .from("listings")
    .select(PROVIDER_DRAFT_EDITOR_SELECT)
    .eq("id", draftId)
    .eq("owner_id", userId)
    .limit(1);

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

  let resolvedData:
    | {
        preferred_contact_method: Database["public"]["Enums"]["preferred_contact_method"] | null;
        contact_methods?: unknown[];
        phone: string | null;
        contact_email?: string | null;
        whatsapp_phone?: string | null;
        viber_phone?: string | null;
      }
    | null = data as
    | {
        preferred_contact_method: Database["public"]["Enums"]["preferred_contact_method"] | null;
        contact_methods?: unknown[];
        phone: string | null;
        contact_email?: string | null;
        whatsapp_phone?: string | null;
        viber_phone?: string | null;
      }
    | null;
  let resolvedError = error;

  if (resolvedError && isMissingContactChannelColumnError(resolvedError.message)) {
    const { data: compatData, error: compatError } = await supabase
      .from("profiles")
      .select(PROVIDER_CONTACT_COMPAT_SELECT)
      .eq("id", userId)
      .maybeSingle();

    resolvedData = compatData
      ? {
          ...compatData,
          contact_email: null,
          whatsapp_phone: null,
          viber_phone: null,
        }
      : null;
    resolvedError = compatError;
  }

  if (resolvedError && isMissingContactMethodsColumnError(resolvedError.message)) {
    const { data: legacyData, error: legacyError } = await supabase
      .from("profiles")
      .select(PROVIDER_CONTACT_LEGACY_SELECT)
      .eq("id", userId)
      .maybeSingle();
    resolvedData = legacyData
      ? {
          ...legacyData,
          contact_methods: [],
        }
      : null;
    resolvedError = legacyError;
  }

  if (resolvedError || !resolvedData) {
    return {
      ok: false as const,
      message: "Contact settings could not be loaded.",
      settings: {
        preferredContactMethod: "",
        contactMethods: ["in_app"],
        contactEmail: "",
        phone: "",
        whatsappPhone: "",
        viberPhone: "",
      } satisfies ProviderContactSettings,
    };
  }

  const normalizedMethods = Array.from(
    new Set(
      (resolvedData.contact_methods ?? []).filter((method): method is ProviderContactSettings["contactMethods"][number] =>
        isPreferredContactMethod(method)
      )
    )
  );
  const fallbackMethods: ProviderContactSettings["contactMethods"] =
    normalizedMethods.length > 0
      ? normalizedMethods
      : resolvedData.preferred_contact_method
        ? [resolvedData.preferred_contact_method]
        : ["in_app"];
  const preferredContactMethod = resolvedData.preferred_contact_method ?? "";

  return {
    ok: true as const,
    settings: {
      preferredContactMethod,
      contactMethods: fallbackMethods,
      contactEmail: resolvedData.contact_email ?? "",
      phone: resolvedData.phone ?? "",
      whatsappPhone: resolvedData.whatsapp_phone ?? "",
      viberPhone: resolvedData.viber_phone ?? "",
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
