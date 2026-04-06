"use client";

import Link from "next/link";
import { Compass, MapPinned, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useActiveRoute } from "@/hooks/use-active-route";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

import { MainContainer } from "./main-container";
import { MobileNavSheet } from "./mobile-nav-sheet";

function HeaderLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/65 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const { isActive } = useActiveRoute();

  return (
    <header className="border-border/70 bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <MainContainer>
        <div className="flex h-[4.25rem] items-center justify-between gap-4">
          <Link href="/" className="group inline-flex items-center gap-2.5">
            <span className="border-primary/45 bg-primary/18 text-primary group-hover:bg-primary/24 inline-flex size-9 items-center justify-center rounded-lg border transition-colors">
              <MapPinned className="size-4.5" aria-hidden="true" />
            </span>
            <span className="leading-none">
              <span className="block text-base font-semibold tracking-tight">
                {siteConfig.name}
              </span>
              <span className="text-muted-foreground block text-xs">Map-first marketplace</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {siteConfig.primaryNav.map((item) => (
              <HeaderLink
                key={item.href}
                href={item.href}
                label={item.title}
                active={isActive(item.href)}
              />
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <span className="text-muted-foreground border-border/70 bg-muted/30 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs">
              <Compass className="size-3.5" aria-hidden="true" />
              Vercel + Supabase ready
            </span>
            <Link
              href={siteConfig.ctaHref}
              className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
            >
              {siteConfig.ctaLabel}
              <Sparkles className="size-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="lg:hidden">
            <MobileNavSheet />
          </div>
        </div>
      </MainContainer>
    </header>
  );
}
