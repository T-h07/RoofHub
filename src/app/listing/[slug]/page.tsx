import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ExternalLink, MapPin } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { ListingDetailCtaRail } from "@/components/listings/listing-detail-cta-rail";
import {
  ListingDetailFeatures,
  ListingDetailSpecsGrid,
} from "@/components/listings/listing-detail-facts";
import { ListingImageGallery } from "@/components/listings/listing-image-gallery";
import { ListingLocationMap } from "@/components/listings/listing-location-map";
import { ListingProviderCard } from "@/components/listings/listing-provider-card";
import { ListingDetailSummary } from "@/components/listings/listing-detail-summary";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getMapStyleUrl } from "@/lib/config/map";
import { toSignInPath } from "@/lib/auth/routing";
import { loadPublicListingDetailBySlug } from "@/lib/listings/public-listing-detail";
import { cn } from "@/lib/utils";

type ListingDetailPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function buildExploreHref(city: string, listingType: "rent" | "sale") {
  const params = new URLSearchParams();
  params.set("city", city);
  params.set("listingType", listingType);
  return `/explore?${params.toString()}`;
}

function buildMapHref(
  city: string,
  neighborhood: string | null,
  listingType: "rent" | "sale"
) {
  const params = new URLSearchParams();
  params.set("city", city);
  params.set("listingType", listingType);

  if (neighborhood) {
    params.set("neighborhood", neighborhood);
  }

  return `/map?${params.toString()}`;
}

function formatAvailableFrom(value: string | null) {
  if (!value) {
    return "Availability date not specified.";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Availability date not specified.";
  }

  const formatted = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);

  if (parsed.getTime() <= Date.now()) {
    return "Available now";
  }

  return `Available from ${formatted}`;
}

export default async function ListingDetailPage({
  params,
}: ListingDetailPageProps) {
  const resolvedParams = await params;
  const listingResult = await loadPublicListingDetailBySlug(resolvedParams.slug);

  if (!listingResult.ok) {
    if (listingResult.reason === "not_found") {
      notFound();
    }

    return (
      <MainContainer size="content">
        <EmptyState
          icon={AlertTriangle}
          title="Listing couldn’t load right now"
          description={listingResult.message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link
                href="/explore"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Back to explore
              </Link>
              <Link href="/" className={buttonVariants({ size: "sm" })}>
                Back to home
              </Link>
            </div>
          }
        />
      </MainContainer>
    );
  }

  const { listing, isFavorited, viewerUserId, isOwner } = listingResult;
  const isAuthenticated = Boolean(viewerUserId);
  const listingHref = `/listing/${listing.slug}`;
  const exploreHref = buildExploreHref(listing.city, listing.listing_type);
  const mapHref = buildMapHref(
    listing.city,
    listing.neighborhood,
    listing.listing_type
  );
  const contactThreadHref = `/messages?listingId=${listing.id}`;
  const contactHref = isAuthenticated
    ? contactThreadHref
    : toSignInPath(contactThreadHref);
  const signInHref = toSignInPath(listingHref);
  const mapStyleUrl = getMapStyleUrl();
  const descriptionParagraphs = listing.description
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <MainContainer size="wide" className="space-y-6">
      <section className="border-border/75 bg-card/58 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={exploreHref}
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 px-2.5 text-xs")}
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to explore
          </Link>
          <Link
            href={mapHref}
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 px-2.5 text-xs")}
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            Nearby map
          </Link>
        </div>

        <p className="text-muted-foreground text-xs">
          Shareable listing URL ready for favorites and messaging flows.
        </p>
      </section>

      <ListingDetailSummary listing={listing} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <aside className="order-1 space-y-4 xl:order-2 xl:sticky xl:top-[5.5rem] xl:self-start">
          <ListingDetailCtaRail
            listingId={listing.id}
            isAuthenticated={isAuthenticated}
            isFavorited={isFavorited}
            isOwner={isOwner}
            contactHref={contactHref}
            signInHref={signInHref}
          />

          <ListingProviderCard provider={listing.provider} isOwner={isOwner} />
        </aside>

        <div className="order-2 space-y-6 xl:order-1">
          <ListingImageGallery title={listing.title} images={listing.images} />

          <section className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4 sm:p-5">
            <header className="space-y-1.5">
              <h2 className="type-section-title text-xl sm:text-2xl">Location</h2>
              <p className="text-muted-foreground text-sm">
                {listing.neighborhood
                  ? `${listing.neighborhood}, ${listing.city}`
                  : listing.city}
              </p>
              {listing.public_location_mode === "exact" && listing.address_text ? (
                <p className="text-muted-foreground text-sm">{listing.address_text}</p>
              ) : listing.public_location_mode === "approximate" ? (
                <p className="text-muted-foreground text-sm">
                  Marker and map context are approximate for privacy.
                </p>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Exact map placement is hidden until direct provider contact.
                </p>
              )}
            </header>

            <ListingLocationMap
              mapStyleUrl={mapStyleUrl}
              latitude={listing.latitude}
              longitude={listing.longitude}
              publicLocationMode={listing.public_location_mode}
              mapHref={mapHref}
            />
          </section>

          <section className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4 sm:p-5">
            <header className="space-y-1">
              <h2 className="type-section-title text-xl sm:text-2xl">Property details</h2>
              <p className="text-muted-foreground text-sm">
                Core specifications and move-in context for this listing.
              </p>
            </header>

            <ListingDetailSpecsGrid listing={listing} />
          </section>

          <section className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4 sm:p-5">
            <header className="space-y-1">
              <h2 className="type-section-title text-xl sm:text-2xl">Features and amenities</h2>
              <p className="text-muted-foreground text-sm">
                {formatAvailableFrom(listing.available_from)}
              </p>
            </header>

            <ListingDetailFeatures listing={listing} />
          </section>

          <section className="border-border/75 bg-card/58 space-y-3 rounded-xl border p-4 sm:p-5">
            <header className="space-y-1">
              <h2 className="type-section-title text-xl sm:text-2xl">Description</h2>
              <p className="text-muted-foreground text-sm">
                Listing narrative provided by the property provider.
              </p>
            </header>

            {descriptionParagraphs.length > 0 ? (
              <div className="space-y-3.5">
                {descriptionParagraphs.map((paragraph, index) => (
                  <p key={`listing-description-${index}`} className="type-body">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Description is currently unavailable for this listing.
              </p>
            )}
          </section>

          <section className="border-border/75 bg-card/58 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5">
            <p className="text-muted-foreground text-sm">
              Need another angle? Continue in map or compare with similar inventory in explore.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={mapHref}
                className={cn(buttonVariants({ size: "sm", variant: "outline" }), "gap-1.5")}
              >
                Open map
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </Link>
              <Link href={exploreHref} className={buttonVariants({ size: "sm" })}>
                Open explore
              </Link>
            </div>
          </section>
        </div>
      </div>
    </MainContainer>
  );
}
