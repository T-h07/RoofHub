"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserCompanyContext } from "@/lib/company/context";
import { canEditCompanyProfile } from "@/lib/company/permissions";
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
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
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

function encodeTextHex(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return Buffer.from(value, "utf8").toString("hex");
}

function toCompanyProfileUpdateError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to update this company profile.";
  }

  if (normalized.includes("check constraint") || normalized.includes("violates check")) {
    return "One or more company profile values are invalid. Review your inputs and retry.";
  }

  if (isMissingCompanyProfileColumnsError(message)) {
    return "Company profile schema is out of date. Apply the latest Supabase migrations and retry.";
  }

  return "Company profile update failed. Please retry.";
}

type CompanyProfileConstraintField =
  | "name"
  | "contactEmail"
  | "contactPhone"
  | "websiteUrl"
  | "coverageArea";

function resolveCompanyProfileConstraintField(message: string | null | undefined) {
  if (!message) {
    return null;
  }

  const normalized = message.toLowerCase();

  if (
    normalized.includes("organizations_name_not_blank") ||
    normalized.includes("company name must be")
  ) {
    return "name" as const;
  }

  if (
    normalized.includes("organizations_contact_email_not_blank") ||
    normalized.includes("organizations_contact_email_format")
  ) {
    return "contactEmail" as const;
  }

  if (
    normalized.includes("organizations_contact_phone_not_blank") ||
    normalized.includes("organizations_contact_phone_format")
  ) {
    return "contactPhone" as const;
  }

  if (
    normalized.includes("organizations_website_url_not_blank") ||
    normalized.includes("organizations_website_url_format")
  ) {
    return "websiteUrl" as const;
  }

  if (
    normalized.includes("organizations_coverage_area_not_blank") ||
    normalized.includes("organizations_coverage_area_length")
  ) {
    return "coverageArea" as const;
  }

  return null;
}

function toCompanyProfileConstraintErrorMessage(field: CompanyProfileConstraintField) {
  switch (field) {
    case "name":
      return "Company name must be 2-120 characters.";
    case "contactEmail":
      return "Enter a valid email address.";
    case "contactPhone":
      return "Enter a valid phone number.";
    case "websiteUrl":
      return "Enter a valid website URL that starts with http or https.";
    case "coverageArea":
      return "Coverage summary must be 220 characters or fewer.";
    default:
      return "Check the highlighted fields and try again.";
  }
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

  if (normalized.includes("supabase_service_role_key")) {
    return "Company logo updates require server admin Supabase credentials. Add SUPABASE_SERVICE_ROLE_KEY and retry.";
  }

  return "Company logo update failed. Please retry.";
}

