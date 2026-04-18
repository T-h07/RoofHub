"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserProfile } from "@/lib/auth/profile";
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
import {
  createAdminSupabaseClient,
  SUPABASE_SERVICE_ROLE_ENV,
  SUPABASE_SERVER_URL_ENV,
} from "@/lib/supabase/admin";
import type { AppRole } from "@/lib/auth/roles";

type CreateOrganizationWorkspaceRpcRow = {
  organization_id: string;
  organization_slug: string;
  owner_member_id: string;
};

type CreateWorkspaceFallbackContext = {
  userId: string;
  currentRole: AppRole;
  name: string;
  description: string | null;
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

  if (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVICE_ROLE_ENV.toLowerCase())
  ) {
    return process.env.NODE_ENV === "production"
      ? "Company onboarding is temporarily unavailable because server configuration is incomplete."
      : `Company onboarding fallback requires ${SUPABASE_SERVICE_ROLE_ENV} in server runtime.`;
  }

  if (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVER_URL_ENV.toLowerCase())
  ) {
    return process.env.NODE_ENV === "production"
      ? "Company onboarding is temporarily unavailable because server configuration is incomplete."
      : `Company onboarding fallback requires ${SUPABASE_SERVER_URL_ENV} or NEXT_PUBLIC_SUPABASE_URL in server runtime.`;
  }

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

  if (normalized.includes("profile record is required")) {
    return "Profile setup must complete before company onboarding. Refresh and retry.";
  }

  if (normalized.includes("cannot create a company workspace from the current flow")) {
    return "This account role is not eligible for company onboarding in the current flow.";
  }

  if (normalized.includes("company workspace schema is out of date")) {
    return "Company workspace schema is out of date. Apply the latest Supabase migrations and retry.";
  }

  return "Company workspace creation failed. Please retry.";
}

function toTrafficErrorState(result: { message: string }): CompanyWorkspaceCreateActionState {
  return {
    status: "error",
    message: result.message,
  };
}

function normalizeWorkspaceSlugBase(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (normalized.length === 0) {
    return "company";
  }

  return normalized.slice(0, 48);
}

async function loadExistingOwnerWorkspace(
  adminSupabase: ReturnType<typeof createAdminSupabaseClient>,
  userId: string
): Promise<CreateOrganizationWorkspaceRpcRow | null> {
  const { data: ownerMembershipRow, error: membershipError } = await adminSupabase
    .from("organization_members")
    .select("id, organization_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("member_status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!ownerMembershipRow) {
    return null;
  }

  const { data: organizationRow, error: organizationError } = await adminSupabase
    .from("organizations")
    .select("id, slug")
    .eq("id", ownerMembershipRow.organization_id)
    .eq("status", "active")
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  if (!organizationRow) {
    return null;
  }

  return {
    organization_id: organizationRow.id,
    organization_slug: organizationRow.slug,
    owner_member_id: ownerMembershipRow.id,
  };
}

