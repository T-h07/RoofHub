"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@/types/database";

import { getSupabaseEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv();

  if (!browserClient) {
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
}