function isMissingCompanyProfileColumnsError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("column") &&
    (normalized.includes("contact_email") ||
      normalized.includes("contact_phone") ||
      normalized.includes("website_url") ||
      normalized.includes("coverage_area"))
  );
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
  revalidatePath("/dashboard");
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

  const ownerMembership = companyContextResult.company.activeMembership;
  const ownerOrganization = companyContextResult.company.activeOrganization;
  if (
    !ownerMembership ||
    !ownerOrganization ||
    !canEditCompanyProfile(ownerMembership.role, ownerMembership.member_status)
  ) {
    return {
      ok: false as const,
      message:
        companyContextResult.company.workspaceState === "selection_required"
          ? "Select an active owner workspace before editing company profile details."
          : "You must create and own a company workspace before editing company profile details.",
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

  const { data: updatedOrganization, error } = await supabase
    .from("organizations")
    .update({
      name: input.name,
      description: input.description,
      contact_email: input.contactEmail,
      contact_phone: input.contactPhone,
      website_url: input.websiteUrl,
      coverage_area: input.coverageArea,
    })
    .eq("id", ownerContext.organization.id)
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[Company][Profile] update failed", {
      organization_id: ownerContext.organization.id,
      actor_user_id: ownerContext.profile.id,
      input_contact_email: input.contactEmail,
      input_contact_email_hex: encodeTextHex(input.contactEmail),
      input_contact_email_length: input.contactEmail?.length ?? 0,
      error_code: error.code ?? null,
      error_message: error.message,
      error_details: error.details ?? null,
      error_hint: error.hint ?? null,
    });

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

    const constraintField =
      resolveCompanyProfileConstraintField(error.message) ??
      resolveCompanyProfileConstraintField(error.details) ??
      resolveCompanyProfileConstraintField(error.hint);

    if (constraintField) {
      return toProfileValidationErrorState({
        [constraintField]: toCompanyProfileConstraintErrorMessage(constraintField),
      });
    }

    return {
      status: "error",
      message: toCompanyProfileUpdateError(error.message),
    };
  }

  if (!updatedOrganization) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.organizationProfileUpdateFailed,
        actorUserId: ownerContext.profile.id,
        actorRole: ownerContext.profile.role,
        targetType: "organization",
        targetId: ownerContext.organization.id,
        metadata: {
          outcome: "empty_update_result",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: "Company profile update was rejected for this account. Refresh and retry.",
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
    const adminSupabase = createAdminSupabaseClient();
    const uploaded = await uploadCompanyLogo(adminSupabase, {
      organizationId: ownerContext.organization.id,
      file,
    });

    const previousLogoPath = ownerContext.organization.logo_path;
    const { data: updatedOrganization, error: updateError } = await adminSupabase
      .from("organizations")
      .update({
        logo_path: uploaded.storagePath,
      })
      .eq("id", ownerContext.organization.id)
      .select("id")
      .limit(1)
      .maybeSingle();

    if (updateError) {
      try {
        await removeCompanyLogoByPath(adminSupabase, {
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

    if (!updatedOrganization) {
      try {
        await removeCompanyLogoByPath(adminSupabase, {
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
            outcome: "empty_update_result",
            stage: "organization_row_update",
            ...requestFingerprint,
          },
        },
      });

      return {
        status: "error",
        message: "Company logo update was rejected for this account. Refresh and retry.",
      };
    }

    if (previousLogoPath && previousLogoPath !== uploaded.storagePath) {
      try {
        await removeCompanyLogoByPath(adminSupabase, {
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
    console.error("[Company][Logo] upload failed", {
      organization_id: ownerContext.organization.id,
      actor_user_id: ownerContext.profile.id,
      error_message: error instanceof Error ? error.message : "unknown_logo_upload_error",
    });

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

  try {
    const adminSupabase = createAdminSupabaseClient();
    const { data: updatedOrganization, error: updateError } = await adminSupabase
      .from("organizations")
      .update({
        logo_path: null,
      })
      .eq("id", ownerContext.organization.id)
      .select("id")
      .limit(1)
      .maybeSingle();

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

    if (!updatedOrganization) {
      await recordSecurityAuditEvent({
        supabase,
        event: {
          eventType: AUDIT_EVENT_TYPES.organizationLogoUpdateFailed,
          actorUserId: ownerContext.profile.id,
          actorRole: ownerContext.profile.role,
          targetType: "organization",
          targetId: ownerContext.organization.id,
          metadata: {
            outcome: "empty_update_result",
            stage: "organization_row_update",
            ...requestFingerprint,
          },
        },
      });

      return {
        status: "error",
        message: "Company logo removal was rejected for this account. Refresh and retry.",
      };
    }

    try {
      await removeCompanyLogoByPath(adminSupabase, {
        organizationId: ownerContext.organization.id,
        storagePath: currentLogoPath,
      });
    } catch {
      // Non-fatal cleanup; logo is already detached from organization row.
    }
  } catch (error) {
    console.error("[Company][Logo] remove failed", {
      organization_id: ownerContext.organization.id,
      actor_user_id: ownerContext.profile.id,
      error_message: error instanceof Error ? error.message : "unknown_logo_remove_error",
    });

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
          stage: "logo_remove",
          error_message: error instanceof Error ? error.message : "unknown_logo_remove_error",
          ...requestFingerprint,
        },
      },
    });

    return {
      status: "error",
      message: toCompanyLogoUploadError(error instanceof Error ? error.message : ""),
    };
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
