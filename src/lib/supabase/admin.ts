import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";
export const SUPABASE_SERVER_URL_ENV = "SUPABASE_URL";
const SUPABASE_PUBLIC_URL_ENV = "NEXT_PUBLIC_SUPABASE_URL";

export function isMissingSupabaseServiceRoleError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVICE_ROLE_ENV.toLowerCase())
  );
}

export function isMissingSupabaseAdminUrlError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.toLowerCase();
  return (
    normalized.includes("missing required server-only environment variable") &&
    normalized.includes(SUPABASE_SERVER_URL_ENV.toLowerCase())
  );
}

function resolveServerSupabaseUrl() {
  const url = process.env[SUPABASE_SERVER_URL_ENV] ?? process.env[SUPABASE_PUBLIC_URL_ENV];

  if (!url) {
    throw new Error(
      `[Supabase] Missing required server-only environment variable: ${SUPABASE_SERVER_URL_ENV}. Also checked ${SUPABASE_PUBLIC_URL_ENV}.`
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error(
      `[Supabase] Invalid ${SUPABASE_SERVER_URL_ENV}. Provide a valid Supabase project URL (https://<project-ref>.supabase.co).`
    );
  }

  return url;
}

export function createAdminSupabaseClient() {
  const url = resolveServerSupabaseUrl();
  const serviceRoleKey = process.env[SUPABASE_SERVICE_ROLE_ENV];

  if (!serviceRoleKey) {
    throw new Error(
      `[Supabase] Missing required server-only environment variable: ${SUPABASE_SERVICE_ROLE_ENV}.`
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
