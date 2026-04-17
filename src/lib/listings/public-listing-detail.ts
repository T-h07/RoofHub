import "server-only";

import { isPreferredContactMethod, type PreferredContactMethod } from "@/lib/auth/roles";
import { loadFavoriteListingIdsForUser } from "@/lib/listings/favorites";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";
import { createServerSupabaseClient } from "@/lib/supabase";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Tables } from "@/types/database";
import {
  normalizePublicListingAssignedAgent,
  normalizePublicListingCompanyAttribution,
  PUBLIC_LISTING_ASSIGNED_AGENT_RELATION_SELECT,
  PUBLIC_LISTING_COMPANY_RELATION_SELECT,
  type PublicListingAssignedAgentAttribution,
  type PublicListingAssignedAgentRow,
  type PublicListingCompanyAttribution,
  type PublicListingCompanyRow,
} from "./public-company-attribution";

type PublicListingDetailRow = Pick<
  Tables<"listings">,
  | "id"
  | "owner_id"
  | "organization_id"
  | "assigned_agent_user_id"
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
  organization: PublicListingCompanyRow | null;
  assignedAgentProfile: PublicListingAssignedAgentRow | null;
};

type PublicMoreFromCompanyRow = Pick<
  Tables<"listings">,
  | "id"
  | "slug"
  | "title"
  | "listing_type"
  | "property_type"
  | "price_amount"
  | "currency_code"
  | "city"
  | "neighborhood"
  | "bedrooms"
  | "bathrooms"
  | "area_m2"
  | "published_at"
  | "created_at"
> & {
  listing_images:
    | Array<Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">>
    | null;
};

type ProviderPreviewCompatibilityRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url" | "bio" | "phone" | "created_at"
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
  joinedAt: string | null;
  publishedListingCount: number | null;
  emailVerified: boolean | null;
  preferredContactMethod: PreferredContactMethod | null;
  contactMethods: PreferredContactMethod[];
  phone: string | null;
  contactEmail: string | null;
  whatsappPhone: string | null;
  viberPhone: string | null;
};

export type PublicListingDetailCompany = PublicListingCompanyAttribution & {
  publishedListingCount: number | null;
};

export type PublicListingDetailAssignedAgent = PublicListingAssignedAgentAttribution;

export type PublicListingDetailMoreFromCompanyListing = {
  id: string;
  slug: string;
  title: string;
  listing_type: Tables<"listings">["listing_type"];
  property_type: Tables<"listings">["property_type"];
  price_amount: number;
  currency_code: string;
  city: string;
  neighborhood: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  area_m2: number;
  published_at: string | null;
  created_at: string;
  coverImagePath: string | null;
  coverImageUrl: string | null;
  isFavorited: boolean;
  company: PublicListingCompanyAttribution;
};

export type PublicListingDetail = Omit<
  PublicListingDetailRow,
  "listing_images" | "organization" | "assignedAgentProfile"
> & {
  latitude: number;
  longitude: number;
  images: PublicListingDetailImage[];
  coverImagePath: string | null;
  coverImageUrl: string | null;
  provider: PublicListingDetailProvider | null;
  company: PublicListingDetailCompany | null;
  assignedAgent: PublicListingDetailAssignedAgent | null;
  moreFromCompany: PublicListingDetailMoreFromCompanyListing[];
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
  organization_id,
  assigned_agent_user_id,
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
  ),
  ${PUBLIC_LISTING_COMPANY_RELATION_SELECT},
  ${PUBLIC_LISTING_ASSIGNED_AGENT_RELATION_SELECT}
`;

const MORE_FROM_COMPANY_SELECT = `
  id,
  slug,
  title,
  listing_type,
  property_type,
  price_amount,
  currency_code,
  city,
  neighborhood,
  bedrooms,
  bathrooms,
  area_m2,
  published_at,
  created_at,
  listing_images (
    storage_path,
    is_cover,
    sort_order
  )
