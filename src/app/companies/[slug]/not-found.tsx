import Link from "next/link";
import { Building2 } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function CompanyProfileNotFound() {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={Building2}
        title="Company profile not found"
        description="This RoofHub company profile does not exist or is currently unavailable."
        action={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link href="/explore" className={buttonVariants({ size: "sm" })}>
              Explore listings
            </Link>
            <Link
              href="/profile/company"
              className={buttonVariants({ size: "sm", variant: "outline" })}
            >
              Company workspace
            </Link>
          </div>
        }
      />
    </MainContainer>
  );
}
