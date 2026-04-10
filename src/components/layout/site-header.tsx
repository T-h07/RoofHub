"use client";

import Link from "next/link";
import { MapPinned, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useActiveRoute } from "@/hooks/use-active-route";
import type { AppRole } from "@/lib/auth/roles";
import { siteConfig } from "@/lib/config/site";
import { getCtaForViewer, getPrimaryNavForViewer } from "@/lib/navigation/role-navigation";
import type { NavItem } from "@/types/navigation";
import { cn } from "@/lib/utils";

import { HeaderAccountMenu } from "./header-account-menu";
import { MainContainer } from "./main-container";
import { MobileNavSheet } from "./mobile-nav-sheet";

function HeaderLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
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

type SiteHeaderProps = {
  authState: {
    isAuthenticated: boolean;
    email: string | null;
    displayName: string | null;
    role: AppRole | null;
    profileError: string | null;
  };
};

const DESKTOP_PRIMARY_ROUTES = new Set(["/explore", "/map", "/dashboard", "/admin/moderation"]);

function getDesktopPrimaryNav(nav: NavItem[]) {
  return nav.filter((item) => DESKTOP_PRIMARY_ROUTES.has(item.href));
}

function getAccountMenuNav(nav: NavItem[]) {
  return nav.filter((item) => item.href !== "/" && !DESKTOP_PRIMARY_ROUTES.has(item.href));
}

export function SiteHeader({ authState }: SiteHeaderProps) {
  const { isActive } = useActiveRoute();
  const isAuthenticated = authState.isAuthenticated;
  const primaryNav = getPrimaryNavForViewer({
    isAuthenticated,
    role: authState.role,
  });
  const cta = getCtaForViewer({
    isAuthenticated,
    role: authState.role,
  });
  const desktopPrimaryNav = getDesktopPrimaryNav(primaryNav);
  const accountMenuNav = getAccountMenuNav(primaryNav);
  const accountLabel = authState.displayName || authState.email || "Signed in";

  return (
    <header className="border-border/70 bg-background/90 sticky top-0 z-40 border-b backdrop-blur-md">
      <MainContainer>
        <div className="flex h-[4.5rem] items-center justify-between gap-3">
          <Link href="/" className="group inline-flex min-w-0 items-center gap-2.5">
            <span className="border-primary/45 bg-primary/16 text-primary group-hover:bg-primary/24 inline-flex size-8.5 shrink-0 items-center justify-center rounded-lg border transition-colors">
              <MapPinned className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-none">
              <span className="block truncate text-base font-semibold tracking-tight">
                {siteConfig.name}
              </span>
              <span className="text-muted-foreground hidden truncate text-[11px] xl:block">
                Map-first marketplace
              </span>
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Primary navigation">
            {desktopPrimaryNav.map((item) => (
              <HeaderLink
                key={item.href}
                href={item.href}
                label={item.title}
                active={isActive(item.href)}
              />
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <>
                <Link
                  href={cta.href}
                  className={cn(buttonVariants({ size: "sm" }), "hidden gap-1.5 xl:inline-flex")}
                >
                  {cta.label}
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
                <HeaderAccountMenu
                  accountLabel={accountLabel}
                  role={authState.role}
                  profileError={authState.profileError}
                  cta={cta}
                  links={accountMenuNav}
                />
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}
                >
                  {cta.label}
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>

          <div className="lg:hidden">
            <MobileNavSheet authState={authState} />
          </div>
        </div>
      </MainContainer>
    </header>
  );
}
