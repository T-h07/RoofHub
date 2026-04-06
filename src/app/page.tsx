import Link from "next/link";

import { ArrowRight, Compass, LayoutGrid, Map, Route, ShieldCheck } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { ShellPreview } from "@/components/shared/shell-preview";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

const shellTracks = [
  {
    icon: LayoutGrid,
    title: "Reusable global shell",
    description:
      "Header, footer, container rhythm, and route composition are now stable foundations for every upcoming PT.",
  },
  {
    icon: Map,
    title: "Map-aware structure",
    description:
      "Spacing and component density are tuned for map/list coexistence, not only for a marketing-style homepage.",
  },
  {
    icon: ShieldCheck,
    title: "Deployment-safe defaults",
    description:
      "Built on Next.js App Router conventions with environment separation in mind for Vercel dev, preview, and production flows.",
  },
];

export default function Home() {
  return (
    <MainContainer size="wide" className="space-y-10">
      <section className="border-border/80 bg-card/58 relative overflow-hidden rounded-2xl border p-7 shadow-[0_20px_44px_-34px_rgba(2,8,24,0.95)] sm:p-9">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(125deg,rgba(89,140,255,0.16),transparent_45%)]" />
        <div className="relative space-y-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge variant="primary">NM-PT02</Badge>
            <Badge variant="neutral">Dark theme locked</Badge>
            <Badge variant="neutral">Vercel + Supabase aligned</Badge>
          </div>

          <div className="space-y-3">
            <h1 className="type-display max-w-4xl">
              {siteConfig.name} now has a coherent design system and global UI shell.
            </h1>
            <p className="type-body-muted max-w-3xl">
              This foundation establishes branded navigation, reusable primitives, and feedback
              patterns so feature PTs can ship faster without redesigning structure.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/explore" className={buttonVariants()}>
              Explore shell route
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/map" className={buttonVariants({ variant: "outline" })}>
              Open map route scaffold
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {shellTracks.map((track) => {
          const Icon = track.icon;

          return (
            <Card key={track.title}>
              <CardHeader>
                <div className="space-y-3">
                  <span className="border-primary/40 bg-primary/18 text-primary inline-flex size-9 items-center justify-center rounded-md border">
                    <Icon className="size-4.5" />
                  </span>
                  <CardTitle>{track.title}</CardTitle>
                  <CardDescription>{track.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <span className="type-caption inline-flex items-center gap-1.5">
                  <Route className="text-primary size-3.5" />
                  Ready for NM-PT03 extensions
                </span>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <ShellPreview />

      <section className="border-border/75 bg-card/45 rounded-xl border p-6 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="type-label">Starter routes</p>
            <h2 className="type-section-title mt-2">Shell-ready route foundations</h2>
            <p className="type-body-muted mt-2 max-w-2xl">
              These routes stay intentionally light and now inherit the complete PT02 shell and
              primitive system.
            </p>
          </div>
          <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
            <Compass className="text-primary size-3.5" />
            Expand by PT branches, not ad-hoc page rewrites
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {siteConfig.primaryNav
            .filter((item) => item.href !== "/")
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "border-border/75 bg-background/65 text-foreground rounded-lg border px-4 py-3.5 text-sm font-medium transition-colors",
                  "hover:bg-accent/45 hover:text-accent-foreground"
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
