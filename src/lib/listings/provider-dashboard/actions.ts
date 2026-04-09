"use server";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAdminRole, isProviderRole } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase";
import { canTransitionProviderListingStatus } from "@/lib/listings/provider-wizard/status-transitions";

import type { ProviderListingStatus } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProviderMutationContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
        ? TResult extends { ok: true; profile: infer TProfile }
          ? TProfile
          : never
        : never;
      isAdmin: boolean;
    }
  | {
      ok: false;
      message: string;
    };

type ProviderOwnedListingStatus = {
  id: string;
  owner_id: string;
  listing_status: ProviderListingStatus;
  published_at: string | null;
};

export type UpdateProviderListingLifecycleStatusInput = {
  listingId: string;
  nextStatus: ProviderListingStatus;
};

export type UpdateProviderListingLifecycleStatusResult = {
  ok: boolean;
  message: string;
  previousStatus?: ProviderListingStatus;
  nextStatus?: ProviderListingStatus;
};

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function normalizeSupabaseError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to manage this listing.";
  }

  if (normalized.includes("check constraint")) {
    return "This status change conflicts with listing constraints.";
  }

  return "Listing status update failed. Please retry.";
}

function getLifecycleStatusSuccessMessage(nextStatus: ProviderListingStatus) {
  switch (nextStatus) {
    case "draft":
      return "Listing restored to draft.";
    case "paused":
      return "Listing paused.";
    case "archived":
      return "Listing archived.";
    case "sold":
      return "Listing marked as sold.";
    case "rented":
      return "Listing marked as rented.";
    case "published":
      return "Listing set to active.";
    case "hidden_by_admin":
      return "Listing status updated by admin controls.";
    default:
      return "Listing status updated.";
  }
}

function buildStatusPatch(
  nextStatus: ProviderListingStatus,
  currentListing: ProviderOwnedListingStatus
) {
  if (nextStatus === "draft") {
    return {
      listing_status: nextStatus,
      archived_at: null,
      published_at: null,
    };
  }

  if (nextStatus === "published") {
    return {
      listing_status: nextStatus,
      published_at: currentListing.published_at ?? new Date().toISOString(),
      archived_at: null,
    };
  }

  if (nextStatus === "archived") {
    return {
      listing_status: nextStatus,
      archived_at: new Date().toISOString(),
    };
  }

  return {
    listing_status: nextStatus,
    archived_at: null,
  };
}

async function ensureProviderMutationContext(): Promise<ProviderMutationContext> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  if (!isProviderRole(profileResult.profile.role)) {
    return {
      ok: false,
      message: "Switch your profile role to provider before managing listings.",
    };
  }

  return {
    ok: true,
    supabase,
    profile: profileResult.profile,
    isAdmin: isAdminRole(profileResult.profile.role),
  };
}

async function loadProviderOwnedListing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    listingId: string;
    userId: string;
    isAdmin: boolean;
  }
) {
  let query = supabase
    .from("listings")
    .select("id, owner_id, listing_status, published_at")
    .eq("id", input.listingId)
    .limit(1);

  if (!input.isAdmin) {
    query = query.eq("owner_id", input.userId);
  }

  const { data, error } = await query.maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      message: "Listing not found or inaccessible.",
      listing: null as ProviderOwnedListingStatus | null,
    };
  }

  return {
    ok: true as const,
    listing: data as ProviderOwnedListingStatus,
  };
}

export async function updateProviderListingLifecycleStatusAction(
  input: UpdateProviderListingLifecycleStatusInput
): Promise<UpdateProviderListingLifecycleStatusResult> {
  if (!isUuid(input.listingId)) {
    return {
      ok: false,
      message: "Listing id is invalid.",
    };
  }

  const context = await ensureProviderMutationContext();

  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
    };
  }

  const { supabase, profile, isAdmin } = context;

  if (input.nextStatus === "hidden_by_admin") {
    return {
      ok: false,
      message: "Hidden-by-admin status can only be set by moderation workflows.",
    };
  }

  const listingResult = await loadProviderOwnedListing(supabase, {
    listingId: input.listingId,
    userId: profile.id,
    isAdmin,
  });

  if (!listingResult.ok || !listingResult.listing) {
    return {
      ok: false,
      message: listingResult.ok ? "Listing not found or inaccessible." : listingResult.message,
    };
  }

  const currentListing = listingResult.listing;
  if (currentListing.listing_status === input.nextStatus) {
    return {
      ok: true,
      message: "Listing already has this status.",
      previousStatus: currentListing.listing_status,
      nextStatus: currentListing.listing_status,
    };
  }

  if (!canTransitionProviderListingStatus(currentListing.listing_status, input.nextStatus)) {
    return {
      ok: false,
      message: `Cannot move listing from ${currentListing.listing_status} to ${input.nextStatus}.`,
      previousStatus: currentListing.listing_status,
    };
  }

  const patch = buildStatusPatch(input.nextStatus, currentListing);
  let updateQuery = supabase
    .from("listings")
    .update(patch)
    .eq("id", currentListing.id)
    .select("listing_status")
    .limit(1);

  if (!isAdmin) {
    updateQuery = updateQuery.eq("owner_id", profile.id);
  }

  const { data, error } = await updateQuery.maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      message: error
        ? normalizeSupabaseError(error.message)
        : "Listing status update could not be completed.",
      previousStatus: currentListing.listing_status,
    };
  }

  return {
    ok: true,
    message: getLifecycleStatusSuccessMessage(data.listing_status),
    previousStatus: currentListing.listing_status,
    nextStatus: data.listing_status,
  };
}
