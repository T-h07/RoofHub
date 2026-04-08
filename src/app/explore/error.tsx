"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

type ExploreErrorProps = {
  reset: () => void;
};

export default function ExploreError({ reset }: ExploreErrorProps) {
  return (
    <MainContainer size="wide">
      <EmptyState
        icon={AlertTriangle}
        title="Explore is temporarily unavailable"
        description="Please retry loading the listings. If this keeps happening, return to the homepage and try again shortly."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className={buttonVariants({ size: "sm" })}>
              Retry
            </button>
            <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Back to home
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}

