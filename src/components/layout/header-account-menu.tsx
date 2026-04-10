"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown, Sparkles } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { getRoleLabel, type AppRole } from "@/lib/auth/roles";
import type { NavItem } from "@/types/navigation";
import { cn } from "@/lib/utils";

type HeaderAccountMenuProps = {
  accountLabel: string;
  role: AppRole | null;
  profileError: string | null;
  cta: {
    label: string;
    href: string;
  };
  links: NavItem[];
};

export function HeaderAccountMenu({
  accountLabel,
  role,
  profileError,
  cta,
  links,
}: HeaderAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "border-nav-muted/45 bg-nav-background/60 hover:bg-nav-active/24 inline-flex h-9 max-w-[15.5rem] items-center gap-2 rounded-lg border px-2.5 text-sm text-nav-foreground transition-colors",
          "focus-visible:ring-ring focus-visible:ring-offset-nav-background focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="min-w-0 text-left leading-none">
          <span className="block truncate text-xs font-semibold">{accountLabel}</span>
          <span className="text-nav-muted block truncate text-[11px]">
            {role ? `${getRoleLabel(role)} account` : "Signed-in account"}
          </span>
        </span>
        {profileError ? (
          <span className="text-destructive inline-flex size-4 items-center justify-center">
            <AlertTriangle className="size-3.5" />
          </span>
        ) : null}
        <ChevronDown
          className={cn("text-nav-muted size-4 shrink-0 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div className="border-border bg-popover/98 absolute top-full right-0 z-50 mt-2 w-[min(88vw,18rem)] rounded-xl border p-2.5 shadow-[0_20px_36px_-24px_color-mix(in_oklch,var(--nav-background)_44%,transparent)] backdrop-blur">
          {profileError ? (
            <div className="border-destructive/35 bg-destructive/8 mb-2 rounded-lg border px-2.5 py-2 text-xs leading-5 text-destructive">
              {profileError}
            </div>
          ) : null}

          <Link
            href={cta.href}
            onClick={() => setOpen(false)}
            className={cn(buttonVariants({ size: "sm" }), "mb-2 h-8 w-full justify-center gap-1.5")}
          >
            {cta.label}
            <Sparkles className="size-3.5" aria-hidden="true" />
          </Link>

          <div className="space-y-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "text-muted-foreground hover:bg-secondary hover:text-foreground block rounded-md px-2.5 py-2 text-sm transition-colors"
                )}
              >
                {link.title}
              </Link>
            ))}
          </div>

          <div className="border-border/65 mt-2 border-t pt-2">
            <form action={signOutAction} className="w-full">
              <SignOutButton className="w-full justify-center" />
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
