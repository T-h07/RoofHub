"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserCompanyContext } from "@/lib/company/context";
import {
  COMPANY_LOGO_ACTION_IDLE_STATE,
  COMPANY_PROFILE_IDLE_STATE,
  type CompanyLogoActionState,
  type CompanyProfileActionState,
} from "@/lib/company/types";
import { readCompanyProfileInput, validateCompanyProfileInput } from "@/lib/company/validation";
import {
  AUDIT_EVENT_TYPES,
  getAuditRequestFingerprint,
  recordSecurityAuditEvent,
} from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";
import { removeCompanyLogoByPath, uploadCompanyLogo } from "@/lib/supabase/storage/company-logos";

function toProfileValidationErrorState(
  errors: CompanyProfileActionState["errors"]
): CompanyProfileActionState {
  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    errors,
  };
}

function toCompanyProfileUpdateError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to update this company profile.";
  }

  if (normalized.includes("check constraint") || normalized.includes("violates check")) {
    return "One or more company profile values are invalid. Review your inputs and retry.";
  }

  return "Company profile update failed. Please retry.";
}

function toCompanyLogoUploadError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("unsupported logo")) {
    return "Use a JPEG, PNG, or WEBP logo image.";
  }

  if (normalized.includes("exceeds max size")) {
    return "Company logo is too large. Max allowed size is 5MB.";
  }

  if (normalized.includes("mime type does not match")) {
    return "Company logo format could not be verified. Choose a different image.";
  }

  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return "Company logo storage is not configured yet. Apply the latest migrations and retry.";
  }

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to update this company logo.";
  }

  return "Company logo update failed. Please retry.";
}

function toTrafficErrorState(result: { message: string }): CompanyProfileActionState {
  return {
    status: "error",
    message: result.message,
  };
}

async function enforceCompanyProfileTrafficControl(input: {
  userId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}) {
  return enforceTrafficControl({
    supabase: input.supabase,
    rule: TRAFFIC_CONTROL_RULES.companyProfileUpdatePerUser,
    identity: {
      userId: input.userId,
      includeIp: false,
    },
    throttledMessage: "Too many company profile updates from this account.",
    unavailableMessage:
      "Company profile updates are temporarily unavailable. Please retry shortly.",
  });
}

async function enforceCompanyLogoTrafficControl(input: {
  userId: string;
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
}) {
  return enforceTrafficControl({
    supabase: input.supabase,
    rule: TRAFFIC_CONTROL_RULES.companyLogoUpdatePerUser,
    identity: {
      userId: input.userId,
      includeIp: false,
    },
    throttledMessage: "Too many company logo updates from this account.",
    unavailableMessage: "Company logo updates are temporarily unavailable. Please retry shortly.",
  });
}

function revalidateCompanyPaths(slug: string) {
  revalidatePath("/", "layout");
  revalidatePath("/profile/company");
  revalidatePath("/profile/company/edit");
  revalidatePath(`/companies/${slug}`);
  revalidatePath("/companies/[slug]", "page");
}

async function loadCurrentOwnerOrganization(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>
) {
  const companyContextResult = await getCurrentUserCompanyContext(supabase);

  if (!companyContextResult.ok) {
    return {
      ok: false as const,
      message: companyContextResult.message,
    };
  }

  const ownerOrganization = companyContextResult.company.ownerOrganization;
  if (!ownerOrganization) {
    return {
      ok: false as const,
      message:
        "You must create and own a company workspace before editing company profile details.",
    };
  }

  return {
    ok: true as const,
    profile: companyContextResult.profile,
    organization: ownerOrganization,
  };
}

export async function updateCompanyProfileAction(
  previousState: CompanyProfileActionState = COMPANY_PROFILE_IDLE_STATE,
  formData: FormData
): Promise<CompanyProfileActionState> {
  void previousState;
  const input = readCompanyProfileInput(formData);
  const validationErrors = validateCompanyProfileInput(input);

  if (Object.keys(validationErrors).length > 0) {
    return toProfileValidationErrorState(validationErrors);
  }

  const supabase = await createServerSupabaseClient();
  const ownerContext = await loadCurrentOwnerOrganization(supabase);
  if (!ownerContext.ok) {
    return {
      status: "error",
      message: ownerContext.message,
    };
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceCompanyProfileTrafficControl({
    supabase,
    userId: ownerContext.profile.id,
  });

  if (!trafficResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationProfileUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "rate_limited",
          ...requestFingerprint,
        },
      },
    });

    return toTrafficErrorState(trafficResult);
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      description: input.description,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      website_url: input.websiteUrl,
      coverage_area: input.coverageArea,
    })
    .eq("id", ownerContext.organization.id);

  if (error) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationProfileUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "failed",
          error_code: error.code ?? null,
          error_message: error.message,
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCompanyProfileUpdateError(error.message),
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationProfileUpdated,
      actorUserId: ownerContext.profile.id,
      actorRole: ownerContext.profile.role,
      targetType: "organization",
      targetId: ownerContext.organization.id,
      metadata: {
        organization_slug: ownerContext.organization.slug,
        flow: "profile_company_edit",
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyPaths(ownerContext.organization.slug);

  return {
    status: "success",
    message: "Company profile saved successfully.",
  };
}

