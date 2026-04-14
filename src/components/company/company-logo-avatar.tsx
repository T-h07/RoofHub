"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type CompanyLogoAvatarProps = {
  name: string;
  logoUrl: string | null;
  className?: string;
  imageClassName?: string;
  initialsClassName?: string;
};

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);

  if (parts.length === 0) {
    return "RH";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export function CompanyLogoAvatar({
  name,
  logoUrl,
  className,
  imageClassName,
  initialsClassName,
}: CompanyLogoAvatarProps) {
  const [isBroken, setIsBroken] = useState(false);
  const initials = useMemo(() => toInitials(name), [name]);
  const showImage = Boolean(logoUrl) && !isBroken;

  return (
    <div
      className={cn(
        "border-border/75 bg-card relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-[0_18px_30px_-24px_color-mix(in_oklch,var(--nav-background)_36%,transparent)]",
        className
      )}
    >
      {showImage && logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${name} logo`}
          fill
          unoptimized
          sizes="160px"
          className={cn("h-full w-full object-cover", imageClassName)}
          onError={() => setIsBroken(true)}
        />
      ) : (
        <div
          className={cn(
            "from-primary/20 to-accent/18 text-foreground flex h-full w-full items-center justify-center bg-gradient-to-br text-xl font-semibold tracking-tight",
            initialsClassName
          )}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
