import "server-only";

import { createHash } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";

import type { Database } from "@/types/database";

export type TrafficControlRule = {
  bucket: string;
  windowSeconds: number;
  maxAttempts: number;
};

export const TRAFFIC_CONTROL_RULES = {
  authSignInPerIp: {
    bucket: "auth.sign_in.ip",
    windowSeconds: 10 * 60,
    maxAttempts: 12,
  },
  authSignInPerEmail: {
    bucket: "auth.sign_in.email",
    windowSeconds: 10 * 60,
    maxAttempts: 8,
  },
  authSignUpPerIp: {
    bucket: "auth.sign_up.ip",
    windowSeconds: 60 * 60,
    maxAttempts: 6,
  },
  authSignUpPerEmail: {
    bucket: "auth.sign_up.email",
    windowSeconds: 12 * 60 * 60,
    maxAttempts: 3,
  },
  authPasswordResetPerIp: {
    bucket: "auth.password_reset.ip",
    windowSeconds: 30 * 60,
    maxAttempts: 8,
  },
  authPasswordResetPerEmail: {
    bucket: "auth.password_reset.email",
    windowSeconds: 30 * 60,
    maxAttempts: 4,
  },
  authCallbackPerIp: {
    bucket: "auth.callback.ip",
    windowSeconds: 10 * 60,
    maxAttempts: 40,
  },
  companyWorkspaceCreatePerIp: {
    bucket: "company.create_workspace.ip",
    windowSeconds: 30 * 60,
    maxAttempts: 8,
  },
  companyWorkspaceCreatePerUser: {
    bucket: "company.create_workspace.user",
    windowSeconds: 6 * 60 * 60,
    maxAttempts: 4,
  },
  companyProfileUpdatePerUser: {
    bucket: "company.profile_update.user",
    windowSeconds: 30 * 60,
    maxAttempts: 30,
  },
  companyLogoUpdatePerUser: {
    bucket: "company.logo_update.user",
    windowSeconds: 30 * 60,
    maxAttempts: 20,
  },
  messagingCreateConversationPerUser: {
    bucket: "messaging.create_conversation.user",
    windowSeconds: 10 * 60,
    maxAttempts: 20,
  },
  messagingCreateConversationPerListing: {
    bucket: "messaging.create_conversation.listing",
    windowSeconds: 10 * 60,
    maxAttempts: 4,
  },
  messagingSendPerConversation: {
    bucket: "messaging.send_message.conversation",
    windowSeconds: 60,
    maxAttempts: 12,
  },
  messagingSendPerUser: {
    bucket: "messaging.send_message.user",
    windowSeconds: 60 * 60,
    maxAttempts: 180,
  },
  reportSubmitPerUser: {
    bucket: "moderation.submit_report.user",
    windowSeconds: 60 * 60,
    maxAttempts: 8,
  },
  reportSubmitPerListing: {
    bucket: "moderation.submit_report.listing",
    windowSeconds: 30 * 60,
    maxAttempts: 2,
  },
  providerDraftSavePerUser: {
    bucket: "provider.save_draft_step.user",
    windowSeconds: 60 * 60,
    maxAttempts: 180,
  },
  providerPhotoSyncPerListing: {
    bucket: "provider.sync_photos.listing",
    windowSeconds: 15 * 60,
    maxAttempts: 30,
  },
  providerPublishPerListing: {
    bucket: "provider.publish.listing",
    windowSeconds: 60 * 60,
    maxAttempts: 10,
  },
  providerStatusUpdatePerListing: {
    bucket: "provider.status_update.listing",
    windowSeconds: 15 * 60,
    maxAttempts: 40,
  },
  adminModerationPerUser: {
    bucket: "admin.moderation.user",
    windowSeconds: 15 * 60,
    maxAttempts: 120,
  },
  internalSupabaseProbePerIp: {
    bucket: "internal.supabase_probe.ip",
    windowSeconds: 60,
    maxAttempts: 30,
  },
} as const;

type RateLimitFunctionRow = {
  allowed?: boolean;
  remaining?: number;
  retry_after_seconds?: number;
};

type TrafficIdentity = {
  userId?: string | null;
  email?: string | null;
  scope?: string | null;
  includeIp?: boolean;
};

type EnforceTrafficControlInput = {
  supabase: SupabaseClient<Database>;
  rule: TrafficControlRule;
  identity: TrafficIdentity;
  throttledMessage: string;
  unavailableMessage?: string;
};

