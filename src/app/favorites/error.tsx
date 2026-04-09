"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type FavoritesErrorProps = {
  reset: () => void;
};

export default function FavoritesError({ reset }: FavoritesErrorProps) {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={AlertTriangle}
        title="Favorites are temporarily unavailable"
        description="Retry loading favorites. If the problem continues, return to explore and save again."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className={buttonVariants({ size: "sm" })}>
              Retry
            </button>
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Browse explore
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
