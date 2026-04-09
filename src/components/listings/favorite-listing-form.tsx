"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Heart } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  type FavoriteListingActionState,
  toggleListingFavoriteAction,
} from "@/lib/listings/detail-actions";
import { cn } from "@/lib/utils";

type FavoriteListingFormProps = {
  listingId: string;
  slug: string;
  isAuthenticated: boolean;
  signInHref: string;
  initiallyFavorited: boolean;
};

export function FavoriteListingForm({
  listingId,
  slug,
  isAuthenticated,
  signInHref,
  initiallyFavorited,
}: FavoriteListingFormProps) {
  const initialState: FavoriteListingActionState = {
    status: "idle",
    message: null,
    isFavorited: initiallyFavorited,
    requiresAuth: false,
  };

  const [state, formAction, isPending] = useActionState(
    toggleListingFavoriteAction,
    initialState
  );

  if (!isAuthenticated) {
    return (
      <div className="space-y-2">
        <Link href={signInHref} className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5")}>
          <Heart className="size-4" aria-hidden="true" />
          Sign in to save
        </Link>
        <p className="text-muted-foreground text-xs">
          Favorites sync across devices once you are signed in.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="isFavorited" value={state.isFavorited ? "1" : "0"} />

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          buttonVariants({
            variant: state.isFavorited ? "default" : "outline",
          }),
          "w-full gap-1.5"
        )}
      >
        <Heart className={cn("size-4", state.isFavorited ? "fill-current" : "")} aria-hidden="true" />
        {state.isFavorited ? "Saved to favorites" : "Save to favorites"}
      </button>

      {state.message ? (
        <p
          className={cn(
            "text-xs",
            state.status === "error" ? "text-destructive" : "text-muted-foreground"
          )}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
