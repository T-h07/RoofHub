import Link from "next/link";
import { Building2, Globe, Mail, MapPin, PhoneCall } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CompanyLogoAvatar } from "@/components/company/company-logo-avatar";
import { cn } from "@/lib/utils";

type CompanyIdentityHeaderProps = {
  company: {
    name: string;
    slug: string;
    description: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    websiteUrl: string | null;
    coverageArea: string | null;
  };
  contextLabel: string;
  supportingLabel?: string;
  actions?: React.ReactNode;
  listingCount?: number | null;
  className?: string;
};

function trimOptionalValue(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function CompanyIdentityHeader({
  company,
  contextLabel,
  supportingLabel,
  actions,
  listingCount,
  className,
}: CompanyIdentityHeaderProps) {
  const contactEmail = trimOptionalValue(company.contactEmail);
  const contactPhone = trimOptionalValue(company.contactPhone);
  const coverageArea = trimOptionalValue(company.coverageArea);
  const websiteUrl = trimOptionalValue(company.websiteUrl);

  return (
    <section
      className={cn(
        "border-border bg-card relative overflow-hidden rounded-3xl border p-5 shadow-[0_26px_46px_-36px_color-mix(in_oklch,var(--nav-background)_42%,transparent)] sm:p-7",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(118deg,color-mix(in_oklch,var(--primary)_10%,transparent)_0%,transparent_58%),linear-gradient(334deg,color-mix(in_oklch,var(--accent)_12%,transparent)_0%,transparent_74%)] opacity-55" />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">{contextLabel}</Badge>
          <Badge variant="outline">RoofHub company</Badge>
          {typeof listingCount === "number" ? (
            <Badge variant="outline">
              {new Intl.NumberFormat("en").format(listingCount)} public listing
              {listingCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <CompanyLogoAvatar
            name={company.name}
            logoUrl={company.logoUrl}
            className="size-28 rounded-2xl sm:size-32"
            initialsClassName="text-2xl"
          />

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="type-page-title">{company.name}</h1>
                <span className="text-muted-foreground border-border/70 bg-surface-soft rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight">
                  /companies/{company.slug}
                </span>
              </div>

              {supportingLabel ? (
                <p className="type-body-muted max-w-3xl">{supportingLabel}</p>
              ) : null}
            </div>

            {company.description ? (
              <p className="text-foreground/92 max-w-3xl text-sm leading-6 whitespace-pre-wrap sm:text-base">
                {company.description}
              </p>
            ) : (
              <p className="type-body-muted max-w-3xl">
                Add a company description to explain your specialties, service standards, and
                operating neighborhoods.
              </p>
            )}

            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <div className="border-border/70 bg-surface-soft inline-flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <MapPin className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="type-label">Coverage</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    {coverageArea ?? "Add neighborhoods or service areas."}
                  </p>
                </div>
              </div>

              <div className="border-border/70 bg-surface-soft inline-flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <Mail className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="type-label">Contact email</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    {contactEmail ?? "Add a mailbox for inquiries."}
                  </p>
                </div>
              </div>

              <div className="border-border/70 bg-surface-soft inline-flex items-start gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <PhoneCall className="text-primary mt-0.5 size-4 shrink-0" />
                <div className="space-y-0.5">
                  <p className="type-label">Contact phone</p>
                  <p className="text-muted-foreground text-xs leading-5">
                    {contactPhone ?? "Add a direct phone contact."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {websiteUrl ? (
                <Link
                  href={websiteUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border/75 bg-surface-soft hover:border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  <Globe className="size-3.5" />
                  Visit website
                </Link>
              ) : (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <Building2 className="size-3.5" />
                  Website not added yet
                </span>
              )}

              {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
