import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Tables } from "@/types/database";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";

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

type ProviderPreviewRow = Pick<
  Tables<"profiles">,
  "id" | "display_name" | "avatar_url" | "bio" | "preferred_contact_method" | "role"
>;

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
  preferredContactMethod: ProviderPreviewRow["preferred_contact_method"];
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
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, bio, preferred_contact_method, role")
        .eq("id", listingRow.owner_id)
        .eq("role", "provider")
        .maybeSingle(),
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
    const providerRow =
      !providerResult.error && providerResult.data
        ? (providerResult.data as ProviderPreviewRow)
        : null;
    const provider: PublicListingDetailProvider | null = providerRow
      ? {
          id: providerRow.id,
          displayName: providerRow.display_name,
          avatarUrl: providerRow.avatar_url,
          bio: trimProviderBio(providerRow.bio),
          preferredContactMethod: providerRow.preferred_contact_method,
        }
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
