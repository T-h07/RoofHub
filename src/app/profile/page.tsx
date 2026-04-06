import { redirect } from "next/navigation";
import { BadgeCheck, UserRound } from "lucide-react";

import { MainContainer } from "@/components/layout/main-container";
import { ProfileForm } from "@/components/profile/profile-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { toSignInPath } from "@/lib/auth/routing";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getRoleLabel, isAdminRole } from "@/lib/auth/roles";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function ProfilePage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/profile"));
  }

  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return (
      <MainContainer size="content" className="space-y-6">
        <EmptyState
          icon={UserRound}
          title="Profile could not be loaded"
          description={profileResult.message}
        />
      </MainContainer>
    );
  }

  const profile = profileResult.profile;
  const role = profile.role;
  const roleBadgeVariant = isAdminRole(role)
    ? "warning"
    : role === "provider"
      ? "primary"
      : "neutral";

  return (
    <MainContainer size="content" className="space-y-6">
      <section className="border-border/80 bg-card/60 rounded-2xl border p-6 shadow-[0_18px_38px_-28px_rgba(5,10,26,0.95)] sm:p-7">
        <div className="space-y-3">
          <p className="type-label">Profile</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="type-page-title">Account profile</h1>
            <Badge variant={roleBadgeVariant}>{getRoleLabel(role)}</Badge>
          </div>
          <p className="type-body-muted max-w-2xl">
            Manage your public profile details and account role visibility. Security and permissions
            are enforced in Supabase RLS.
          </p>
        </div>
      </section>

      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="text-primary size-4.5" />
              Public profile settings
            </CardTitle>
            <CardDescription>
              These fields are used across marketplace identity surfaces in upcoming PTs.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileForm
            profile={{
              displayName: profile.display_name,
              role: profile.role,
              bio: profile.bio,
              phone: profile.phone,
              avatarUrl: profile.avatar_url,
              preferredContactMethod: profile.preferred_contact_method,
            }}
          />
        </CardContent>
      </Card>
    </MainContainer>
  );
}
