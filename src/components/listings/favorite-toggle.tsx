"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Heart, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { buttonVariants } from "@/components/ui/button";
import { toSignInPath } from "@/lib/auth/routing";
import { setFavoriteStatusAction } from "@/lib/listings/favorite-actions";
import { cn } from "@/lib/utils";

type FavoriteToggleMode = "icon" | "button";

type FavoriteToggleProps = {
  listingId: string;
  initiallyFavorited: boolean;
  isAuthenticated: boolean;
  signInHref?: string;
  mode?: FavoriteToggleMode;
  className?: string;
  onFavoritedChange?: (isFavorited: boolean) => void;
};

function buildDefaultSignInHref(
  pathname: string | null,
  searchParams: ReturnType<typeof useSearchParams>
) {
  const resolvedPathname = pathname || "/";
  const query = searchParams.toString();
  const nextPath = query ? `${resolvedPathname}?${query}` : resolvedPathname;

  return toSignInPath(nextPath);
}

export function FavoriteToggle({
  listingId,
  initiallyFavorited,
  isAuthenticated,
  signInHref,
  mode = "icon",
  className,
  onFavoritedChange,
}: FavoriteToggleProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isFavorited, setIsFavorited] = useState(initiallyFavorited);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedSignInHref = useMemo(() => {
    if (signInHref) {
      return signInHref;
    }

    return buildDefaultSignInHref(pathname, searchParams);
  }, [pathname, searchParams, signInHref]);

  useEffect(() => {
    setIsFavorited(initiallyFavorited);
  }, [initiallyFavorited]);

  if (!isAuthenticated) {
    return (
      <Link
        href={resolvedSignInHref}
        className={cn(
          buttonVariants({
            variant: mode === "icon" ? "outline" : "outline",
            size: mode === "icon" ? "icon" : "default",
          }),
          mode === "icon"
            ? "size-8 border-nav-foreground/35 bg-nav-background/66 text-nav-foreground hover:bg-nav-background/85"
            : "w-full gap-1.5",
          className
        )}
      >
        <Heart className="size-4" aria-hidden="true" />
        {mode === "button" ? "Sign in to save" : null}
      </Link>
    );
  }

  function handleToggle() {
    if (isPending) {
      return;
    }

    const previousState = isFavorited;
    const nextState = !previousState;

    setErrorMessage(null);
    setIsFavorited(nextState);

    startTransition(async () => {
      const result = await setFavoriteStatusAction({
        listingId,
        favorited: nextState,
      });

      if (!result.ok) {
        setIsFavorited(previousState);
        setErrorMessage(result.message ?? "Favorite action failed.");

        if (result.requiresAuth) {
          router.push(resolvedSignInHref);
          return;
        }

        toast.error(result.message ?? "Favorite action failed.");
        return;
      }

      setIsFavorited(result.isFavorited);
      onFavoritedChange?.(result.isFavorited);

      if (pathname === "/favorites" && !result.isFavorited) {
        router.refresh();
      }
    });
  }

  return (
    <div className={cn(mode === "button" ? "space-y-1.5" : "space-y-0", className)}>
      <button
        type="button"
        disabled={isPending}
        aria-pressed={isFavorited}
        onClick={handleToggle}
        className={cn(
          buttonVariants({
            variant: mode === "icon" ? "outline" : isFavorited ? "default" : "outline",
            size: mode === "icon" ? "icon" : "default",
          }),
          mode === "icon"
            ? cn(
                "size-8 border-nav-foreground/35 bg-nav-background/66 text-nav-foreground hover:bg-nav-background/85",
                isFavorited ? "bg-primary text-primary-foreground border-transparent hover:bg-primary/90" : ""
              )
            : "w-full gap-1.5"
        )}
      >
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Heart className={cn("size-4", isFavorited ? "fill-current" : "")} aria-hidden="true" />
        )}
        {mode === "button" ? (isFavorited ? "Saved to favorites" : "Save to favorites") : null}
      </button>

      {mode === "button" ? (
        errorMessage ? (
          <p className="text-destructive text-xs" role="alert">
            {errorMessage}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">Favorites sync across devices instantly.</p>
        )
      ) : null}
    </div>
  );
}
