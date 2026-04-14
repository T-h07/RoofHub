"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { getCompanyMembershipContextForUser } from "@/lib/company/context";
import {
  COMPANY_WORKSPACE_CREATE_IDLE_STATE,
  type CompanyWorkspaceCreateActionState,
} from "@/lib/company/types";
import { readCompanyWorkspaceInput, validateCompanyWorkspaceInput } from "@/lib/company/validation";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";

type CreateOrganizationWorkspaceRpcRow = {
  organization_id: string;
  organization_slug: string;
  owner_member_id: string;
};

function toValidationErrorState(
  errors: CompanyWorkspaceCreateActionState["errors"]
): CompanyWorkspaceCreateActionState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    errors,
  };
}

function toCreateWorkspaceError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("already own")) {
    return "This account already owns a company workspace.";
  }

  if (normalized.includes("between 2 and 120")) {
    return "Company name must be between 2 and 120 characters.";
  }

  if (normalized.includes("600 characters")) {
    return "Company description must be 600 characters or fewer.";
  }

  if (
    normalized.includes("permission denied") ||
    normalized.includes("row-level security") ||
    normalized.includes("authentication required")
  ) {
    return "You are not authorized to create a company workspace from this session.";
  }

  if (normalized.includes("unique organization identifier")) {
    return "A workspace identifier could not be generated. Please retry.";
  }

  return "Company workspace creation failed. Please retry.";
}

function toTrafficErrorState(result: { message: string }): CompanyWorkspaceCreateActionState {
  return {
    status: "error",
    message: result.message,
  };
}

export async function createCompanyWorkspaceAction(
  previousState: CompanyWorkspaceCreateActionState = COMPANY_WORKSPACE_CREATE_IDLE_STATE,
  formData: FormData
): Promise<CompanyWorkspaceCreateActionState> {
  void previousState;
  const requestFingerprint = await getAuditRequestFingerprint();
  const input = readCompanyWorkspaceInput(formData);
  const validationErrors = validateCompanyWorkspaceInput(input);

  if (Object.keys(validationErrors).length > 0) {
    return toValidationErrorState(validationErrors);
  }

  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      status: "error",
      message: profileResult.message,
    };
  }

  const ipControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.companyWorkspaceCreatePerIp,
    identity: { includeIp: true },
    throttledMessage: "Too many company workspace setup attempts from this connection.",
    unavailableMessage: "Workspace setup is temporarily unavailable. Please retry shortly.",
  });

  if (!ipControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationWorkspaceCreateFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "organization",
        targetId: "create_workspace",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "ip",
          ...requestFingerprint,
        },
      },
    });

    return toTrafficErrorState(ipControl);
  }

  const userControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.companyWorkspaceCreatePerUser,
    identity: {
      userId: profileResult.profile.id,
      includeIp: false,
    },
    throttledMessage: "Too many workspace setup attempts for this account.",
    unavailableMessage: "Workspace setup is temporarily unavailable. Please retry shortly.",
  });

  if (!userControl.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationWorkspaceCreateFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "organization",
        targetId: "create_workspace",
        metadata: {
          outcome: "rate_limited",
          limit_scope: "user",
          ...requestFingerprint,
        },
      },
    });

    return toTrafficErrorState(userControl);
  }

  const companyContextResult = await getCompanyMembershipContextForUser(
    supabase,
    profileResult.profile.id
  );
  if (!companyContextResult.ok) {
    return {
      status: "error",
      message: companyContextResult.message,
    };
  }

  if (companyContextResult.ownsWorkspace && companyContextResult.ownerOrganization) {
    return {
      status: "success",
      message: "This account already owns a company workspace.",
      redirectTo: "/profile/company",
      organizationSlug: companyContextResult.ownerOrganization.slug,
    };
  }

  const { data, error } = await supabase
    .rpc("create_organization_workspace", {
      p_name: input.name,
      p_description: input.description ?? undefined,
    })
    .single<CreateOrganizationWorkspaceRpcRow>();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationWorkspaceCreateFailed,
        actorUserId: profileResult.profile.id,
        actorRole: profileResult.profile.role,
        targetType: "organization",
        targetId: "create_workspace",
        metadata: {
          outcome: "failed",
          reason_category: error?.code ?? "rpc_failed",
          error_message: error?.message ?? "Unknown create workspace failure.",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCreateWorkspaceError(error?.message ?? ""),
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationWorkspaceCreated,
      actorUserId: profileResult.profile.id,
      actorRole: "provider",
      targetType: "organization",
      targetId: data.organization_id,
      metadata: {
        organization_slug: data.organization_slug,
        owner_member_id: data.owner_member_id,
        flow: "profile_company_create",
        ...requestFingerprint,
      },
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/edit");
  revalidatePath(`/companies/${data.organization_slug}`);
  revalidatePath("/companies/[slug]", "page");

  return {
    status: "success",
    message: "Company workspace created successfully.",
    redirectTo: "/profile/company?status=created",
    organizationSlug: data.organization_slug,
  };
}
