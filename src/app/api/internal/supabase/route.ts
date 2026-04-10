import { NextResponse } from "next/server";

import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient, getSupabaseEnv } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const NETWORK_ERROR_HINTS = ["fetch failed", "network", "ecconnrefused", "enotfound", "timeout"];

export async function GET() {
  try {
    const { url } = getSupabaseEnv();
    const supabase = await createServerSupabaseClient();
    const trafficControl = await enforceTrafficControl({
      supabase,
      rule: TRAFFIC_CONTROL_RULES.internalSupabaseProbePerIp,
      identity: { includeIp: true },
      throttledMessage: "Supabase probe request limit reached.",
      unavailableMessage: "Supabase probe is temporarily unavailable.",
    });

    if (!trafficControl.ok) {
      return NextResponse.json(
        {
          ok: false,
          check: "supabase-auth-endpoint",
          note: trafficControl.message,
        },
        {
          status: trafficControl.reason === "throttled" ? 429 : 503,
          headers: {
            "Retry-After": String(Math.max(1, trafficControl.retryAfterSeconds)),
          },
        }
      );
    }

    // Probe auth endpoint without requiring a real user session.
    const { error } = await supabase.auth.getUser("supabase_probe_invalid_token");

    const message = error?.message?.toLowerCase() ?? "";
    const authEndpointReachable =
      !error || !NETWORK_ERROR_HINTS.some((hint) => message.includes(hint));

    return NextResponse.json(
      {
        ok: authEndpointReachable,
        check: "supabase-auth-endpoint",
        projectHost: new URL(url).host,
        note: authEndpointReachable
          ? "Supabase responded to server-side auth probe."
          : "Supabase probe failed; verify URL/key and network access.",
      },
      { status: authEndpointReachable ? 200 : 503 }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        check: "supabase-auth-endpoint",
        note: "Supabase environment validation failed. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
      },
      { status: 500 }
    );
  }
}
