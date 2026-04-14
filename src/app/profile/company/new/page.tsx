import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Building2 } from "lucide-react";

import { CompanyWorkspaceCreateForm } from "@/components/company/company-workspace-create-form";
import { MainContainer } from "@/components/layout/main-container";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function CompanyWorkspaceCreatePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile/company/new"));
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (!companyContextResult.ok) {
    return (
      <MainContainer size="content">
        <EmptyState
          icon={Building2}
          title="Company setup is unavailable"
          description={companyContextResult.message}
        />
      </MainContainer>
    );
  }

  if (companyContextResult.company.ownsWorkspace) {
    redirect("/profile/company");
  }

  return (
    <MainContainer size="content" className="space-y-4">
      <Link href="/profile/company" className={buttonVariants({ variant: "ghost", size: "sm" })}>
        <ArrowLeft className="size-4" />
        Back to company workspace
      </Link>
      <CompanyWorkspaceCreateForm />
    </MainContainer>
  );
}
