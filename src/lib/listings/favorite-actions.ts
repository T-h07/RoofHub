"use server";

import { revalidatePath } from "next/cache";

import { createServerSupabaseClient } from "@/lib/supabase";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type SetFavoriteStatusInput = {
  listingId: string;
  favorited: boolean;
};

export type SetFavoriteStatusResult = {
  ok: boolean;
  isFavorited: boolean;
  requiresAuth: boolean;
  message: string | null;
};

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export async function setFavoriteStatusAction(
  input: SetFavoriteStatusInput
): Promise<SetFavoriteStatusResult> {
  if (!isUuid(input.listingId)) {
    return {
      ok: false,
      isFavorited: false,
      requiresAuth: false,
      message: "Favorite action could not be completed. Refresh and try again.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        ok: false,
        isFavorited: false,
        requiresAuth: true,
        message: "Sign in to manage favorites.",
      };
    }

    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("id, slug")
      .eq("id", input.listingId)
      .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
      .maybeSingle();

    if (listingError || !listing) {
      return {
        ok: false,
        isFavorited: false,
        requiresAuth: false,
        message: "This listing is no longer available for favorites.",
      };
    }

    if (input.favorited) {
      const { error } = await supabase.from("favorites").insert({
        user_id: user.id,
        listing_id: input.listingId,
      });

      if (error && error.code !== "23505") {
        return {
          ok: false,
          isFavorited: false,
          requiresAuth: false,
          message: "Could not save this listing right now.",
        };
      }
    } else {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("listing_id", input.listingId);

      if (error) {
        return {
          ok: false,
          isFavorited: true,
          requiresAuth: false,
          message: "Could not remove this listing from favorites.",
        };
      }
    }

    revalidatePath(`/listing/${listing.slug}`);
    revalidatePath("/favorites");

    return {
      ok: true,
      isFavorited: input.favorited,
      requiresAuth: false,
      message: input.favorited ? "Saved to favorites." : "Removed from favorites.",
    };
  } catch {
    return {
      ok: false,
      isFavorited: !input.favorited,
      requiresAuth: false,
      message: "Favorite action failed. Please try again.",
    };
  }
}
