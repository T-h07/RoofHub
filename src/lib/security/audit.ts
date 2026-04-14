import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import { createServerSupabaseClient } from "@/lib/supabase";
import type { Database, Enums, Json } from "@/types/database";

const SENSITIVE_METADATA_KEY_PATTERN =
  /password|passphrase|token|secret|cookie|authorization|api[_-]?key|service[_-]?role|code[_-]?verifier|client[_-]?secret/i;
const JWT_LIKE_TOKEN_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/;
const BEARER_TOKEN_PATTERN = /^bearer\s+[a-z0-9\-_~=+/.:]+$/i;

const MAX_METADATA_DEPTH = 4;
const MAX_METADATA_STRING_LENGTH = 320;
const MAX_METADATA_ARRAY_LENGTH = 20;
const MAX_METADATA_KEYS = 40;

export const AUDIT_EVENT_TYPES = {
  authSignInSucceeded: "auth.sign_in.succeeded",
  authSignInFailed: "auth.sign_in.failed",
  authSignUpCompleted: "auth.sign_up.completed",
  authSignUpPendingVerification: "auth.sign_up.pending_verification",
  authSignUpFailed: "auth.sign_up.failed",
  authPasswordResetRequested: "auth.password_reset.requested",
  authPasswordResetCompleted: "auth.password_reset.completed",
  authSignOut: "auth.sign_out.completed",
  authOAuthStartInitiated: "auth.oauth.start.initiated",
  authOAuthStartFailed: "auth.oauth.start.failed",
  authCallbackSucceeded: "auth.callback.succeeded",
  authCallbackFailed: "auth.callback.failed",
  authProfileBootstrapFailed: "auth.profile_bootstrap.failed",
  profileRoleChanged: "profile.role.changed",
  organizationWorkspaceCreated: "organization.workspace.created",
  organizationWorkspaceCreateFailed: "organization.workspace.create_failed",
  organizationProfileUpdated: "organization.profile.updated",
  organizationProfileUpdateFailed: "organization.profile.update_failed",
  organizationLogoUpdated: "organization.logo.updated",
  organizationLogoRemoved: "organization.logo.removed",
  organizationLogoUpdateFailed: "organization.logo.update_failed",
  organizationInviteCreated: "organization.invite.created",
  organizationInviteCreateFailed: "organization.invite.create_failed",
  organizationInviteAccepted: "organization.invite.accepted",
  organizationInviteAcceptFailed: "organization.invite.accept_failed",
  organizationInviteRevoked: "organization.invite.revoked",
  organizationInviteRevokeFailed: "organization.invite.revoke_failed",
  organizationMemberRoleChanged: "organization.member.role_changed",
  organizationMemberRoleChangeFailed: "organization.member.role_change_failed",
  organizationMemberSuspended: "organization.member.suspended",
  organizationMemberReactivated: "organization.member.reactivated",
  organizationMemberStatusUpdateFailed: "organization.member.status_update_failed",
  organizationMemberRemoved: "organization.member.removed",
  organizationMemberRemoveFailed: "organization.member.remove_failed",
  listingDraftCreated: "provider.listing_draft.created",
  listingDraftStepSaved: "provider.listing_draft.step_saved",
  listingPhotosSynced: "provider.listing_photos.synced",
  listingPublished: "provider.listing.published",
  listingPublishFailed: "provider.listing.publish_failed",
  listingStatusChanged: "provider.listing_status.changed",
  listingStatusChangeDenied: "provider.listing_status.change_denied",
  listingStatusChangeFailed: "provider.listing_status.change_failed",
  moderationVisibilityChanged: "moderation.visibility.changed",
  moderationVisibilityFailed: "moderation.visibility.failed",
  listingReportCreated: "moderation.report.created",
  listingReportDuplicate: "moderation.report.duplicate",
  conversationCreated: "messaging.conversation.created",
  messageSent: "messaging.message.sent",
} as const;

type AuditEventType = (typeof AUDIT_EVENT_TYPES)[keyof typeof AUDIT_EVENT_TYPES];

type LogLevel = "info" | "warn" | "error";

export type SecurityAuditEventInput = {
  eventType: AuditEventType;
  actorUserId?: string | null;
  actorRole?: Enums<"app_role"> | null;
  targetType?: string | null;
  targetId?: string | null;
  listingId?: string | null;
  conversationId?: string | null;
  reportId?: string | null;
  fromStatus?: Enums<"listing_status"> | null;
  toStatus?: Enums<"listing_status"> | null;
  metadata?: Record<string, unknown> | null;
};

