import Link from "next/link";
import { SearchX, TriangleAlert } from "lucide-react";

import { ListingCard } from "@/components/listings/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import type { PublicExploreListing } from "@/lib/listings/public-explore";

type FeaturedListingsSectionProps = {
  listings: PublicExploreListing[];
  isAuthenticated: boolean;
  loadErrorMessage: string | null;
};

export function FeaturedListingsSection({
  listings,
  isAuthenticated,
  loadErrorMessage,
}: FeaturedListingsSectionProps) {
  return (
    <Section
      eyebrow="Featured and new"
      title="Fresh listings from the RoofHub marketplace"
      description="Recent published listings appear here so you can jump straight into detail pages or continue in explore view."
      action={
        <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
          View all listings
        </Link>
      }
    >
      {loadErrorMessage ? (
        <EmptyState
          icon={TriangleAlert}
          title="Featured listings are unavailable"
          description={loadErrorMessage}
          action={
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open explore
            </Link>
          }
        />
      ) : listings.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="No published listings yet"
          description="As new properties are published, they will appear here automatically."
          action={
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Browse explore
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
