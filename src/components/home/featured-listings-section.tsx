import Link from "next/link";
import { ArrowRight, BedDouble, Bath, Expand } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const listingPlaceholders = [
  {
    id: "placeholder-rent-core",
    title: "City-core rental preview",
    intent: "Rent",
    priceLabel: "€1,980 / month",
    location: "Central district · Placeholder",
    details: ["2 beds", "1 bath", "74 m²"],
    href: "/explore?intent=rent",
  },
  {
    id: "placeholder-sale-family",
    title: "Family home sale preview",
    intent: "Sale",
    priceLabel: "€438,000",
    location: "Residential edge · Placeholder",
    details: ["3 beds", "2 baths", "132 m²"],
    href: "/explore?intent=sale",
  },
  {
    id: "placeholder-rent-balcony",
    title: "Balcony apartment preview",
    intent: "Rent",
    priceLabel: "€2,320 / month",
    location: "Transit corridor · Placeholder",
    details: ["2 beds", "2 baths", "88 m²"],
    href: "/explore?intent=rent",
  },
  {
    id: "placeholder-sale-townhouse",
    title: "Townhouse listing preview",
    intent: "Sale",
    priceLabel: "€512,000",
    location: "North quarter · Placeholder",
    details: ["4 beds", "3 baths", "165 m²"],
    href: "/explore?intent=sale",
  },
];

export function FeaturedListingsSection() {
  return (
    <Section
      eyebrow="Featured and new"
      title="Listing cards are ready for live data wiring"
      description="These cards intentionally mirror the upcoming listing surface so PT10 can plug real explore data into stable UI structure."
      action={
        <Link href="/explore" className={buttonVariants({ variant: "outline", size: "sm" })}>
          View all listings
        </Link>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {listingPlaceholders.map((listing) => (
          <Card key={listing.id} className="overflow-hidden">
            <div className="border-border/70 bg-muted/30 relative h-36 border-b">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(92,146,255,0.2),transparent_42%),linear-gradient(300deg,rgba(120,152,225,0.16),transparent_55%)]" />
              <div className="absolute top-3 right-3">
                <Badge variant="outline">Preview</Badge>
              </div>
            </div>

            <CardHeader>
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={listing.intent === "Rent" ? "primary" : "neutral"}>
                    {listing.intent}
                  </Badge>
                  <span className="type-caption">{listing.location}</span>
                </div>
                <CardTitle>{listing.title}</CardTitle>
                <CardDescription>{listing.priceLabel}</CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 pt-0">
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <BedDouble className="size-3.5" aria-hidden="true" />
                  {listing.details[0]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Bath className="size-3.5" aria-hidden="true" />
                  {listing.details[1]}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Expand className="size-3.5" aria-hidden="true" />
                  {listing.details[2]}
                </span>
              </div>

              <Link
                href={listing.href}
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                    size: "sm",
                  }),
                  "text-primary h-8 gap-1.5 px-0 hover:bg-transparent"
                )}
              >
                Open in explore
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  );
}
