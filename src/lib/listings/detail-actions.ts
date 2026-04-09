"use server";

import { createServerSupabaseClient } from "@/lib/supabase";
import type { Enums } from "@/types/database";
import { PUBLIC_DISCOVERY_STATUS } from "@/lib/listings/visibility";
import { isListingReportReason } from "@/lib/moderation/reporting";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

async function loadReportableListing(
  listingId: string
) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id")
    .eq("id", listingId)
    .eq("listing_status", PUBLIC_DISCOVERY_STATUS)
    .maybeSingle();

  return {
    ok: !error && Boolean(data),
    listing: !error && data ? data : null,
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

  if (!isListingReportReason(reason)) {
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
    const { ok, listing, supabase } = await loadReportableListing(listingId);
    if (!ok || !listing) {
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

    if (listing.owner_id === user.id) {
      return {
        status: "error",
        message: "You cannot submit a report for your own listing.",
        submitted: false,
        requiresAuth: false,
      };
    }

    const { error } = await supabase.from("listing_reports").insert({
      listing_id: listingId,
      reporter_id: user.id,
      reason_code: reason,
      details: details || null,
    });

    if (error) {
      if (error.code === "23505") {
        return {
          status: "success",
          message: "You already submitted a report for this listing. Our moderation team will review it.",
          submitted: true,
          requiresAuth: false,
        };
      }

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
