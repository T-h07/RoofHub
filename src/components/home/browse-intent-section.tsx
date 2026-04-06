import Link from "next/link";
import { ArrowRight, Building2, Compass, Home, Map } from "lucide-react";

import { Section } from "@/components/ui/section";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const intentItems = [
  {
    title: "Rent a home",
    description:
      "Open rental-focused discovery with city and neighborhood intent carried into explore.",
    href: "/explore?intent=rent",
    ctaLabel: "Browse rentals",
    icon: Home,
  },
  {
    title: "Buy a property",
    description: "Start with sale inventory and compare locations before opening detail pages.",
    href: "/explore?intent=sale",
    ctaLabel: "Browse homes for sale",
    icon: Building2,
  },
  {
    title: "Explore on map",
    description:
      "Jump directly into map-first browsing when geography matters more than list order.",
    href: "/map",
    ctaLabel: "Open map workspace",
    icon: Map,
  },
  {
    title: "List your property",
    description:
      "Create your account and move into the provider flow as dashboard and listing tools expand.",
    href: "/auth/sign-up?next=%2Fdashboard",
    ctaLabel: "Start provider path",
    icon: Compass,
  },
];

export function BrowseIntentSection() {
  return (
    <Section
      eyebrow="Browse by intent"
      title="Choose the fastest path into NestMap"
      description="Each route is structured for a specific goal so first-time visitors can enter discovery without friction."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {intentItems.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.title}>
              <CardHeader>
                <div className="space-y-3">
                  <span className="border-primary/35 bg-primary/16 text-primary inline-flex size-9 items-center justify-center rounded-md border">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <CardTitle>{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <Link
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "inline-flex h-8 gap-1.5 px-3"
                  )}
                >
                  {item.ctaLabel}
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Section>
  );
}
