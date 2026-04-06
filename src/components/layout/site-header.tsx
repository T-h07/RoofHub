"use client";

import Link from "next/link";
import { Compass, MapPinned } from "lucide-react";

import { useActiveRoute } from "@/hooks/use-active-route";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

import { MainContainer } from "./main-container";

type HeaderLinkProps = {
  href: string;
  label: string;
  active: boolean;
};

function HeaderLink({ href, label, active }: HeaderLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function SiteHeader() {
  const { isActive } = useActiveRoute();

  return (
    <header className="border-border/70 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <MainContainer>
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="bg-primary/90 text-primary-foreground inline-flex size-8 items-center justify-center rounded-md">
              <MapPinned className="size-4" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight">{siteConfig.name}</span>
              <span className="text-muted-foreground text-xs">App foundation</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            {siteConfig.primaryNav.map((item) => (
              <HeaderLink
                key={item.href}
                href={item.href}
                label={item.title}
                active={isActive(item.href)}
              />
            ))}
          </nav>
          <div className="border-border/70 bg-card/80 text-muted-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
            <Compass className="size-3.5" aria-hidden="true" />
            NM-PT01
          </div>
        </div>
        <nav
          className="flex gap-2 overflow-x-auto pb-3 md:hidden"
          aria-label="Primary navigation mobile"
        >
          {siteConfig.primaryNav.map((item) => (
            <HeaderLink
              key={item.href}
              href={item.href}
              label={item.title}
              active={isActive(item.href)}
            />
          ))}
        </nav>
      </MainContainer>
    </header>
  );
}