`;

const PROVIDER_PREVIEW_SELECT =
  "id, display_name, avatar_url, bio, created_at, preferred_contact_method, contact_methods, phone, contact_email, whatsapp_phone, viber_phone";
const PROVIDER_PREVIEW_CHANNEL_COMPAT_SELECT =
  "id, display_name, avatar_url, bio, created_at, preferred_contact_method, contact_methods, phone";
const PROVIDER_PREVIEW_LEGACY_SELECT =
  "id, display_name, avatar_url, bio, created_at, preferred_contact_method, phone";
const LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LISTING_SLUG_MAX_LENGTH = 120;
const STRICT_COORDINATE_PATTERN = /^-?\d+(?:\.\d+)?$/;
const MAX_COORDINATE_TOKEN_LENGTH = 32;

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

  const normalized = value.trim();
  if (
    normalized.length > MAX_COORDINATE_TOKEN_LENGTH ||
    !STRICT_COORDINATE_PATTERN.test(normalized)
  ) {
    return null;
  }

  const parsed = Number.parseFloat(normalized);
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

function getCoverImagePath(
  images: PublicMoreFromCompanyRow["listing_images"]
) {
  if (!images || images.length === 0) {
    return null;
  }

  const sortedImages = [...images].sort((left, right) => {
    if (left.is_cover === right.is_cover) {
      return left.sort_order - right.sort_order;
    }

    return left.is_cover ? -1 : 1;
  });

  return sortedImages[0]?.storage_path ?? null;
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
  row: ProviderPreviewCompatibilityRow,
  trustSignals: {
    publishedListingCount: number | null;
    emailVerified: boolean | null;
  }
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
    joinedAt: row.created_at ?? null,
    publishedListingCount: trustSignals.publishedListingCount,
    emailVerified: trustSignals.emailVerified,
    preferredContactMethod: preferred,
    contactMethods,
    phone,
    contactEmail: normalizeOptionalText(row.contact_email)?.toLowerCase() ?? null,
    whatsappPhone,
    viberPhone,
  };
}

async function fetchProviderPublishedListingCount(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  providerId: string
) {
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", providerId)
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS);

  if (error) {
    return null;
  }

  return count ?? 0;
}

async function fetchCompanyPublishedListingCount(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  organizationId: string
) {
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS);

  if (error) {
    return null;
  }

  return count ?? 0;
}

async function fetchMoreFromCompanyListings(input: {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  organizationId: string;
  currentListingId: string;
  viewerUserId: string | null;
  company: PublicListingCompanyAttribution;
}) {
  const { data, error } = await input.supabase
    .from("listings")
    .select(MORE_FROM_COMPANY_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
    .neq("id", input.currentListingId)
    .order("published_at", {
      ascending: false,
      nullsFirst: false,
    })
    .order("created_at", {
      ascending: false,
    })
    .limit(6);

  if (error) {
    return [] as PublicListingDetailMoreFromCompanyListing[];
  }

  const listingRows = (data ?? []) as PublicMoreFromCompanyRow[];
  const favoriteListingIds =
    input.viewerUserId && listingRows.length > 0
      ? await loadFavoriteListingIdsForUser(
          input.supabase,
          input.viewerUserId,
          listingRows.map((listing) => listing.id)
        )
      : new Set<string>();

  const coverImageEntries = await Promise.all(
    listingRows.map(async (listing) => {
      const coverImagePath = getCoverImagePath(listing.listing_images);
      if (!coverImagePath) {
        return [listing.id, null, null] as const;
      }

      try {
        const signedUrl = await createListingImageSignedUrl(
          input.supabase,
          coverImagePath,
          30 * 60
        );
        return [listing.id, coverImagePath, signedUrl] as const;
      } catch {
        return [listing.id, coverImagePath, null] as const;
      }
    })
  );

  const coverImageMap = new Map(
    coverImageEntries.map(([listingId, coverImagePath, signedUrl]) => [
      listingId,
      {
        coverImagePath,
        signedUrl,
      },
    ])
  );

  return listingRows.map((listing) => {
    const coverEntry = coverImageMap.get(listing.id);

    return {
      id: listing.id,
      slug: listing.slug,
      title: listing.title,
      listing_type: listing.listing_type,
      property_type: listing.property_type,
      price_amount: listing.price_amount,
      currency_code: listing.currency_code,
      city: listing.city,
      neighborhood: listing.neighborhood,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_m2: listing.area_m2,
      published_at: listing.published_at,
      created_at: listing.created_at,
      coverImagePath: coverEntry?.coverImagePath ?? null,
      coverImageUrl: coverEntry?.signedUrl ?? null,
      isFavorited: favoriteListingIds.has(listing.id),
      company: input.company,
    };
  });
}

async function fetchPublicListingProvider(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  providerId: string
) {
  const [publishedListingCount] = await Promise.all([
    fetchProviderPublishedListingCount(supabase, providerId),
  ]);
  const trustSignals = {
    publishedListingCount,
    emailVerified: null,
  } as const;

  const full = await supabase
    .from("profiles")
    .select(PROVIDER_PREVIEW_SELECT)
    .eq("id", providerId)
    .maybeSingle();

  if (!full.error) {
    return {
      ok: true as const,
      provider: full.data
        ? normalizeProviderPreview(full.data as ProviderPreviewCompatibilityRow, trustSignals)
        : null,
    };
  }

  if (isMissingContactChannelColumnError(full.error.message)) {
    const channelCompatible = await supabase
      .from("profiles")
      .select(PROVIDER_PREVIEW_CHANNEL_COMPAT_SELECT)
      .eq("id", providerId)
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
            }, trustSignals)
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
          }, trustSignals)
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
        }, trustSignals)
      : null,
  };
}

export async function loadPublicListingDetailBySlug(
  slug: string
): Promise<PublicListingDetailResult> {
  try {
    const normalizedSlug = slug.trim().toLowerCase();
    if (
      !normalizedSlug ||
      normalizedSlug.length > LISTING_SLUG_MAX_LENGTH ||
      !LISTING_SLUG_PATTERN.test(normalizedSlug)
    ) {
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

    const companyAttribution = normalizePublicListingCompanyAttribution(
      supabase,
      listingRow.organization
    );
    const assignedAgent = companyAttribution
      ? normalizePublicListingAssignedAgent(listingRow.assignedAgentProfile)
      : null;

    const [providerResult, favoriteResult, companyPublishedListingCount, moreFromCompany] =
      await Promise.all([
      fetchPublicListingProvider(supabase, listingRow.owner_id),
      user
        ? supabase
            .from("favorites")
            .select("listing_id")
            .eq("user_id", user.id)
            .eq("listing_id", listingRow.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      companyAttribution
        ? fetchCompanyPublishedListingCount(supabase, companyAttribution.id)
        : Promise.resolve<number | null>(null),
      companyAttribution
        ? fetchMoreFromCompanyListings({
            supabase,
            organizationId: companyAttribution.id,
            currentListingId: listingRow.id,
            viewerUserId: user?.id ?? null,
            company: companyAttribution,
          })
        : Promise.resolve([] as PublicListingDetailMoreFromCompanyListing[]),
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
    const company: PublicListingDetailCompany | null = companyAttribution
      ? {
          ...companyAttribution,
          publishedListingCount: companyPublishedListingCount,
        }
      : null;

    const listing: PublicListingDetail = {
      id: listingRow.id,
      owner_id: listingRow.owner_id,
      organization_id: listingRow.organization_id,
      assigned_agent_user_id: listingRow.assigned_agent_user_id,
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
      company,
      assignedAgent,
      moreFromCompany,
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
