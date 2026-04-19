import "server-only";

import { isAdminRole } from "@/lib/auth/roles";
import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { createServerSupabaseClient } from "@/lib/supabase";
import {
  canManageCompanyConversationRouting,
  getCompanyConversationQueueAccess,
} from "./authorization";

import type { MessagingFailure, MessagingResult } from "./types";

export type MessagingViewerContext = {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
    ? TResult extends { ok: true; profile: infer TProfile }
      ? TProfile
      : never
    : never;
} & (
  | {
      mode: "seeker";
      inbox: {
        viewerUserId: string;
        mode: "seeker";
        workspaceName: null;
        workspaceSlug: null;
        companyQueueAccess: null;
      };
    }
  | {
      mode: "individual_provider";
      inbox: {
        viewerUserId: string;
        mode: "individual_provider";
        workspaceName: null;
        workspaceSlug: null;
        companyQueueAccess: null;
      };
    }
  | {
      mode: "company_workspace";
      company: Awaited<
        ReturnType<typeof getCurrentUserCompanyContext>
      > extends infer TResult
        ? TResult extends { ok: true; company: infer TCompany }
          ? TCompany
          : never
        : never;
      organization: Awaited<
        ReturnType<typeof getCurrentUserCompanyContext>
      > extends infer TResult
        ? TResult extends {
            ok: true;
            company: { activeOrganization: infer TOrganization };
          }
          ? NonNullable<TOrganization>
          : never
        : never;
      membership: Awaited<
        ReturnType<typeof getCurrentUserCompanyContext>
      > extends infer TResult
        ? TResult extends {
            ok: true;
            company: { activeMembership: infer TMembership };
          }
          ? NonNullable<TMembership>
          : never
        : never;
      inbox: {
        viewerUserId: string;
        mode: "company_workspace";
        workspaceName: string;
        workspaceSlug: string;
        companyQueueAccess: "company_queue" | "assigned_only";
      };
      canManageRouting: boolean;
    }
);

function toFailure(code: MessagingFailure["code"], message: string): MessagingFailure {
  return {
    ok: false,
    code,
    message,
    requiresAuth: code === "auth_required",
  };
}

export function toMessagingFailure(
  code: MessagingFailure["code"],
  message: string
): MessagingFailure {
  return toFailure(code, message);
}

export async function getMessagingViewerContext(): Promise<MessagingResult<MessagingViewerContext>> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return toFailure("auth_required", "Sign in to access conversations.");
  }

  const profileResult = await getCurrentUserProfile(supabase);
  if (!profileResult.ok) {
    return toFailure("internal", profileResult.message);
  }

  if (isAdminRole(profileResult.profile.role)) {
    return toFailure(
      "forbidden",
      "Messaging access is limited to seeker and provider participant accounts."
    );
  }

  if (profileResult.profile.role === "seeker") {
    return {
      ok: true,
      data: {
        supabase,
        profile: profileResult.profile,
        mode: "seeker",
        inbox: {
          viewerUserId: profileResult.profile.id,
          mode: "seeker",
          workspaceName: null,
          workspaceSlug: null,
          companyQueueAccess: null,
        },
      },
    };
  }

  if (profileResult.profile.provider_account_type !== "company") {
    return {
      ok: true,
      data: {
        supabase,
        profile: profileResult.profile,
        mode: "individual_provider",
        inbox: {
          viewerUserId: profileResult.profile.id,
          mode: "individual_provider",
          workspaceName: null,
          workspaceSlug: null,
          companyQueueAccess: null,
        },
      },
    };
  }

  const companyContextResult = await getCurrentUserCompanyContext(supabase);
  if (!companyContextResult.ok) {
    return toFailure("internal", companyContextResult.message);
  }

  if (
    !companyContextResult.company.activeOrganization ||
    !companyContextResult.company.activeMembership
  ) {
    return toFailure(
      "forbidden",
      companyContextResult.company.workspaceState === "selection_required"
        ? "Select an active RoofHub company workspace before opening the company inbox."
        : "An active RoofHub company membership is required to access company conversations."
    );
  }

  const queueAccess = getCompanyConversationQueueAccess(
    companyContextResult.company.activeMembership.role,
    companyContextResult.company.activeMembership.member_status
  );

  if (!queueAccess) {
    return toFailure(
      "forbidden",
      "An active RoofHub company membership is required to access company conversations."
    );
  }

  return {
    ok: true,
    data: {
      supabase,
      profile: profileResult.profile,
      mode: "company_workspace",
      company: companyContextResult.company,
      organization: companyContextResult.company.activeOrganization,
      membership: companyContextResult.company.activeMembership,
      inbox: {
        viewerUserId: profileResult.profile.id,
        mode: "company_workspace",
        workspaceName: companyContextResult.company.activeOrganization.name,
        workspaceSlug: companyContextResult.company.activeOrganization.slug,
        companyQueueAccess: queueAccess,
      },
      canManageRouting: canManageCompanyConversationRouting(
        companyContextResult.company.activeMembership.role,
        companyContextResult.company.activeMembership.member_status
      ),
    },
  };
}
