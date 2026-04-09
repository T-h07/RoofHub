"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import type { Enums } from "@/types/database";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const REPORT_REASON_VALUES: readonly Enums<"report_reason">[] = [
  "spam",
  "fraud",
  "duplicate",
  "inappropriate",
  "incorrect_information",
  "other",
] as const;

type ActionStatus = "idle" | "success" | "error";

export type ReportListingActionState = {
  status: ActionStatus;
  message: string | null;
  submitted: boolean;
  requiresAuth: boolean;
};

function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

function getString(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

async function ensurePublicListingVisibility(
  listingId: string
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("listing_status", "published")
    .maybeSingle();

  return {
    ok: !error && Boolean(data),
    supabase,
  };
}

export async function submitListingReportAction(
  _: ReportListingActionState,
  formData: FormData
): Promise<ReportListingActionState> {
  const listingId = getString(formData, "listingId");
  const reason = getString(formData, "reason") as Enums<"report_reason">;
  const details = getString(formData, "details");

  if (!isUuid(listingId)) {
    return {
      status: "error",
      message: "Report action could not be completed. Refresh and try again.",
      submitted: false,
      requiresAuth: false,
    };
  }

  if (!REPORT_REASON_VALUES.includes(reason)) {
    return {
      status: "error",
      message: "Please choose a valid report reason.",
      submitted: false,
      requiresAuth: false,
    };
  }

  if (details.length > 1200) {
    return {
      status: "error",
      message: "Report details are too long. Keep the message under 1200 characters.",
      submitted: false,
      requiresAuth: false,
    };
  }

  try {
    const { ok, supabase } = await ensurePublicListingVisibility(listingId);
    if (!ok) {
      return {
        status: "error",
        message: "This listing is no longer available for reporting.",
        submitted: false,
        requiresAuth: false,
      };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        status: "error",
        message: "Sign in to submit a listing report.",
        submitted: false,
        requiresAuth: true,
      };
    }

    const { error } = await supabase.from("listing_reports").insert({
      listing_id: listingId,
      reporter_id: user.id,
      reason_code: reason,
      details: details || null,
    });

    if (error) {
      return {
        status: "error",
        message: "Report submission failed. Please try again.",
        submitted: false,
        requiresAuth: false,
      };
    }

    return {
      status: "success",
      message: "Report submitted. Thank you for helping keep listings trustworthy.",
      submitted: true,
      requiresAuth: false,
    };
  } catch {
    return {
      status: "error",
      message: "Report submission failed. Please try again.",
      submitted: false,
      requiresAuth: false,
    };
  }
}
