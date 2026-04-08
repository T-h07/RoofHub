"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type MapErrorProps = {
  reset: () => void;
};

export default function MapError({ reset }: MapErrorProps) {
  return (
    <MainContainer size="wide">
      <EmptyState
        icon={AlertTriangle}
        title="Map is temporarily unavailable"
        description="Please retry loading the map. If this keeps happening, switch to list view and try again shortly."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={reset} className={buttonVariants({ size: "sm" })}>
              Retry
            </button>
            <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open list view
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
