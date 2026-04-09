import Link from "next/link";
import { ArrowRight, Building2, Compass, Home, MapPinned } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { HomeSearchCta } from "./home-search-cta";

export function HomeHero() {
  return (
    <section className="border-border/75 bg-card/55 relative overflow-hidden rounded-2xl border p-6 shadow-[0_22px_48px_-34px_rgba(2,8,24,0.95)] sm:p-8 lg:p-9">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_9%_4%,rgba(108,158,255,0.2),transparent_36%),radial-gradient(circle_at_96%_0%,rgba(102,137,208,0.16),transparent_34%)]" />

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

        <aside className="border-border/70 bg-background/65 rounded-xl border p-4 sm:p-5">
          <p className="type-label">Discovery snapshot (placeholder)</p>

          <div className="border-border/70 bg-muted/25 mt-3 rounded-lg border p-4">
            <div className="text-muted-foreground mb-3 flex items-center justify-between text-xs">
              <span>Map + list mode</span>
              <span className="inline-flex items-center gap-1">
                <Compass className="size-3.5" aria-hidden="true" />
                Ready
              </span>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="border-border/70 bg-card/70 rounded-md border p-3">
                <div className="text-muted-foreground text-xs">Rentals sample</div>
                <div className="mt-1 text-lg font-semibold tracking-tight">128</div>
                <div className="type-caption mt-1">Live in current viewport</div>
              </div>
              <div className="border-border/70 bg-card/70 rounded-md border p-3">
                <div className="text-muted-foreground text-xs">Sale sample</div>
                <div className="mt-1 text-lg font-semibold tracking-tight">84</div>
                <div className="type-caption mt-1">Ready to explore</div>
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <div className="border-border/70 bg-background/70 rounded-md border p-3">
              <MapPinned className="text-primary size-4" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium">Map awareness</p>
            </div>
            <div className="border-border/70 bg-background/70 rounded-md border p-3">
              <Home className="text-primary size-4" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium">Listing density</p>
            </div>
            <div className="border-border/70 bg-background/70 rounded-md border p-3">
              <Building2 className="text-primary size-4" aria-hidden="true" />
              <p className="mt-2 text-xs font-medium">Provider-ready</p>
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
