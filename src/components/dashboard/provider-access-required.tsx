import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type ProviderAccessRequiredProps = {
  title?: string;
  description?: string;
};

export function ProviderAccessRequired({
  title = "Provider access required",
  description = "Switch your profile role to provider before creating and managing listing drafts.",
}: ProviderAccessRequiredProps) {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={ShieldAlert}
        title={title}
        description={description}
        action={
          <Link href="/profile" className={buttonVariants({ size: "sm" })}>
            Update profile role
          </Link>
        }
      />
    </MainContainer>
  );
}

