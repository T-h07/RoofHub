import "server-only";

import { isPreferredContactMethod, type PreferredContactMethod } from "@/lib/auth/roles";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Tables } from "@/types/database";

type PublicListingDetailRow = Pick<
  Tables<"listings">,
  | "id"
  | "owner_id"
  | "slug"
  | "title"
  | "description"
  | "listing_type"
  | "property_type"
  | "listing_status"
  | "price_amount"
  | "currency_code"
  | "deposit_amount"
  | "city"
  | "neighborhood"
  | "address_text"
  | "area_m2"
  | "bedrooms"
  | "bathrooms"
  | "floor_number"
  | "total_floors"
  | "furnished"
  | "parking"
  | "pets_allowed"
  | "elevator"
  | "balcony"
  | "internet_included"
  | "utilities_included"
  | "heating_type"
  | "available_from"
  | "latitude"
  | "longitude"
  | "public_location_mode"
  | "published_at"
  | "created_at"
> & {
  listing_images:
    | Array<Pick<Tables<"listing_images">, "id" | "storage_path" | "is_cover" | "sort_order">>
    | null;
};

type ProviderPreviewCompatibilityRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url" | "bio" | "phone"
> & {
  preferred_contact_method: unknown;
  contact_methods?: unknown;
  contact_email?: string | null;
  whatsapp_phone?: string | null;
  viber_phone?: string | null;
};

export type PublicListingDetailImage = {
  id: string;
  storagePath: string;
  sortOrder: number;
  isCover: boolean;
  signedUrl: string | null;
};

export type PublicListingDetailProvider = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  preferredContactMethod: PreferredContactMethod | null;
  contactMethods: PreferredContactMethod[];
  phone: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  viberPhone: string | null;
};

export type PublicListingDetail = Omit<
  PublicListingDetailRow,
  "listing_images"
> & {
  latitude: number;
  longitude: number;
  images: PublicListingDetailImage[];
  coverImagePath: string | null;
  coverImageUrl: string | null;
  provider: PublicListingDetailProvider | null;
};

type PublicListingDetailSuccessResult = {
  ok: true;
  listing: PublicListingDetail;
  viewerUserId: string | null;
  isFavorited: boolean;
  isOwner: boolean;
};

type PublicListingDetailNotFoundResult = {
  ok: false;
  reason: "not_found";
};

type PublicListingDetailErrorResult = {
  ok: false;
  reason: "error";
  message: string;
};

export type PublicListingDetailResult =
  | PublicListingDetailSuccessResult
  | PublicListingDetailNotFoundResult
  | PublicListingDetailErrorResult;

const PUBLIC_LISTING_DETAIL_SELECT = `
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
  city,
  neighborhood,
  address_text,
  area_m2,
  bedrooms,
  bathrooms,
  floor_number,
  total_floors,
  furnished,
  parking,
  pets_allowed,
  elevator,
  balcony,
  internet_included,
  utilities_included,
  heating_type,
  available_from,
  latitude,
  longitude,
  public_location_mode,
  published_at,
  created_at,
  listing_images (
    id,
    storage_path,
    is_cover,
    sort_order
  )
`;

const PROVIDER_PREVIEW_SELECT =
  "id, display_name, avatar_url, bio, role, preferred_contact_method, contact_methods, phone, contact_email, whatsapp_phone, viber_phone";
const PROVIDER_PREVIEW_CHANNEL_COMPAT_SELECT =
  "id, display_name, avatar_url, bio, role, preferred_contact_method, contact_methods, phone";
const PROVIDER_PREVIEW_LEGACY_SELECT =
  "id, display_name, avatar_url, bio, role, preferred_contact_method, phone";

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

function parseCoordinate(value: number | string) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeImages(
  images: PublicListingDetailRow["listing_images"]
) {
  if (!images || images.length === 0) {
    return [] as PublicListingDetailImage[];
  }

  return [...images]
    .sort((left, right) => {
      if (left.is_cover === right.is_cover) {
        return left.sort_order - right.sort_order;
      }

      return left.is_cover ? -1 : 1;
    })
    .map((image) => ({
      id: image.id,
      storagePath: image.storage_path,
      sortOrder: image.sort_order,
      isCover: image.is_cover,
      signedUrl: null,
    }));
}

