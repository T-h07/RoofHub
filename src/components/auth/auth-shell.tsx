import type { ReactNode } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AuthShellProps = {
  badge: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

const trustNotes = [
  "Session-aware access keeps protected routes available only to signed-in users.",
  "Cookie-based authentication keeps account state consistent across page reloads.",
  "One account connects public favorites with internal workspace access when assigned.",
];

export function AuthShell({ badge, title, description, children, footer }: AuthShellProps) {
  return (
    <MainContainer size="content" className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[1.08fr_1fr]">
        <section className="border-border bg-card relative overflow-hidden rounded-2xl border p-6 shadow-[0_24px_42px_-34px_color-mix(in_oklch,var(--nav-background)_36%,transparent)] sm:p-7">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_9%,transparent)_0%,transparent_64%),linear-gradient(334deg,color-mix(in_oklch,var(--warm-accent)_8%,transparent)_8%,transparent_62%)]" />
          <div className="relative space-y-5">
            <Badge variant="primary">{badge}</Badge>
            <div className="space-y-2.5">
              <h1 className="type-page-title max-w-xl">{title}</h1>
              <p className="type-body-muted max-w-lg">{description}</p>
            </div>
            <div className="space-y-2.5">
              {trustNotes.map((note) => (
                <div
                  key={note}
                  className="border-border/70 bg-background/46 text-muted-foreground flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm"
                >
                  <ShieldCheck className="text-primary mt-0.5 size-4 shrink-0" />
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <Card className="bg-card/78 h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <span className="bg-primary/18 text-primary inline-flex size-7 items-center justify-center rounded-md">
                <Sparkles className="size-4" />
              </span>
              Account access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-6">{children}</CardContent>
        </Card>
      </div>

      {footer ? <div className="type-caption text-center">{footer}</div> : null}
    </MainContainer>
  );
}