export type TrafficControlResult =
  | {
      ok: true;
      remaining: number;
    }
  | {
      ok: false;
      reason: "throttled" | "unavailable";
      message: string;
      retryAfterSeconds: number;
    };

const DEFAULT_UNAVAILABLE_MESSAGE =
  "Request limits could not be verified right now. Please try again shortly.";
const MAX_BUCKET_LENGTH = 120;
const MAX_SCOPE_LENGTH = 200;

function normalizeBucket(bucket: string) {
  return bucket.trim().toLowerCase().slice(0, MAX_BUCKET_LENGTH);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizeScope(scope: string) {
  return scope.trim().toLowerCase().slice(0, MAX_SCOPE_LENGTH);
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

function parseForwardedIp(rawValue: string | null) {
  if (!rawValue) {
    return null;
  }

  const first = rawValue.split(",")[0]?.trim() ?? "";
  if (!first) {
    return null;
  }

  if (first.length > 120) {
    return first.slice(0, 120);
  }

  return first;
}

async function readRequestIpAddress() {
  const headerList = await headers();

  return (
    parseForwardedIp(headerList.get("x-forwarded-for")) ??
    parseForwardedIp(headerList.get("cf-connecting-ip")) ??
    parseForwardedIp(headerList.get("x-real-ip")) ??
    null
  );
}

function toActorKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

async function buildActorFingerprint(identity: TrafficIdentity) {
  const normalizedParts: string[] = [];

  if (identity.userId) {
    normalizedParts.push(`user:${normalizeUserId(identity.userId)}`);
  }

  if (identity.email) {
    normalizedParts.push(`email:${normalizeEmail(identity.email)}`);
  }

  if (identity.scope) {
    normalizedParts.push(`scope:${normalizeScope(identity.scope)}`);
  }

  if (identity.includeIp ?? true) {
    const ipAddress = await readRequestIpAddress();
    normalizedParts.push(`ip:${ipAddress ?? "unknown"}`);
  }

  if (normalizedParts.length === 0) {
    normalizedParts.push("anonymous");
  }

  return toActorKey(normalizedParts);
}

function readRateLimitRow(value: unknown): RateLimitFunctionRow | null {
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return null;
    }

    const first = value[0];
    if (!first || typeof first !== "object") {
      return null;
    }

    return first as RateLimitFunctionRow;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as RateLimitFunctionRow;
}

function clampNonNegativeInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  const normalized = Math.trunc(value);
  return normalized < 0 ? 0 : normalized;
}

function formatRetryWindow(seconds: number) {
  const clamped = Math.max(1, Math.trunc(seconds));

  if (clamped < 60) {
    return `${clamped} seconds`;
  }

  if (clamped < 3600) {
    const minutes = Math.ceil(clamped / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const hours = Math.ceil(clamped / 3600);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

function appendRetryHint(message: string, retryAfterSeconds: number) {
  return `${message} Try again in ${formatRetryWindow(retryAfterSeconds)}.`;
}

export async function enforceTrafficControl(
  input: EnforceTrafficControlInput
): Promise<TrafficControlResult> {
  const actorKey = await buildActorFingerprint(input.identity);
  const bucket = normalizeBucket(input.rule.bucket);

  const { data, error } = await input.supabase.rpc("consume_rate_limit_token", {
    actor_key_input: actorKey,
    bucket_name: bucket,
    max_attempts: input.rule.maxAttempts,
    window_seconds: input.rule.windowSeconds,
  });

  if (error) {
    return {
      ok: false,
      reason: "unavailable",
      message: input.unavailableMessage ?? DEFAULT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 30,
    };
  }

  const row = readRateLimitRow(data);
  if (!row || typeof row.allowed !== "boolean") {
    return {
      ok: false,
      reason: "unavailable",
      message: input.unavailableMessage ?? DEFAULT_UNAVAILABLE_MESSAGE,
      retryAfterSeconds: 30,
    };
  }

  const retryAfterSeconds = clampNonNegativeInteger(row.retry_after_seconds);
  if (!row.allowed) {
    return {
      ok: false,
      reason: "throttled",
      message: appendRetryHint(input.throttledMessage, retryAfterSeconds || 1),
      retryAfterSeconds: retryAfterSeconds || 1,
    };
  }

  return {
    ok: true,
    remaining: clampNonNegativeInteger(row.remaining),
  };
}
