import Link from "next/link";

import { ArrowRight, Compass, Layers3, LayoutGrid, Route } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

const foundationTracks = [
  {
    icon: LayoutGrid,
    title: "Structured app shell",
    description:
      "A reusable frame with stable navigation, content container rules, and responsive behavior tuned for future product flows.",
  },
  {
    icon: Layers3,
    title: "Scalable architecture",
    description:
      "Typed config, shared utilities, layout primitives, and route placeholders designed for iterative PT delivery without rewrites.",
  },
  {
    icon: Route,
    title: "Clear expansion lanes",
    description:
      "Dedicated route foundations for Explore, Map, and Dashboard so upcoming PTs can implement business logic without shell churn.",
  },
];

export default function Home() {
  return (
    <MainContainer className="space-y-10">
      <section className="border-border/70 bg-card/55 relative overflow-hidden rounded-2xl border p-7 shadow-[0_18px_60px_-38px_rgba(7,10,20,0.95)] sm:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(140deg,rgba(47,151,255,0.1),transparent_45%)]" />
        <div className="relative space-y-6">
          <p className="text-primary/90 text-xs font-semibold tracking-[0.18em] uppercase">
            NM-PT01 App Foundation
          </p>
          <div className="space-y-3">
            <h1 className="text-foreground max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Build a map-first marketplace on stable, composable rails.
            </h1>
            <p className="text-muted-foreground max-w-3xl text-base leading-7">
              {siteConfig.name} now has a production-ready starting point: Next.js App Router,
              TypeScript, Tailwind, shadcn primitives, and a clean shell ready for future PTs.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/explore" className={buttonVariants({ size: "sm" })}>
              View route foundation
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <div className="border-border/70 bg-background/75 text-muted-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
              <Compass className="size-3.5" aria-hidden="true" />
              No business features implemented yet
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {foundationTracks.map((track) => {
          const Icon = track.icon;

          return (
            <article
              key={track.title}
              className="border-border/70 bg-background/75 hover:border-border hover:bg-card/60 rounded-xl border p-5 transition-colors"
            >
              <div className="bg-primary/15 text-primary mb-4 inline-flex size-8 items-center justify-center rounded-md">
                <Icon className="size-4" aria-hidden="true" />
              </div>
              <h2 className="text-foreground text-base font-semibold tracking-tight">
                {track.title}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">{track.description}</p>
            </article>
          );
        })}
      </section>

      <section className="border-border/70 bg-card/40 rounded-xl border p-6 sm:p-8">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Starter routes
        </h2>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-6">
          These routes are intentionally lightweight placeholders to anchor shell composition and
          navigation before domain features arrive.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {siteConfig.primaryNav
            .filter((item) => item.href !== "/")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-border/70 bg-background/70 text-foreground rounded-lg border px-4 py-3 text-sm font-medium transition-colors",
                  "hover:border-border hover:bg-accent/30"
                )}
              >
                {item.title}
              </Link>
            ))}
        </div>
      </section>
    </MainContainer>
  );
}
