import Link from "next/link";
import { LocateFixed, Search } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const quickSearchPaths = [
  {
    label: "Popular rentals",
    href: "/explore?intent=rent",
  },
  {
    label: "Homes for sale",
    href: "/explore?intent=sale",
  },
  {
    label: "Open map",
    href: "/map",
  },
];

export function HomeSearchCta() {
  return (
    <section className="border-border bg-surface-soft rounded-xl border p-4 shadow-[0_18px_30px_-24px_color-mix(in_oklch,var(--nav-background)_30%,transparent)] sm:p-5">
      <form action="/explore" className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[168px_minmax(0,1fr)_auto]">
          <div className="space-y-1.5">
            <label htmlFor="home-search-intent" className="type-label">
              Intent
            </label>
            <Select id="home-search-intent" name="intent" defaultValue="rent" aria-label="Intent">
              <option value="rent">Rent</option>
              <option value="sale">Buy</option>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="home-search-location" className="type-label">
              Location
            </label>
            <Input
              id="home-search-location"
              name="location"
              placeholder="City, neighborhood, or address"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <span className="type-label block opacity-0">Search</span>
            <Button type="submit" className="w-full md:w-auto">
              <Search className="size-4" aria-hidden="true" />
              Explore listings
            </Button>
          </div>
        </div>
      </form>

      <div className="border-border/70 mt-3.5 border-t pt-3.5">
        <p className="type-caption mb-2.5">Quick starts</p>
        <div className="flex flex-wrap items-center gap-2">
          {quickSearchPaths.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                buttonVariants({
                  size: "sm",
                  variant: "outline",
                }),
                "h-7 rounded-md px-2.5 text-xs"
              )}
            >
              {item.label}
            </Link>
          ))}

          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            <LocateFixed className="size-3.5" aria-hidden="true" />
            Map-first discovery
          </span>
        </div>
      </div>
    </section>
  );
}
