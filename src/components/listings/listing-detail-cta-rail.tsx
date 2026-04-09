import Link from "next/link";
import { Mail, ShieldAlert } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { FavoriteToggle } from "@/components/listings/favorite-toggle";
import { ReportListingDialog } from "@/components/listings/report-listing-dialog";
import { cn } from "@/lib/utils";

type ListingDetailCtaRailProps = {
  listingId: string;
  isAuthenticated: boolean;
  isFavorited: boolean;
  isOwner: boolean;
  contactHref: string;
  signInHref: string;
};

export function ListingDetailCtaRail({
  listingId,
  isAuthenticated,
  isFavorited,
  isOwner,
  contactHref,
  signInHref,
}: ListingDetailCtaRailProps) {
  return (
    <Card className="xl:sticky xl:top-[5.5rem]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Listing actions</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        {isOwner ? (
          <button
            type="button"
            disabled
            className={cn(buttonVariants({ size: "default" }), "w-full")}
          >
            Your published listing
          </button>
        ) : (
          <Link href={contactHref} className={cn(buttonVariants({ size: "default" }), "w-full gap-1.5")}>
            <Mail className="size-4" aria-hidden="true" />
            {isAuthenticated ? "Contact provider" : "Sign in to contact"}
          </Link>
        )}

        <FavoriteToggle
          listingId={listingId}
          initiallyFavorited={isFavorited}
          isAuthenticated={isAuthenticated}
          signInHref={signInHref}
          mode="button"
        />

        <div className="border-border/70 bg-background/45 rounded-lg border px-3 py-2">
          <p className="text-muted-foreground text-xs leading-5">
            Messaging threads open in PT21-PT23 using this same contact entry point.
          </p>
        </div>

        <div className="border-border/70 flex items-center justify-between border-t pt-2">
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <ShieldAlert className="size-3.5" aria-hidden="true" />
            Safety
          </span>
          <ReportListingDialog
            listingId={listingId}
            isAuthenticated={isAuthenticated}
            signInHref={signInHref}
          />
        </div>
      </CardContent>
    </Card>
  );
}
