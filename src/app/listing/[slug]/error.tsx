"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type ListingDetailErrorProps = {
  reset: () => void;
};

export default function ListingDetailError({ reset }: ListingDetailErrorProps) {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={AlertTriangle}
        title="Listing detail is temporarily unavailable"
        description="Please retry loading this listing. If the problem continues, return to explore and try again."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className={buttonVariants({ size: "sm" })}>
              Retry
            </button>
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to explore
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
