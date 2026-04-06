"use client";

import Link from "next/link";
import { Compass, LayoutGrid, Menu, Sparkles } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useActiveRoute } from "@/hooks/use-active-route";
import { signOutAction } from "@/lib/auth/actions";
import { siteConfig } from "@/lib/config/site";
import { cn } from "@/lib/utils";

function MobileNavLink({
  href,
  label,
  active,
  disabled,
}: {
  href: string;
  label: string;
  active: boolean;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="border-border/70 text-muted-foreground flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
        <span>{label}</span>
        <span className="border-border rounded-full border px-2 py-0.5 text-[0.64rem] font-semibold tracking-wider uppercase">
          Soon
        </span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

type MobileNavSheetProps = {
  authState: {
    isAuthenticated: boolean;
    email: string | null;
  };
};

export function MobileNavSheet({ authState }: MobileNavSheetProps) {
  const { isActive } = useActiveRoute();
  const isAuthenticated = authState.isAuthenticated;

  return (
    <Sheet>
      <SheetTrigger className={buttonVariants({ variant: "outline", size: "icon" })}>
        <Menu className="size-4" aria-hidden="true" />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="right" className="bg-popover/98">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-lg">
            <span className="bg-primary/20 text-primary inline-flex size-7 items-center justify-center rounded-md">
              <Compass className="size-4" />
            </span>
            {siteConfig.name}
          </SheetTitle>
          <SheetDescription className="text-muted-foreground text-sm">
            Route shell for preview and production workflows on Vercel.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <p className="type-label">Primary navigation</p>
            <nav className="space-y-2" aria-label="Mobile primary navigation">
              {siteConfig.primaryNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={item.href}
                  label={item.title}
                  active={isActive(item.href)}
                />
              ))}
            </nav>
          </div>

          <div className="space-y-2">
            <p className="type-label">Planned routes</p>
            <div className="space-y-2">
              {siteConfig.futureNav.map((item) => (
                <MobileNavLink
                  key={item.href}
                  href={item.href}
                  label={item.title}
                  active={false}
                  disabled
                />
              ))}
            </div>
          </div>

          <div className="border-border/70 bg-muted/25 rounded-lg border p-3">
            <div className="text-foreground mb-3 flex items-center gap-2 text-sm font-medium">
              <LayoutGrid className="text-primary size-4" />
              {isAuthenticated ? "Provider workflow placeholder" : "Account access"}
            </div>
            {isAuthenticated ? (
              <div className="space-y-2">
                <Link
                  href={siteConfig.ctaHref}
                  className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
                >
                  {siteConfig.ctaLabel}
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
                <form action={signOutAction} className="w-full">
                  <SignOutButton className="w-full" />
                </form>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/auth/sign-in"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "w-full justify-center"
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/sign-up"
                  className={cn(buttonVariants({ size: "sm" }), "w-full justify-center")}
                >
                  Create account
                  <Sparkles className="size-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
