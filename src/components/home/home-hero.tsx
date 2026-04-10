import Link from "next/link";
import { ArrowRight, Compass, ShieldCheck, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HomeSearchCta } from "./home-search-cta";

export function HomeHero() {
  return (
    <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-[0_24px_42px_-34px_color-mix(in_oklch,var(--nav-background)_34%,transparent)] sm:p-8 lg:p-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_4%,color-mix(in_oklch,var(--primary)_16%,white),transparent_36%),radial-gradient(circle_at_96%_0%,color-mix(in_oklch,var(--warm-accent)_34%,white),transparent_34%)]" />

      <div className="relative grid items-start gap-8 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="primary">RoofHub</Badge>
            <Badge variant="neutral">Rent + Buy</Badge>
            <Badge variant="neutral">Map-first</Badge>
          </div>

          <div className="space-y-3.5">
            <h1 className="type-display max-w-4xl">
              Find rentals and homes for sale through one map-first discovery flow.
            </h1>
            <p className="type-body-muted max-w-3xl">
              RoofHub brings list and map exploration into the same path so seekers can scan faster,
              while providers get a clear way to publish properties and reach serious renters and
              buyers.
            </p>
          </div>

          <HomeSearchCta />

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/explore" className={buttonVariants()}>
              Browse listings
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/map" className={buttonVariants({ variant: "outline" })}>
              Browse map
            </Link>
          </div>
        </div>

        <aside className="border-border/70 bg-surface-soft/92 rounded-xl border p-4 sm:p-5">
          <p className="type-label">Why RoofHub works</p>

          <div className="mt-3 space-y-2.5">
            <div className="border-border/70 bg-background/60 rounded-lg border px-3.5 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Compass className="text-primary size-4" aria-hidden="true" />
                Search map and list together
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Keep one search context while switching between visual map scanning and list-first comparison.
              </p>
            </div>
            <div className="border-border/70 bg-background/60 rounded-lg border px-3.5 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="text-primary size-4" aria-hidden="true" />
                Trust-aware listing context
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Listing pages surface key provider and contact context without cluttering the browsing flow.
              </p>
            </div>
            <div className="border-border/70 bg-background/60 rounded-lg border px-3.5 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="text-primary size-4" aria-hidden="true" />
                Built for renters and buyers
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                Browse rentals and for-sale inventory through one clean discovery experience.
              </p>
            </div>
          </div>

          <Link
            href="/auth/sign-up?next=%2Fdashboard"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "text-primary mt-4 h-8 w-full justify-start px-0 hover:bg-transparent"
            )}
          >
            List your property
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </section>
  );
}
