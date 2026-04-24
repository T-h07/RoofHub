import Link from "next/link";
import { Building2, Globe, Mail, MapPin, PhoneCall } from "lucide-react";

import { PageIntro } from "@/components/layout/page-shell";
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
  const primaryDescription = supportingLabel ?? company.description;

  return (
    <PageIntro
      className={cn(className)}
      eyebrow={
        <>
          <Badge variant="primary">{contextLabel}</Badge>
          <Badge variant="outline">RoofHub company</Badge>
          {typeof listingCount === "number" ? (
            <Badge variant="outline">
              {new Intl.NumberFormat("en").format(listingCount)} public listing
              {listingCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </>
      }
      title={company.name}
      description={
        primaryDescription ?? "Add company identity details to keep governance and public presence aligned."
      }
      actions={actions}
      meta={
        <>
          <span className="text-muted-foreground border-border/70 bg-surface-soft rounded-full border px-2.5 py-1 text-xs font-medium tracking-tight">
            /companies/{company.slug}
          </span>
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
        </>
      }
    >
      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <CompanyLogoAvatar
          name={company.name}
          logoUrl={company.logoUrl}
          className="size-24 rounded-2xl sm:size-28"
          initialsClassName="text-xl"
        />

        <div className="space-y-3">
          {company.description && supportingLabel ? (
            <p className="text-foreground/92 max-w-3xl text-sm leading-6 whitespace-pre-wrap">
              {company.description}
            </p>
          ) : null}

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
        </div>
      </div>
    </PageIntro>
  );
}