function trimProviderBio(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  return normalized.slice(0, 220);
}

function normalizeOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeProviderContactMethods(
  row: ProviderPreviewCompatibilityRow
) {
  const preferred = isPreferredContactMethod(row.preferred_contact_method)
    ? row.preferred_contact_method
    : null;
  const explicitMethods = Array.isArray(row.contact_methods)
    ? row.contact_methods.filter((method): method is PreferredContactMethod =>
        isPreferredContactMethod(method)
      )
    : [];

  const fallbackMethods: PreferredContactMethod[] =
    explicitMethods.length > 0
      ? explicitMethods
      : preferred
        ? [preferred]
        : ["in_app"];

  return Array.from(new Set<PreferredContactMethod>(fallbackMethods));
}

function normalizeProviderPreview(
  row: ProviderPreviewCompatibilityRow
): PublicListingDetailProvider {
  const contactMethods = normalizeProviderContactMethods(row);
  const preferred = isPreferredContactMethod(row.preferred_contact_method)
    ? row.preferred_contact_method
    : contactMethods[0] ?? null;
  const phone = normalizeOptionalText(row.phone);
  const whatsappPhone =
    normalizeOptionalText(row.whatsapp_phone) ??
    (contactMethods.includes("whatsapp") ? phone : null);
  const viberPhone =
    normalizeOptionalText(row.viber_phone) ??
    (contactMethods.includes("viber") ? phone : null);

  return {
    id: row.id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: trimProviderBio(row.bio),
    preferredContactMethod: preferred,
    contactMethods,
    phone,
    contactEmail: normalizeOptionalText(row.contact_email)?.toLowerCase() ?? null,
    whatsappPhone,
    viberPhone,
  };
}

async function fetchPublicListingProvider(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  providerId: string
) {
  const full = await supabase
    .from("profiles")
    .select(PROVIDER_PREVIEW_SELECT)
    .eq("id", providerId)
    .eq("role", "provider")
    .maybeSingle();

  if (!full.error) {
    return {
      ok: true as const,
      provider: full.data
        ? normalizeProviderPreview(full.data as ProviderPreviewCompatibilityRow)
        : null,
    };
  }

  if (isMissingContactChannelColumnError(full.error.message)) {
    const channelCompatible = await supabase
      .from("profiles")
      .select(PROVIDER_PREVIEW_CHANNEL_COMPAT_SELECT)
      .eq("id", providerId)
      .eq("role", "provider")
      .maybeSingle();

    if (!channelCompatible.error) {
      return {
        ok: true as const,
        provider: channelCompatible.data
          ? normalizeProviderPreview({
              ...(channelCompatible.data as ProviderPreviewCompatibilityRow),
              contact_email: null,
              whatsapp_phone: null,
              viber_phone: null,
            })
          : null,
      };
    }

    if (!isMissingContactMethodsColumnError(channelCompatible.error.message)) {
      return {
        ok: false as const,
      };
    }

    const legacy = await supabase
      .from("profiles")
      .select(PROVIDER_PREVIEW_LEGACY_SELECT)
      .eq("id", providerId)
      .eq("role", "provider")
      .maybeSingle();

    if (legacy.error) {
      return {
        ok: false as const,
      };
    }

    return {
      ok: true as const,
      provider: legacy.data
        ? normalizeProviderPreview({
            ...(legacy.data as ProviderPreviewCompatibilityRow),
            contact_methods: [],
            contact_email: null,
            whatsapp_phone: null,
            viber_phone: null,
          })
        : null,
    };
  }

  if (!isMissingContactMethodsColumnError(full.error.message)) {
    return {
      ok: false as const,
    };
  }

  const legacy = await supabase
    .from("profiles")
    .select(PROVIDER_PREVIEW_LEGACY_SELECT)
    .eq("id", providerId)
    .eq("role", "provider")
    .maybeSingle();

  if (legacy.error) {
    return {
      ok: false as const,
    };
  }

  return {
    ok: true as const,
    provider: legacy.data
      ? normalizeProviderPreview({
          ...(legacy.data as ProviderPreviewCompatibilityRow),
          contact_methods: [],
          contact_email: null,
          whatsapp_phone: null,
          viber_phone: null,
        })
      : null,
  };
}

