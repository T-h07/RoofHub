import Image from "next/image";
import Link from "next/link";
import { Building2, ShieldCheck, UserRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type {
  PublicListingDetailAssignedAgent,
  PublicListingDetailCompany,
} from "@/lib/listings/public-listing-detail";
import { cn } from "@/lib/utils";

type ListingCompanyTrustPanelProps = {
  company: PublicListingDetailCompany;
  assignedAgent: PublicListingDetailAssignedAgent | null;
};

function toInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) {
    return "RH";
  }

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatPublishedListingCount(value: number | null) {
  if (value === null) {
    return "Published listings unavailable";
  }

  const formatted = new Intl.NumberFormat("en").format(value);
  return `${formatted} active listing${value === 1 ? "" : "s"}`;
}

export function ListingCompanyTrustPanel({
  company,
  assignedAgent,
}: ListingCompanyTrustPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Company trust</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="flex items-start gap-3">
          <div className="border-border/70 bg-background/70 relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                alt={`${company.name} logo`}
                fill
                sizes="48px"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs font-semibold tracking-tight">
                {toInitials(company.name)}
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-1">
            <Link
              href={`/companies/${company.slug}`}
              className="hover:text-primary inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold tracking-tight transition-colors"
            >
              <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{company.name}</span>
            </Link>

            <p className="text-muted-foreground text-xs">
              Company-backed listing identity on RoofHub.
            </p>
          </div>
        </div>

        <div className="border-border/70 bg-background/45 rounded-lg border px-3 py-2">
          <p className="text-foreground/90 text-xs font-medium tracking-tight">
            {formatPublishedListingCount(company.publishedListingCount)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Inventory count reflects currently published listings tied to this company workspace.
          </p>
        </div>

        {assignedAgent ? (
          <div className="border-border/70 bg-background/45 rounded-lg border px-3 py-2.5">
            <p className="text-xs font-medium tracking-tight">Assigned agent</p>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="border-border/70 bg-background relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full border">
                {assignedAgent.avatarUrl ? (
                  <Image
                    src={assignedAgent.avatarUrl}
                    alt={`Avatar for ${assignedAgent.displayName}`}
                    fill
                    sizes="32px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-[11px] font-semibold tracking-tight">
                    {toInitials(assignedAgent.displayName)}
                  </span>
                )}
              </div>
              <p className="text-sm leading-5">
                Listed by <span className="font-medium">{assignedAgent.displayName}</span> at{" "}
                <span className="font-medium">{company.name}</span>.
              </p>
            </div>
          </div>
        ) : (
          <div className="border-border/70 bg-background/45 rounded-lg border px-3 py-2.5">
            <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <UserRound className="size-3.5" aria-hidden="true" />
              No individual agent is publicly assigned for this listing.
            </p>
          </div>
        )}

        <div className="border-border/70 bg-background/50 rounded-lg border px-3 py-2 text-xs">
          <p className="inline-flex items-center gap-1.5 font-medium tracking-tight">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Company identity is sourced from trusted listing ownership data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/companies/${company.slug}`} className={cn(buttonVariants({ size: "sm" }), "h-8")}>
            View company profile
          </Link>
          <Link
            href="#more-from-company"
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8")}
          >
            More from this company
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
