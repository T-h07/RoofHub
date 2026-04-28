import { Bell } from "lucide-react";
import { redirect } from "next/navigation";

import { MainContainer } from "@/components/layout/main-container";
import { PageIntro, PageState } from "@/components/layout/page-shell";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { Badge } from "@/components/ui/badge";
import { toSignInPath } from "@/lib/auth/routing";
import {
  getCurrentUserNotificationPreferences,
  listCurrentUserNotifications,
} from "@/lib/notifications";
import { createServerSupabaseClient } from "@/lib/supabase";

export default async function NotificationsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(toSignInPath("/notifications"));
  }

  const notificationsResult = await listCurrentUserNotifications({
    limit: 250,
    scope: "all",
  });

  if (!notificationsResult.ok) {
    if (notificationsResult.requiresAuth) {
      redirect(toSignInPath("/notifications"));
    }

    return (
      <MainContainer size="content">
        <PageState
          icon={Bell}
          title="Notifications unavailable"
          description={notificationsResult.message}
        />
      </MainContainer>
    );
  }

  const preferenceResult = await getCurrentUserNotificationPreferences();

  if (!preferenceResult.ok) {
    if (preferenceResult.requiresAuth) {
      redirect(toSignInPath("/notifications"));
    }

    return (
      <MainContainer size="content">
        <PageState
          icon={Bell}
          title="Notification preferences unavailable"
          description={preferenceResult.message}
        />
      </MainContainer>
    );
  }

  return (
    <MainContainer size="wide" className="space-y-6">
      <PageIntro
        eyebrow={<Badge variant="primary">Notifications</Badge>}
        title="Attention and updates in one place"
        description="Review your latest RoofHub messages, listing workflow events, and company updates without losing role-aware context."
      />

      <NotificationCenter
        initialNotifications={notificationsResult.data.notifications}
        initialPreferences={preferenceResult.data.preferences}
      />
    </MainContainer>
  );
}
