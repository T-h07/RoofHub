import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Compass,
  MapPin,
  MessageSquareMore,
  UsersRound,
} from "lucide-react";

import { CompanyIdentityHeader } from "@/components/company/company-identity-header";
import { CompanyPublicListingsShell } from "@/components/company/company-public-listings-shell";
import { MainContainer } from "@/components/layout/main-container";
import { PageSection } from "@/components/layout/page-shell";
import { Badge } from "@/components/ui/badge";
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
  const contactHref = company.contact_email
    ? `mailto:${company.contact_email}`
    : company.contact_phone
      ? `tel:${company.contact_phone}`
      : "/explore";

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
        <p className="text-muted-foreground text-xs">RoofHub public company website</p>
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
        contextLabel="Public company website"
        supportingLabel="Browse the company's public inventory, service area, contact context, and inquiry path from one RoofHub website."
        listingCount={totalListings}
        actions={
          <>
            <Link href="#listings" className={buttonVariants({ size: "sm" })}>
              View listings
            </Link>
            <Link href={contactHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
              Contact company
            </Link>
          </>
        }
      />

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
        <PageSection
          eyebrow={<Badge variant="outline">Services</Badge>}
          title="Company real estate services"
          description="RoofHub keeps public discovery connected to the same company team that manages listing operations behind the scenes."
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "Rental search",
                detail: "Find available rentals with list and map context kept in sync.",
                icon: MapPin,
              },
              {
                title: "Homes for sale",
                detail: "Compare sale inventory by price, location, and property details.",
                icon: BriefcaseBusiness,
              },
              {
                title: "Inquiry handling",
                detail: "Send listing inquiries into the company's internal response workflow.",
                icon: MessageSquareMore,
              },
            ].map((service) => {
              const Icon = service.icon;

              return (
                <div
                  key={service.title}
                  className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3"
                >
                  <Icon className="text-primary size-4.5" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold tracking-tight">{service.title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">{service.detail}</p>
                </div>
              );
            })}
          </div>
        </PageSection>

        <PageSection
          eyebrow={<Badge variant="outline">Team</Badge>}
          title="One company team"
          description="Listing inquiries and public contact requests route back to the internal RoofHub workspace."
        >
          <div className="space-y-3">
            <div className="border-border/70 bg-surface-soft rounded-xl border px-3.5 py-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <UsersRound className="text-primary size-4" aria-hidden="true" />
                Company-managed response
              </p>
              <p className="text-muted-foreground mt-1 text-xs leading-5">
                The public website and internal operations workspace share one company context.
              </p>
            </div>
            <Link href={contactHref} className={buttonVariants({ size: "sm" })}>
              Contact company
            </Link>
          </div>
        </PageSection>
      </section>

      <CompanyPublicListingsShell
        id="listings"
        className="scroll-mt-24"
        companyName={company.name}
        listings={listings}
        isAuthenticated={Boolean(viewerUserId)}
      />
    </MainContainer>
  );
}
