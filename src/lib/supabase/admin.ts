import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { getSupabaseEnv } from "./env";

export const SUPABASE_SERVICE_ROLE_ENV = "SUPABASE_SERVICE_ROLE_KEY";

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

export function createAdminSupabaseClient() {
  const { url } = getSupabaseEnv();
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
