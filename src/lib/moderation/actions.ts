"use server";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isAdminRole } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase";

import type {
  ListingModerationStatus,
  UpdateListingModerationVisibilityInput,
  UpdateListingModerationVisibilityResult,
} from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LISTING_MODERATION_ACTIONS = new Set<UpdateListingModerationVisibilityInput["action"]>([
  "hide",
  "unhide",
]);

type ModerationMutationContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
        ? TResult extends { ok: true; profile: infer TProfile }
          ? TProfile
          : never
        : never;
    }
  | {
      ok: false;
      message: string;
    };

type ModerationListingRow = {
  id: string;
  listing_status: ListingModerationStatus;
  published_at: string | null;
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
    return "You do not have moderation permission for this listing.";
  }

  return "Listing moderation action failed. Please retry.";
}

async function ensureModerationMutationContext(): Promise<ModerationMutationContext> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  if (!isAdminRole(profileResult.profile.role)) {
    return {
      ok: false,
      message: "Admin role is required for moderation actions.",
    };
  }

  return {
    ok: true,
    supabase,
    profile: profileResult.profile,
  };
}

function getRestoreStatusForUnhide(listing: ModerationListingRow): ListingModerationStatus {
  if (listing.published_at) {
    return "published";
  }

  return "draft";
}

export async function updateListingModerationVisibilityAction(
  input: UpdateListingModerationVisibilityInput
): Promise<UpdateListingModerationVisibilityResult> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      message: "Moderation action payload is invalid.",
    };
  }

  const listingId = typeof input.listingId === "string" ? input.listingId : null;
  const action = input.action;

  if (!listingId || !isUuid(listingId)) {
    return {
      ok: false,
      message: "Listing reference is invalid.",
    };
  }

  if (!LISTING_MODERATION_ACTIONS.has(action)) {
    return {
      ok: false,
      message: "Moderation action type is invalid.",
    };
  }

  const context = await ensureModerationMutationContext();
  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
    };
  }

  const { supabase } = context;

  const listingResult = await supabase
    .from("listings")
    .select("id, listing_status, published_at")
    .eq("id", listingId)
    .maybeSingle();

  if (listingResult.error || !listingResult.data) {
    return {
      ok: false,
      message: "Listing not found for moderation.",
    };
  }

  const listing = listingResult.data as ModerationListingRow;
  const previousStatus = listing.listing_status;

  if (action === "hide") {
    if (listing.listing_status === "hidden_by_admin") {
      return {
        ok: true,
        message: "Listing is already hidden by moderation.",
        previousStatus,
        nextStatus: "hidden_by_admin",
      };
    }

    const { data: updated, error: updateError } = await supabase
      .from("listings")
      .update({
        listing_status: "hidden_by_admin",
        archived_at: null,
      })
      .eq("id", listing.id)
      .select("listing_status")
      .maybeSingle();

    if (updateError || !updated) {
      return {
        ok: false,
        message: updateError
          ? normalizeSupabaseError(updateError.message)
          : "Listing could not be hidden right now.",
        previousStatus,
      };
    }

    return {
      ok: true,
      message: "Listing hidden from public discovery.",
      previousStatus,
      nextStatus: updated.listing_status,
    };
  }

  if (listing.listing_status !== "hidden_by_admin") {
    return {
      ok: true,
      message: "Listing is already visible to normal lifecycle controls.",
      previousStatus,
      nextStatus: listing.listing_status,
    };
  }

  const restoreStatus = getRestoreStatusForUnhide(listing);
  const { data: restored, error: restoreError } = await supabase
    .from("listings")
    .update({
      listing_status: restoreStatus,
      archived_at: null,
      published_at: restoreStatus === "published" ? listing.published_at : null,
    })
    .eq("id", listing.id)
    .select("listing_status")
    .maybeSingle();

  if (restoreError || !restored) {
    return {
      ok: false,
      message: restoreError
        ? normalizeSupabaseError(restoreError.message)
        : "Listing could not be restored right now.",
      previousStatus,
    };
  }

  const restoreMessage =
    restored.listing_status === "published"
      ? "Listing restored to public visibility."
      : "Listing restored to draft workflow.";

  return {
    ok: true,
    message: restoreMessage,
    previousStatus,
    nextStatus: restored.listing_status,
  };
}
