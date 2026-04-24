"use client";

import Link from "next/link";
import { MapPinned, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useActiveRoute } from "@/hooks/use-active-route";
import type { AppRole, ProviderAccountType } from "@/lib/auth/roles";
import type { OrganizationMemberRole } from "@/lib/company/team-types";
import { siteConfig } from "@/lib/config/site";
import { getCtaForViewer, getNavigationForViewer } from "@/lib/navigation/role-navigation";
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
        "focus-visible:ring-ring focus-visible:ring-offset-nav-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        active
          ? "bg-nav-active text-primary-foreground"
          : "text-nav-muted hover:bg-nav-active/24 hover:text-nav-foreground"
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
    providerAccountType: ProviderAccountType | null;
    companyMembershipRole: OrganizationMemberRole | null;
    profileError: string | null;
    unreadNotificationCount: number;
  };
};

export function SiteHeader({ authState }: SiteHeaderProps) {
  const { isActive } = useActiveRoute();
  const isAuthenticated = authState.isAuthenticated;
  const navigation = getNavigationForViewer({
    isAuthenticated,
    role: authState.role,
    providerAccountType: authState.providerAccountType,
    companyMembershipRole: authState.companyMembershipRole,
  });
  const cta = getCtaForViewer({
    isAuthenticated,
    role: authState.role,
    providerAccountType: authState.providerAccountType,
    companyMembershipRole: authState.companyMembershipRole,
  });
  const accountLabel = authState.displayName || authState.email || "Signed in";

  return (
    <header className="border-nav-active/20 bg-nav-background/96 text-nav-foreground sticky top-0 z-40 border-b backdrop-blur-md">
      <MainContainer>
        <div className="flex h-[4.5rem] items-center justify-between gap-3">
          <Link href="/" className="group inline-flex min-w-0 items-center gap-2.5">
            <span className="border-nav-active/45 bg-nav-active/22 text-nav-foreground group-hover:bg-nav-active/32 inline-flex size-8.5 shrink-0 items-center justify-center rounded-lg border transition-colors">
              <MapPinned className="size-4.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 leading-none">
              <span className="block truncate text-base font-semibold tracking-tight">
                {siteConfig.name}
              </span>
              <span className="text-nav-muted hidden truncate text-[11px] xl:block">
                Rentals and homes for sale
              </span>
            </span>
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 lg:flex" aria-label="Primary navigation">
            {navigation.primary.map((item) => (
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
                <NotificationBell
                  initialUnreadCount={authState.unreadNotificationCount}
                />
                <Link
                  href={cta.href}
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "hidden gap-1.5 xl:inline-flex shadow-none"
                  )}
                >
                  {cta.label}
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
                <HeaderAccountMenu
                  accountLabel={accountLabel}
                  role={authState.role}
                  providerAccountType={authState.providerAccountType}
                  profileError={authState.profileError}
                  cta={cta}
                  links={navigation.menu}
                />
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "border-nav-muted/45 bg-transparent text-nav-foreground hover:bg-nav-active/24 hover:text-nav-foreground"
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className={cn(buttonVariants({ size: "sm" }), "gap-1.5 shadow-none")}
                >
                  {cta.label}
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {isAuthenticated ? (
              <NotificationBell
                initialUnreadCount={authState.unreadNotificationCount}
                compact
              />
            ) : null}
            <MobileNavSheet authState={authState} />
          </div>
        </div>
      </MainContainer>
    </header>
  );
}
