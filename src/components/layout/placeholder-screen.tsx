import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";

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
    <MainContainer className="space-y-8">
      <section className="border-border/70 bg-card/45 space-y-4 rounded-xl border p-6 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.9)] sm:p-8">
        <p className="text-primary/90 text-xs font-semibold tracking-[0.18em] uppercase">
          {eyebrow}
        </p>
        <h1 className="text-foreground max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-base leading-7">{description}</p>
        <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to foundation
        </Link>
      </section>

      <section className="border-border/70 bg-background/70 rounded-xl border p-6 sm:p-8">
        <h2 className="text-foreground text-sm font-semibold tracking-wide uppercase">
          Planned in upcoming PTs
        </h2>
        <ul className="mt-4 space-y-3">
          {upcoming.map((item) => (
            <li key={item} className="text-muted-foreground flex items-start gap-3 text-sm">
              <span
                className="bg-primary mt-1.5 inline-flex size-1.5 shrink-0 rounded-full"
                aria-hidden="true"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>
    </MainContainer>
  );
}
