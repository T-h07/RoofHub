import Link from "next/link";
import { Home, SearchX } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function ListingDetailNotFound() {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={SearchX}
        title="Listing not found"
        description="This listing may be unavailable, unpublished, or removed from public browsing."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to explore
            </Link>
            <Link href="/" className={buttonVariants({ size: "sm" })}>
              <Home className="size-3.5" aria-hidden="true" />
              Home
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