export async function loadPublicListingDetailBySlug(
  slug: string
): Promise<PublicListingDetailResult> {
  try {
    const normalizedSlug = slug.trim().toLowerCase();
    if (!normalizedSlug) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("listings")
      .select(PUBLIC_LISTING_DETAIL_SELECT)
      .eq("slug", normalizedSlug)
      .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
      .maybeSingle();

    if (error) {
      return {
        ok: false,
        reason: "error",
        message: "Listing details could not be loaded right now. Please try again.",
      };
    }

    if (!data) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    const listingRow = data as PublicListingDetailRow;
    const latitude = parseCoordinate(listingRow.latitude as number | string);
    const longitude = parseCoordinate(listingRow.longitude as number | string);

    if (latitude === null || longitude === null) {
      return {
        ok: false,
        reason: "error",
        message: "Listing location data is unavailable right now.",
      };
    }

    const [providerResult, favoriteResult] = await Promise.all([
      fetchPublicListingProvider(supabase, listingRow.owner_id),
      user
        ? supabase
            .from("favorites")
            .select("listing_id")
            .eq("user_id", user.id)
            .eq("listing_id", listingRow.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const images = normalizeImages(listingRow.listing_images);
    const signedImages = await Promise.all(
      images.map(async (image) => {
        try {
          const signedUrl = await createListingImageSignedUrl(
            supabase,
            image.storagePath,
            30 * 60
          );
          return {
            ...image,
            signedUrl,
          };
        } catch {
          return image;
        }
      })
    );

    const coverImage =
      signedImages.find((image) => image.isCover) ?? signedImages[0] ?? null;
    const provider: PublicListingDetailProvider | null = providerResult.ok
      ? providerResult.provider
      : null;

    const listing: PublicListingDetail = {
      id: listingRow.id,
      owner_id: listingRow.owner_id,
      slug: listingRow.slug,
      title: listingRow.title,
      description: listingRow.description,
      listing_type: listingRow.listing_type,
      property_type: listingRow.property_type,
      listing_status: listingRow.listing_status,
      price_amount: listingRow.price_amount,
      currency_code: listingRow.currency_code,
      deposit_amount: listingRow.deposit_amount,
      city: listingRow.city,
      neighborhood: listingRow.neighborhood,
      address_text: listingRow.address_text,
      area_m2: listingRow.area_m2,
      bedrooms: listingRow.bedrooms,
      bathrooms: listingRow.bathrooms,
      floor_number: listingRow.floor_number,
      total_floors: listingRow.total_floors,
      furnished: listingRow.furnished,
      parking: listingRow.parking,
      pets_allowed: listingRow.pets_allowed,
      elevator: listingRow.elevator,
      balcony: listingRow.balcony,
      internet_included: listingRow.internet_included,
      utilities_included: listingRow.utilities_included,
      heating_type: listingRow.heating_type,
      available_from: listingRow.available_from,
      latitude,
      longitude,
      public_location_mode: listingRow.public_location_mode,
      published_at: listingRow.published_at,
      created_at: listingRow.created_at,
      images: signedImages,
      coverImagePath: coverImage?.storagePath ?? null,
      coverImageUrl: coverImage?.signedUrl ?? null,
      provider,
    };

    const isFavorited =
      user !== null && !favoriteResult.error && Boolean(favoriteResult.data);
    const isOwner = Boolean(user && user.id === listing.owner_id);

    return {
      ok: true,
      listing,
      viewerUserId: user?.id ?? null,
      isFavorited,
      isOwner,
    };
  } catch {
    return {
      ok: false,
      reason: "error",
      message:
        "Listing detail is not configured yet. Set Supabase environment variables and restart the app.",
    };
  }
}
