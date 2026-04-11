import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ProviderCtaSection() {
  return (
    <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 sm:p-7">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(106deg,color-mix(in_oklch,var(--primary)_9%,transparent)_8%,transparent_64%),linear-gradient(334deg,color-mix(in_oklch,var(--warm-accent)_8%,transparent)_0%,transparent_66%)]" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <Badge variant="neutral">For providers</Badge>
          <h2 className="type-section-title">
            Put your property on the map and reach renters or buyers faster.
          </h2>
          <p className="type-body-muted">
            RoofHub is built for map-aware discovery and high-intent inquiries. Create your provider
            account to publish listings and manage responses from one workspace.
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
