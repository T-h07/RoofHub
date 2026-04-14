import Link from "next/link";
import { Home, PlusSquare } from "lucide-react";

import { ListingCard } from "@/components/listings/listing-card";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { PublicCompanyListingPreview } from "@/lib/company/public-profile";
import { cn } from "@/lib/utils";

type CompanyPublicListingsShellProps = {
  companyName: string;
  listings: PublicCompanyListingPreview[];
  isAuthenticated: boolean;
  className?: string;
};

export function CompanyPublicListingsShell({
  companyName,
  listings,
  isAuthenticated,
  className,
}: CompanyPublicListingsShellProps) {
  return (
    <section className={cn("border-border bg-card rounded-2xl border p-5 sm:p-6", className)}>
      <header className="border-border/70 mb-5 space-y-2 border-b pb-4">
        <p className="type-label">Public inventory</p>
        <h2 className="type-section-title">Listings from {companyName}</h2>
        <p className="type-body-muted">
          Published listings linked to this company account are shown here and update as inventory
          changes.
        </p>
      </header>

      {listings.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={listing}
              isAuthenticated={isAuthenticated}
              className="h-full"
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Home}
          title="No public listings yet"
          description="This company has not published listings on RoofHub yet. Check back soon or explore other live properties."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/explore" className={buttonVariants({ size: "sm" })}>
                Explore live listings
              </Link>
              <Link href="/map" className={buttonVariants({ size: "sm", variant: "outline" })}>
                <PlusSquare className="size-4" />
                Open map view
              </Link>
            </div>
          }
        />
      )}
    </section>
  );
}
