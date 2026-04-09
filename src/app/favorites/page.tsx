import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Heart, SearchX } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { ListingCard } from "@/components/listings/listing-card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { loadViewerFavoriteListings } from "@/lib/listings/favorites";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function FavoritesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/favorites"));
  }

  const favoritesResult = await loadViewerFavoriteListings(user.id);

  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/60 space-y-3 rounded-xl border p-5 sm:p-6">
        <Badge variant="primary">Favorites</Badge>
        <h1 className="type-page-title max-w-4xl">
          Saved listings synced to your account across explore, map, and detail pages.
        </h1>
        <p className="type-body-muted max-w-3xl">
          Use favorites to shortlist properties, then continue from detail or contact flows without
          losing context.
        </p>
      </section>

      {!favoritesResult.ok ? (
        <EmptyState
          icon={AlertTriangle}
          title="Favorites couldn’t load right now"
          description={favoritesResult.message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/favorites" className={buttonVariants({ size: "sm", variant: "outline" })}>
                Retry
              </Link>
              <Link href="/explore" className={buttonVariants({ size: "sm" })}>
                Browse listings
              </Link>
            </div>
          }
        />
      ) : favoritesResult.listings.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No favorites saved yet"
          description="Save listings from explore, map, or detail pages to build your shortlist here."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/explore" className={buttonVariants({ size: "sm" })}>
                Browse explore
              </Link>
              <Link href="/map" className={buttonVariants({ size: "sm", variant: "outline" })}>
                Open map
              </Link>
            </div>
          }
        />
      ) : (
        <section className="space-y-4">
          <div className="border-border/75 bg-card/58 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3">
            <p className="text-sm font-semibold tracking-tight">
              {favoritesResult.listings.length} saved{" "}
              {favoritesResult.listings.length === 1 ? "listing" : "listings"}
            </p>
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <Heart className="size-3.5" aria-hidden="true" />
              Tap the heart again to remove a saved item.
            </p>
          </div>

          {favoritesResult.hiddenCount > 0 ? (
            <div className="border-border/75 bg-muted/25 rounded-lg border px-3 py-2.5 text-xs text-amber-300/95">
              {favoritesResult.hiddenCount} saved{" "}
              {favoritesResult.hiddenCount === 1 ? "listing is" : "listings are"} currently
              unavailable because visibility changed.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {favoritesResult.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} isAuthenticated />
            ))}
          </div>
        </section>
      )}
    </MainContainer>
  );
}