type RecordSecurityAuditEventInput = {
  event: SecurityAuditEventInput;
  supabase?: SupabaseClient<Database> | null;
};

export function hashAuditIdentifier(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

function parseForwardedIp(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  const first = rawValue.split(",")[0]?.trim() ?? "";
  return first || null;
}

export async function getAuditRequestFingerprint() {
  const headerList = await headers();
  const ipAddress =
    parseForwardedIp(headerList.get("x-forwarded-for")) ??
    parseForwardedIp(headerList.get("cf-connecting-ip")) ??
    parseForwardedIp(headerList.get("x-real-ip"));
  const userAgent = headerList.get("user-agent")?.trim() ?? null;

  return {
    ipHash: ipAddress ? hashAuditIdentifier(ipAddress) : null,
    userAgentHash: userAgent ? hashAuditIdentifier(userAgent) : null,
  };
}

function sanitizeMetadataValue(value: unknown, depth: number, keyName: string | null): Json {
  if (depth > MAX_METADATA_DEPTH) {
    return "[TRUNCATED]";
  }

  if (keyName && SENSITIVE_METADATA_KEY_PATTERN.test(keyName)) {
    return "[REDACTED]";
  }

  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = value.trim();
    if (!normalizedValue) {
      return "";
    }

    if (
      JWT_LIKE_TOKEN_PATTERN.test(normalizedValue) ||
      BEARER_TOKEN_PATTERN.test(normalizedValue)
    ) {
      return "[REDACTED]";
    }

    if (normalizedValue.length > MAX_METADATA_STRING_LENGTH) {
      return `${normalizedValue.slice(0, MAX_METADATA_STRING_LENGTH)}...[TRUNCATED]`;
    }

    return normalizedValue;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "[INVALID_DATE]" : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_METADATA_ARRAY_LENGTH)
      .map((entry) => sanitizeMetadataValue(entry, depth + 1, null));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_METADATA_KEYS);
    const sanitized: Record<string, Json> = {};
    for (const [entryKey, entryValue] of entries) {
      sanitized[entryKey] = sanitizeMetadataValue(entryValue, depth + 1, entryKey);
    }
    return sanitized;
  }

  return String(value);
}

export function sanitizeSecurityMetadata(
  metadata: Record<string, unknown> | null | undefined
): Json {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return sanitizeMetadataValue(metadata, 0, null);
}

export function logSecurityDiagnostic(
  eventType: string,
  metadata: Record<string, unknown> | null | undefined,
  level: LogLevel = "info"
) {
  const payload = {
    at: new Date().toISOString(),
    event_type: eventType,
    metadata: sanitizeSecurityMetadata(metadata),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export async function recordSecurityAuditEvent(input: RecordSecurityAuditEventInput) {
  const supabase = input.supabase ?? (await createServerSupabaseClient());
  const metadata = sanitizeSecurityMetadata(input.event.metadata);

  const { error } = await supabase.rpc("log_security_audit_event", {
    p_event_type: input.event.eventType,
    p_target_type: input.event.targetType ?? undefined,
    p_target_id: input.event.targetId ?? undefined,
    p_listing_id: input.event.listingId ?? undefined,
    p_conversation_id: input.event.conversationId ?? undefined,
    p_report_id: input.event.reportId ?? undefined,
    p_from_status: input.event.fromStatus ?? undefined,
    p_to_status: input.event.toStatus ?? undefined,
    p_actor_role: input.event.actorRole ?? undefined,
    p_metadata: metadata,
    p_actor_user_id: input.event.actorUserId ?? undefined,
  });

  if (!error) {
    return;
  }

  logSecurityDiagnostic(
    "audit.write_failed",
    {
      source_event_type: input.event.eventType,
      source_target_type: input.event.targetType ?? null,
      source_target_id: input.event.targetId ?? null,
      source_listing_id: input.event.listingId ?? null,
      source_conversation_id: input.event.conversationId ?? null,
      source_report_id: input.event.reportId ?? null,
      source_actor_user_id: input.event.actorUserId ?? null,
      source_actor_role: input.event.actorRole ?? null,
      source_metadata: metadata,
      error_code: error.code ?? null,
      error_hint: error.hint ?? null,
      error_message: error.message ?? "unknown_audit_write_error",
    },
    "warn"
  );
}