export async function uploadCompanyLogoAction(
  previousState: CompanyLogoActionState = COMPANY_LOGO_ACTION_IDLE_STATE,
  formData: FormData
): Promise<CompanyLogoActionState> {
  void previousState;
  const file = formData.get("companyLogoFile");
  if (!(file instanceof File) || file.size <= 0) {
    return {
      status: "error",
      message: "Choose a company logo before uploading.",
    };
  }

  const supabase = await createServerSupabaseClient();
  const ownerContext = await loadCurrentOwnerOrganization(supabase);
  if (!ownerContext.ok) {
    return {
      status: "error",
      message: ownerContext.message,
    };
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceCompanyLogoTrafficControl({
    supabase,
    userId: ownerContext.profile.id,
  });

  if (!trafficResult.ok) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationLogoUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "rate_limited",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: trafficResult.message,
    };
  }

  try {
    const uploaded = await uploadCompanyLogo(supabase, {
      organizationId: ownerContext.organization.id,
      file,
    });

    const previousLogoPath = ownerContext.organization.logo_path;
    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        logo_path: uploaded.storagePath,
      })
      .eq("id", ownerContext.organization.id);

    if (updateError) {
      try {
        await removeCompanyLogoByPath(supabase, {
          organizationId: ownerContext.organization.id,
          storagePath: uploaded.storagePath,
        });
      } catch {
        // Best effort rollback of uploaded object when organization row update fails.
      }

      await recordSecurityAuditEvent({
        supabase,
        event: {
          eventType: AUDIT_EVENT_TYPES.organizationLogoUpdateFailed,
          actorUserId: ownerContext.profile.id,
          actorRole: ownerContext.profile.role,
          targetType: "organization",
          targetId: ownerContext.organization.id,
          metadata: {
            outcome: "failed",
            stage: "organization_row_update",
            error_code: updateError.code ?? null,
            error_message: updateError.message,
            ...requestFingerprint,
          },
        },
      });

      return {
        status: "error",
        message: toCompanyLogoUploadError(updateError.message),
      };
    }

    if (previousLogoPath && previousLogoPath !== uploaded.storagePath) {
      try {
        await removeCompanyLogoByPath(supabase, {
          organizationId: ownerContext.organization.id,
          storagePath: previousLogoPath,
        });
      } catch {
        // Non-fatal cleanup only.
      }
    }

    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationLogoUpdated,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          organization_slug: ownerContext.organization.slug,
          flow: "profile_company_logo_upload",
          ...requestFingerprint,
        },
      },
    });

    revalidateCompanyPaths(ownerContext.organization.slug);

    return {
      status: "success",
      message: "Company logo updated.",
    };
  } catch (error) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationLogoUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "failed",
          stage: "storage_upload",
          error_message: error instanceof Error ? error.message : "unknown_logo_upload_error",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCompanyLogoUploadError(error instanceof Error ? error.message : ""),
    };
  }
}

export async function removeCompanyLogoAction(
  previousState: CompanyLogoActionState = COMPANY_LOGO_ACTION_IDLE_STATE
): Promise<CompanyLogoActionState> {
  void previousState;

  const supabase = await createServerSupabaseClient();
  const ownerContext = await loadCurrentOwnerOrganization(supabase);
  if (!ownerContext.ok) {
    return {
      status: "error",
      message: ownerContext.message,
    };
  }

  const currentLogoPath = ownerContext.organization.logo_path;
  if (!currentLogoPath) {
    return {
      status: "success",
      message: "No company logo to remove.",
    };
  }

  const requestFingerprint = await getAuditRequestFingerprint();
  const trafficResult = await enforceCompanyLogoTrafficControl({
    supabase,
    userId: ownerContext.profile.id,
  });

  if (!trafficResult.ok) {
    return {
      status: "error",
      message: trafficResult.message,
    };
  }

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      logo_path: null,
    })
    .eq("id", ownerContext.organization.id);

  if (updateError) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationLogoUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "failed",
          stage: "organization_row_update",
          error_code: updateError.code ?? null,
          error_message: updateError.message,
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCompanyLogoUploadError(updateError.message),
    };
  }

  try {
    await removeCompanyLogoByPath(supabase, {
      organizationId: ownerContext.organization.id,
      storagePath: currentLogoPath,
    });
  } catch {
    // Non-fatal cleanup; logo is already detached from organization row.
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.organizationLogoRemoved,
      actorUserId: ownerContext.profile.id,
      actorRole: ownerContext.profile.role,
      targetType: "organization",
      targetId: ownerContext.organization.id,
      metadata: {
        organization_slug: ownerContext.organization.slug,
        flow: "profile_company_logo_remove",
        ...requestFingerprint,
      },
    },
  });

  revalidateCompanyPaths(ownerContext.organization.slug);

  return {
    status: "success",
    message: "Company logo removed.",
  };
}
