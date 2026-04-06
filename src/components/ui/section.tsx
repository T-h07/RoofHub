import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Section({
  eyebrow,
  title,
  description,
  action,
  children,
  className,
}: SectionProps) {
  return (
    <section className={cn("space-y-5", className)}>
      <header className="border-border/70 flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? <p className="type-label">{eyebrow}</p> : null}
          <h2 className="type-section-title">{title}</h2>
          {description ? <p className="type-body-muted max-w-2xl">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      {children}
    </section>
  );
}
