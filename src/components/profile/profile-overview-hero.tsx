import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  getRoleLabel,
  isProviderRole,
  type AppRole,
} from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

import type {
  ProfileAccountSnapshot,
  ProfileExperience,
  ProfileExperienceMetric,
  ProfileSnapshot,
} from "./types";

function toInitials(displayName: string, role: AppRole) {
  const segments = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return role === "provider" ? "RP" : "RH";
  }

  return segments.map((segment) => segment[0]?.toUpperCase() ?? "").join("");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function pickMetricToneClass(tone: ProfileExperienceMetric["tone"]) {
  if (tone === "primary") {
    return "border-primary/45 bg-primary/10";
  }

  if (tone === "success") {
    return "border-emerald-500/45 bg-emerald-500/10";
  }

  if (tone === "warning") {
    return "border-warning/35 bg-warning/12";
  }

  return "border-border/70 bg-background/50";
}

type ProfileOverviewHeroProps = {
  profile: ProfileSnapshot;
  account: ProfileAccountSnapshot;
  experience: ProfileExperience;
};

export function ProfileOverviewHero({
  profile,
  account,
  experience,
}: ProfileOverviewHeroProps) {
  const isProvider = isProviderRole(profile.role);
  const displayedAvatarUrl = profile.avatarUrl;
  const profileImageInitials = toInitials(profile.displayName, profile.role);

  return (
    <section className="border-border bg-card relative overflow-hidden rounded-3xl border p-5 shadow-[0_28px_48px_-36px_color-mix(in_oklch,var(--nav-background)_40%,transparent)] sm:p-7">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-42",
          isProvider
            ? "bg-[linear-gradient(116deg,color-mix(in_oklch,var(--primary)_8%,transparent)_4%,transparent_64%),linear-gradient(340deg,color-mix(in_oklch,var(--accent)_7%,transparent)_0%,transparent_62%)]"
            : "bg-[linear-gradient(116deg,color-mix(in_oklch,var(--primary)_8%,transparent)_4%,transparent_64%),linear-gradient(338deg,color-mix(in_oklch,var(--warm-accent)_9%,transparent)_0%,transparent_62%)]"
        )}
      />
      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="type-label">RoofHub account hub</p>
            <Badge variant={isProvider ? "primary" : "neutral"}>{getRoleLabel(profile.role)}</Badge>
            <Badge variant="outline">Domain-scoped settings</Badge>
          </div>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div
              className={cn(
                "border-border/80 bg-card relative size-26 shrink-0 overflow-hidden rounded-full border shadow-[0_16px_28px_-20px_color-mix(in_oklch,var(--nav-background)_32%,transparent)]",
                isProvider
                  ? "ring-2 ring-color-mix(in_oklch,var(--primary)_34%,transparent)"
                  : "ring-2 ring-color-mix(in_oklch,var(--accent)_36%,transparent)"
              )}
            >
              {displayedAvatarUrl ? (
                <Image
                  src={displayedAvatarUrl}
                  alt={`Profile photo for ${profile.displayName}`}
                  fill
                  sizes="120px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-full items-center justify-center text-xl font-semibold tracking-tight",
                    isProvider
                      ? "bg-gradient-to-br from-primary/20 to-accent/18 text-foreground"
                      : "bg-gradient-to-br from-warm-accent/40 to-primary/16 text-foreground"
                  )}
                >
                  {profileImageInitials}
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="type-page-title">{profile.displayName}</h1>
              <p className="type-body-muted max-w-2xl">{experience.heroDescription}</p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span className="border-border/70 bg-surface-soft rounded-full border px-2.5 py-1">
                  {experience.roleDescriptor}
                </span>
                <span className="border-border/70 bg-surface-soft rounded-full border px-2.5 py-1">
                  Member since {formatDate(account.createdAt)}
                </span>
                <span className="border-border/70 bg-surface-soft rounded-full border px-2.5 py-1">
                  Updated {formatDate(account.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="border-border/75 bg-background/40">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="type-label">Profile completion</p>
                  <p className="text-sm font-semibold">{experience.completionSummary}</p>
                </div>
                <Badge variant={experience.completionPercent >= 80 ? "success" : "warning"}>
                  {experience.completionPercent}%
                </Badge>
              </div>
              <div className="bg-border/55 h-2 rounded-full">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    experience.completionPercent >= 80 ? "bg-success" : "bg-primary"
                  )}
                  style={{ width: `${Math.max(8, experience.completionPercent)}%` }}
                />
              </div>
              {experience.missingItems.length > 0 ? (
                <p className="text-muted-foreground text-xs leading-5">
                  Next improvements: {experience.missingItems.slice(0, 3).join(", ")}.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs leading-5">
                  Profile baseline is complete for current marketplace surfaces.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            {experience.metrics.map((metric) => (
              <div
                key={`${metric.label}-${metric.value}`}
                className={cn(
                  "rounded-xl border px-3.5 py-3 shadow-[0_14px_26px_-22px_color-mix(in_oklch,var(--nav-background)_26%,transparent)]",
                  pickMetricToneClass(metric.tone)
                )}
              >
                <p className="type-label">{metric.label}</p>
                <p className="mt-1 text-lg font-semibold tracking-tight">{metric.value}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-5">{metric.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
