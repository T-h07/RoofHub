import Link from "next/link";

import { ArrowLeft, Sparkles } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type PlaceholderScreenProps = {
  eyebrow: string;
  title: string;
  description: string;
  upcoming: string[];
};

export function PlaceholderScreen({
  eyebrow,
  title,
  description,
  upcoming,
}: PlaceholderScreenProps) {
  return (
    <MainContainer size="content" className="space-y-8">
      <section className="border-border/75 bg-card/60 space-y-4 rounded-xl border p-6 shadow-[0_16px_34px_-24px_rgba(6,10,24,0.95)] sm:p-7">
        <Badge variant="primary">{eyebrow}</Badge>
        <h1 className="type-page-title max-w-3xl">{title}</h1>
        <p className="type-body-muted max-w-2xl">{description}</p>
        <Link
          href="/"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "inline-flex")}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to shell overview
        </Link>
      </section>

      <Card>
        <CardHeader>
          <div className="space-y-2">
            <Badge variant="neutral">Upcoming tracks</Badge>
            <CardTitle>Reserved for upcoming PT delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {upcoming.map((item) => (
            <div
              key={item}
              className="border-border/70 bg-muted/20 text-muted-foreground flex items-start gap-3 rounded-lg border px-3.5 py-2.5 text-sm"
            >
              <span className="bg-primary mt-1 inline-flex size-1.5 shrink-0 rounded-full" />
              <span>{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <EmptyState
        icon={Sparkles}
        title="No live feature surface in this route yet"
        description="This route exists to lock composition and navigation patterns before business logic lands."
      />
    </MainContainer>
  );
}
