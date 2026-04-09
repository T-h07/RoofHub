import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProviderCtaSection() {
  return (
    <section className="border-border/80 bg-card/52 relative overflow-hidden rounded-2xl border p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(94,139,225,0.2),transparent_38%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <Badge variant="neutral">For providers</Badge>
          <h2 className="type-section-title">
            Put your property on the map and reach renters or buyers faster.
          </h2>
          <p className="type-body-muted">
            RoofHub is structured for map-aware listing discovery. Create an account now and move
            into provider workflows as listing creation and management PTs ship.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link href="/auth/sign-up?next=%2Fdashboard" className={buttonVariants()}>
            <Building2 className="size-4" aria-hidden="true" />
            List your property
          </Link>
          <Link href="/explore" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            See active discovery flow
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
