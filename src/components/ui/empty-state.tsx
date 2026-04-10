import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <section
      className={cn(
        "border-border/70 bg-surface-soft rounded-xl border px-6 py-9 text-center shadow-[0_12px_28px_-26px_color-mix(in_oklch,var(--nav-background)_32%,transparent)]",
        className
      )}
    >
      {Icon ? (
        <div className="bg-warm-accent text-warm-accent-foreground mx-auto mb-4 inline-flex size-10 items-center justify-center rounded-full">
          <Icon className="size-4.5" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="type-card-title">{title}</h3>
      <p className="text-muted-foreground mx-auto mt-2 max-w-md text-sm leading-6">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </section>
  );
}
