import type { ComponentType, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type PageShellProps = {
  children: ReactNode;
  className?: string;
};

type PageActionRailProps = {
  children?: ReactNode;
  className?: string;
};

type PageIntroProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
  className?: string;
  tone?: "default" | "danger";
};

type PageSectionProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
};

type PageSummaryRowProps = {
  children: ReactNode;
  className?: string;
};

type PageSummaryCardProps = {
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  footer?: ReactNode;
  className?: string;
  tone?: "default" | "primary" | "danger";
};

type PageStateProps = React.ComponentProps<typeof EmptyState>;

type PageLoadingSkeletonProps = {
  className?: string;
  summaryCount?: number;
  sectionCount?: number;
};

export function PageShell({ children, className }: PageShellProps) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

export function PageActionRail({ children, className }: PageActionRailProps) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-center gap-2 lg:w-auto lg:max-w-[24rem] lg:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  meta,
  children,
  className,
  tone = "default",
}: PageIntroProps) {
  return (
    <section
      className={cn(
        "border-border/75 bg-card/60 relative overflow-hidden rounded-2xl border p-5 shadow-[0_26px_46px_-36px_color-mix(in_oklch,var(--nav-background)_40%,transparent)] sm:p-6",
        className
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-0 opacity-55",
          tone === "danger"
            ? "bg-[linear-gradient(118deg,color-mix(in_oklch,var(--destructive)_11%,transparent)_0%,transparent_58%),linear-gradient(330deg,color-mix(in_oklch,var(--accent)_10%,transparent)_0%,transparent_74%)]"
            : "bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_58%),linear-gradient(330deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_74%)]"
        )}
      />

      <div className="relative space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 space-y-3">
            {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
            <div className="space-y-2">
              <h1 className="type-page-title max-w-4xl">{title}</h1>
              {description ? <p className="type-body-muted max-w-3xl">{description}</p> : null}
            </div>
            {meta ? <div className="flex flex-wrap items-center gap-2.5">{meta}</div> : null}
          </div>
          <PageActionRail>{actions}</PageActionRail>
        </div>
        {children ? <div className="pt-1">{children}</div> : null}
      </div>
    </section>
  );
}

export function PageSection({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
  headerClassName,
  contentClassName,
}: PageSectionProps) {
  return (
    <Card className={cn("border-border/80 bg-card/88", className)}>
      <CardHeader className={cn("border-border/70 border-b pb-4", headerClassName)}>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            {eyebrow ? <div className="flex flex-wrap items-center gap-2">{eyebrow}</div> : null}
            <CardTitle className="text-xl">{title}</CardTitle>
            {description ? <CardDescription className="max-w-3xl">{description}</CardDescription> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      </CardHeader>
      <CardContent className={cn("pt-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

export function PageSummaryRow({ children, className }: PageSummaryRowProps) {
  return <section className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>{children}</section>;
}

export function PageSummaryCard({
  label,
  value,
  detail,
  icon: Icon,
  footer,
  className,
  tone = "default",
}: PageSummaryCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden border-border/75",
        tone === "primary" &&
          "bg-[linear-gradient(138deg,color-mix(in_oklch,var(--primary)_16%,var(--card))_0%,color-mix(in_oklch,var(--primary)_4%,var(--card))_100%)]",
        tone === "danger" &&
          "bg-[linear-gradient(138deg,color-mix(in_oklch,var(--destructive)_14%,var(--card))_0%,color-mix(in_oklch,var(--destructive)_4%,var(--card))_100%)]",
        tone === "default" && "bg-card/88",
        className
      )}
    >
      <CardHeader className="pb-2">
        <div className="text-muted-foreground inline-flex items-center gap-2 text-xs">
          {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
          {label}
        </div>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {(detail ?? footer) ? (
        <CardContent className="space-y-2 pt-0 text-xs text-muted-foreground">
          {detail ? <div className="leading-5">{detail}</div> : null}
          {footer ? <div>{footer}</div> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function PageState(props: PageStateProps) {
  return <EmptyState {...props} className={cn("bg-card/82", props.className)} />;
}

export function PageSectionEyebrow({
  badge,
  label,
}: {
  badge?: ReactNode;
  label: string;
}) {
  return (
    <>
      {badge}
      <Badge variant="outline">{label}</Badge>
    </>
  );
}

export function PageLoadingSkeleton({
  className,
  summaryCount = 3,
  sectionCount = 2,
}: PageLoadingSkeletonProps) {
  return (
    <PageShell className={className}>
      <section className="border-border/75 bg-card/58 animate-pulse space-y-3 rounded-2xl border p-5 sm:p-6">
        <div className="bg-muted/50 h-5 w-32 rounded-full" />
        <div className="bg-muted/50 h-8 w-3/4 rounded-md" />
        <div className="bg-muted/45 h-5 w-2/3 rounded-md" />
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="bg-muted/50 h-9 w-32 rounded-md" />
          <div className="bg-muted/45 h-9 w-28 rounded-md" />
        </div>
      </section>

      <PageSummaryRow>
        {Array.from({ length: summaryCount }).map((_, index) => (
          <div
            key={`page-summary-loading-${index}`}
            className="border-border/70 bg-card/52 animate-pulse space-y-2 rounded-xl border p-4"
          >
            <div className="bg-muted/45 h-3.5 w-2/5 rounded" />
            <div className="bg-muted/50 h-8 w-1/3 rounded" />
            <div className="bg-muted/40 h-3.5 w-3/5 rounded" />
          </div>
        ))}
      </PageSummaryRow>

      {Array.from({ length: sectionCount }).map((_, index) => (
        <section
          key={`page-section-loading-${index}`}
          className="border-border/75 bg-card/58 animate-pulse space-y-4 rounded-xl border p-5"
        >
          <div className="bg-muted/45 h-4 w-28 rounded" />
          <div className="bg-muted/50 h-6 w-2/5 rounded" />
          <div className="bg-muted/40 h-4 w-2/3 rounded" />
          <div className="space-y-3 pt-2">
            <div className="bg-muted/45 h-14 w-full rounded-xl" />
            <div className="bg-muted/40 h-14 w-full rounded-xl" />
          </div>
        </section>
      ))}
    </PageShell>
  );
}
