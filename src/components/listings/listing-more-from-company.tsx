import Link from "next/link";
import { Building2 } from "lucide-react";

import { ListingCard } from "@/components/listings/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type {
  PublicListingDetailCompany,
  PublicListingDetailMoreFromCompanyListing,
} from "@/lib/listings/public-listing-detail";
import { cn } from "@/lib/utils";

type ListingMoreFromCompanyProps = {
  company: PublicListingDetailCompany;
  listings: PublicListingDetailMoreFromCompanyListing[];
  isAuthenticated: boolean;
};

export function ListingMoreFromCompany({
  company,
  listings,
  isAuthenticated,
}: ListingMoreFromCompanyProps) {
  return (
    <section
      id="more-from-company"
      className="border-border/75 bg-card/58 space-y-4 rounded-xl border p-4 sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="type-label">Company inventory</p>
          <h2 className="type-section-title text-xl sm:text-2xl">
            More from {company.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            Browse additional published listings backed by this company.
          </p>
        </div>

        <Link
          href={`/companies/${company.slug}`}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8")}
        >
          Open company profile
        </Link>
      </header>

      {listings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={`company-related-listing-${listing.id}`}
              listing={listing}
              isAuthenticated={isAuthenticated}
              className="h-full"
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="No other published listings right now"
          description={`${company.name} currently has this listing live on RoofHub. Check the company page for future inventory updates.`}
          action={
            <Link href={`/companies/${company.slug}`} className={buttonVariants({ size: "sm" })}>
              View company profile
            </Link>
          }
        />
      )}
    </section>
  );
}
