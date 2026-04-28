import { redirect } from "next/navigation";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { getCompanyOperationalHomeForRole } from "@/lib/navigation/company-ia";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function CompanyShortcutPage() {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    redirect("/profile/company");
  }

  if (
    profileResult.profile.role !== "provider" ||
    profileResult.profile.provider_account_type !== "company"
  ) {
    redirect("/profile/company");
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (!companyContextResult.ok) {
    redirect("/profile/company");
  }

  if (companyContextResult.company.workspaceState !== "resolved") {
    redirect("/profile/company");
  }

  redirect(getCompanyOperationalHomeForRole(companyContextResult.company.activeMembership?.role ?? null));
}
