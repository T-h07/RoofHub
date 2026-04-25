import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadPrimaryPublicCompanySlug } from "@/lib/company/public-profile";

export default async function PublicCompanyEntryPage() {
  const companyResult = await loadPrimaryPublicCompanySlug();

  if (companyResult.ok) {
    redirect(`/companies/${companyResult.slug}`);
  }

  return (
    <MainContainer size="content">
      <EmptyState
        icon={Building2}
        title="Company website is not live yet"
        description={
          companyResult.message ??
          "RoofHub will publish the company website here once the company profile is active."
        }
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/explore" className={buttonVariants({ size: "sm" })}>
              View listings
            </Link>
            <Link href="/map" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Open map
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