async function createCompanyWorkspaceWithAdminBootstrap(
  context: CreateWorkspaceFallbackContext
): Promise<CreateOrganizationWorkspaceRpcRow> {
  if (context.currentRole !== "seeker" && context.currentRole !== "provider") {
    throw new Error("This account role cannot create a company workspace from the current flow.");
  }

  const adminSupabase = createAdminSupabaseClient();
  const existingOwnerWorkspace = await loadExistingOwnerWorkspace(adminSupabase, context.userId);
  if (existingOwnerWorkspace) {
    return existingOwnerWorkspace;
  }

  const slugBase = normalizeWorkspaceSlugBase(context.name);
  let createdOrganization: { id: string; slug: string } | null = null;

  for (let suffix = 0; suffix <= 25; suffix += 1) {
    const candidateSlug =
      suffix === 0
        ? slugBase
        : `${slugBase.slice(0, Math.max(1, 48 - String(suffix).length - 1))}-${suffix}`;

    const { data, error } = await adminSupabase
      .from("organizations")
      .insert({
        name: context.name,
        slug: candidateSlug,
        description: context.description,
        created_by_user_id: context.userId,
        status: "active",
      })
      .select("id, slug")
      .single();

    if (!error && data) {
      createdOrganization = data;
      break;
    }

    if (error && error.code === "23505") {
      continue;
    }

    throw new Error(error?.message ?? "Failed to create organization workspace.");
  }

  if (!createdOrganization) {
    throw new Error("Unable to generate a unique organization identifier. Please retry.");
  }

  const { data: ownerMembership, error: membershipInsertError } = await adminSupabase
    .from("organization_members")
    .insert({
      organization_id: createdOrganization.id,
      user_id: context.userId,
      role: "owner",
      member_status: "active",
      invited_by_user_id: null,
    })
    .select("id")
    .single();

  if (membershipInsertError || !ownerMembership) {
    await adminSupabase.from("organizations").delete().eq("id", createdOrganization.id);
    throw new Error(membershipInsertError?.message ?? "Failed to bootstrap owner membership.");
  }

  const { error: profileUpdateError } = await adminSupabase
    .from("profiles")
    .update({
      role: "provider",
      provider_account_type: "company",
    })
    .eq("id", context.userId);

  if (profileUpdateError) {
    await adminSupabase.from("organization_members").delete().eq("id", ownerMembership.id);
    await adminSupabase.from("organizations").delete().eq("id", createdOrganization.id);
    throw new Error(profileUpdateError.message);
  }

  return {
    organization_id: createdOrganization.id,
    organization_slug: createdOrganization.slug,
    owner_member_id: ownerMembership.id,
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

  const { data, error } = await supabase
    .rpc("create_organization_workspace", {
      p_name: input.name,
      p_description: input.description ?? undefined,
    })
    .single<CreateOrganizationWorkspaceRpcRow>();
  let workspaceData = data ?? null;
  let workspaceError = error;

  if (workspaceError || !workspaceData) {
    if (workspaceError && workspaceError.message.toLowerCase().includes("already own")) {
      return {
        status: "success",
        message: "This account already owns a company workspace.",
        redirectTo: "/profile/company",
      };
    }

    try {
      workspaceData = await createCompanyWorkspaceWithAdminBootstrap({
        userId: profileResult.profile.id,
        currentRole: profileResult.profile.role,
        name: input.name,
        description: input.description,
      });
      workspaceError = null;
    } catch (fallbackError) {
      workspaceError = {
        code: workspaceError?.code ?? null,
        message:
          fallbackError instanceof Error
            ? fallbackError.message
            : workspaceError?.message ?? "Unknown create workspace failure.",
      } as typeof workspaceError;
    }
  }

  if (workspaceError || !workspaceData) {
    console.error("[Company][CreateWorkspace] failed", {
      user_id: profileResult.profile.id,
      error_code: workspaceError?.code ?? null,
      error_message: workspaceError?.message ?? "unknown",
      fallback_attempted: true,
    });

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
          reason_category: workspaceError?.code ?? "rpc_failed",
          error_message: workspaceError?.message ?? "Unknown create workspace failure.",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCreateWorkspaceError(workspaceError?.message ?? ""),
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationWorkspaceCreated,
      actorUserId: profileResult.profile.id,
      actorRole: "provider",
      targetType: "organization",
      targetId: workspaceData.organization_id,
      metadata: {
        organization_slug: workspaceData.organization_slug,
        owner_member_id: workspaceData.owner_member_id,
        flow: "profile_company_create",
        ...requestFingerprint,
      },
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/profile");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/edit");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/listings");
  revalidatePath(`/companies/${workspaceData.organization_slug}`);
  revalidatePath("/companies/[slug]", "page");

  return {
    status: "success",
    message: "Company workspace created successfully.",
    redirectTo: "/profile/company?status=created",
    organizationSlug: workspaceData.organization_slug,
  };
}
