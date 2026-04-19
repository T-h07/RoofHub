import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";
import type { Tables } from "@/types/database";
import { loadFavoriteListingIdsForUser } from "@/lib/listings/favorites";
import type { PublicListingCompanyAttribution } from "@/lib/listings/public-company-attribution";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";
import { toCompanyLogoPublicUrl } from "@/lib/company/logo";

type PublicCompanyProfileRow = Pick<
  Tables<"organizations">,
  | "id"
  | "name"
  | "slug"
  | "description"
  | "logo_path"
  | "contact_email"
  | "contact_phone"
  | "website_url"
  | "coverage_area"
  | "created_at"
  | "updated_at"
  | "status"
>;

type PublicCompanyListingRow = Pick<
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
  listing_images: Array<
    Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">
  > | null;
};

export type PublicCompanyListingPreview = Omit<PublicCompanyListingRow, "listing_images"> & {
  coverImageUrl: string | null;
  coverImagePath: string | null;
  isFavorited: boolean;
  company: PublicListingCompanyAttribution | null;
};

export type PublicCompanyProfile = Omit<
  PublicCompanyProfileRow,
  "logo_path"
> & {
  logoPath: string | null;
  logoUrl: string | null;
};

type PublicCompanyProfileSuccessResult = {
  ok: true;
  company: PublicCompanyProfile;
  listings: PublicCompanyListingPreview[];
  totalListings: number;
  viewerUserId: string | null;
};

type PublicCompanyProfileNotFoundResult = {
  ok: false;
  reason: "not_found";
};

type PublicCompanyProfileErrorResult = {
  ok: false;
  reason: "error";
  message: string;
};

export type PublicCompanyProfileResult =
  | PublicCompanyProfileSuccessResult
  | PublicCompanyProfileNotFoundResult
  | PublicCompanyProfileErrorResult;

const COMPANY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPANY_SLUG_MAX_LENGTH = 80;

const PUBLIC_COMPANY_LISTINGS_SELECT = `
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

function getCoverImagePath(images: PublicCompanyListingRow["listing_images"]) {
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

function normalizePublicCompanyProfile(
  row: PublicCompanyProfileRow,
  logoUrl: string | null
): PublicCompanyProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    contact_email: row.contact_email,
    contact_phone: row.contact_phone,
    website_url: row.website_url,
    coverage_area: row.coverage_area,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    logoPath: row.logo_path,
    logoUrl,
  };
}

function normalizeSlug(value: string) {
  return value.trim().toLowerCase();
}

export async function loadPublicCompanyProfileBySlug(
  slug: string
): Promise<PublicCompanyProfileResult> {
  try {
    const normalizedSlug = normalizeSlug(slug);
    if (
      !normalizedSlug ||
      normalizedSlug.length > COMPANY_SLUG_MAX_LENGTH ||
      !COMPANY_SLUG_PATTERN.test(normalizedSlug)
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

    const { data: companyRow, error: companyError } = await supabase
      .from("organizations")
      .select(
        "id, name, slug, description, logo_path, contact_email, contact_phone, website_url, coverage_area, created_at, updated_at, status"
      )
      .eq("slug", normalizedSlug)
      .eq("status", "active")
      .maybeSingle();

    if (companyError) {
      return {
        ok: false,
        reason: "error",
        message: "Company profile could not be loaded right now.",
      };
    }

    if (!companyRow) {
      return {
        ok: false,
        reason: "not_found",
      };
    }

    const companyProfileRow = companyRow as PublicCompanyProfileRow;
    const {
      data: listingRows,
      error: listingsError,
      count: listingCount,
    } = await supabase
      .from("listings")
      .select(PUBLIC_COMPANY_LISTINGS_SELECT, { count: "exact" })
      .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
      .eq("organization_id", companyProfileRow.id)
      .order("published_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("created_at", {
        ascending: false,
      })
      .limit(24);

    if (listingsError) {
      return {
        ok: false,
        reason: "error",
        message: "Company listings could not be loaded right now.",
      };
    }

    const listings = (listingRows ?? []) as PublicCompanyListingRow[];
    const favoriteListingIds =
      user && listings.length > 0
        ? await loadFavoriteListingIdsForUser(
            supabase,
            user.id,
            listings.map((listing) => listing.id)
          )
        : new Set<string>();

    const coverImageEntries = await Promise.all(
      listings.map(async (listing) => {
        const coverImagePath = getCoverImagePath(listing.listing_images);
        if (!coverImagePath) {
          return [listing.id, null, null] as const;
        }

        try {
          const signedUrl = await createListingImageSignedUrl(supabase, coverImagePath, 30 * 60);
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

    const companyLogoUrl = toCompanyLogoPublicUrl(supabase, companyProfileRow.logo_path);
    const companyAttribution: PublicListingCompanyAttribution = {
      id: companyProfileRow.id,
      name: companyProfileRow.name,
      slug: companyProfileRow.slug,
      logoUrl: companyLogoUrl,
    };

    const listingPreviews: PublicCompanyListingPreview[] = listings.map((listing) => {
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
        company: companyAttribution,
      };
    });

    return {
      ok: true,
      company: normalizePublicCompanyProfile(companyProfileRow, companyLogoUrl),
      listings: listingPreviews,
      totalListings: listingCount ?? listingPreviews.length,
      viewerUserId: user?.id ?? null,
    };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Company profile is unavailable because core configuration is incomplete.",
    };
  }
}
