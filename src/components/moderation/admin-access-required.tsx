import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type AdminAccessRequiredProps = {
  title?: string;
  description?: string;
};

export function AdminAccessRequired({
  title = "Admin access required",
  description = "This moderation workspace is restricted to admin accounts.",
}: AdminAccessRequiredProps) {
  return (
    <MainContainer size="content">
      <EmptyState
        icon={ShieldAlert}
        title={title}
        description={description}
        action={
          <Link href="/profile" className={buttonVariants({ size: "sm" })}>
            Open profile
          </Link>
        }
      />
    </MainContainer>
  );
}
