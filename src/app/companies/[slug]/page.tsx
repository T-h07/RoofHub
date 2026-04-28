import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Compass, MapPin } from "lucide-react";

import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyPublicListingsShell } from "@/components/company/company-public-listings-shell";
import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadPublicCompanyProfileBySlug } from "@/lib/company/public-profile";
import { cn } from "@/lib/utils";

type PublicCompanyPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function PublicCompanyPage({ params }: PublicCompanyPageProps) {
  const resolvedParams = await params;
  const companyResult = await loadPublicCompanyProfileBySlug(resolvedParams.slug);

  if (!companyResult.ok) {
    if (companyResult.reason === "not_found") {
      notFound();
    }

    return (
      <MainContainer size="content">
        <EmptyState
          icon={AlertTriangle}
          title="Company profile couldn’t load"
          description={companyResult.message}
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Link href="/explore" className={buttonVariants({ size: "sm" })}>
                Explore listings
              </Link>
              <Link href="/map" className={buttonVariants({ size: "sm", variant: "outline" })}>
                Open map
              </Link>
            </div>
          }
        />
      </MainContainer>
    );
  }

  const { company, listings, totalListings, viewerUserId } = companyResult;

  return (
    <MainContainer size="wide" className="space-y-5">
      <section className="border-border/70 bg-card/60 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/explore"
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 px-2.5 text-xs")}
          >
            <Compass className="size-3.5" />
            Back to explore
          </Link>
          <Link
            href="/map"
            className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "h-7 px-2.5 text-xs")}
          >
            <MapPin className="size-3.5" />
            Open map
          </Link>
        </div>
        <p className="text-muted-foreground text-xs">RoofHub company profile</p>
      </section>

      <CompanyIdentityHeader
        company={{
          name: company.name,
          slug: company.slug,
          description: company.description,
          logoUrl: company.logoUrl,
          contactEmail: company.contact_email,
          contactPhone: company.contact_phone,
          websiteUrl: company.website_url,
          coverageArea: company.coverage_area,
        }}
        contextLabel="Public company profile"
        supportingLabel="Review brand details, contact context, and current public inventory from this RoofHub company workspace."
        listingCount={totalListings}
      />

      <CompanyPublicListingsShell
        companyName={company.name}
        listings={listings}
        isAuthenticated={Boolean(viewerUserId)}
      />
    </MainContainer>
  );
}
