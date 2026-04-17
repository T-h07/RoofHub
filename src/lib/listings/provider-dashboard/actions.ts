"use server";

import { getCurrentUserProfile } from "@/lib/auth/profile";
import { isProviderRole } from "@/lib/auth/roles";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import { createServerSupabaseClient } from "@/lib/supabase";
import { canTransitionProviderListingStatus } from "@/lib/listings/provider-wizard/status-transitions";
import { isProviderListingStatus } from "./types";

import type { ProviderListingStatus } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProviderMutationContext =
  | {
      ok: true;
      supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
      profile: Awaited<ReturnType<typeof getCurrentUserProfile>> extends infer TResult
        ? TResult extends { ok: true; profile: infer TProfile }
          ? TProfile
          : never
        : never;
    }
  | {
      ok: false;
      message: string;
    };

type ProviderOwnedListingStatus = {
  id: string;
  owner_id: string;
  organization_id: string | null;
  created_by_user_id: string;
  assigned_agent_user_id: string | null;
  published_by_user_id: string | null;
  listing_status: ProviderListingStatus;
  published_at: string | null;
};

export type UpdateProviderListingLifecycleStatusInput = {
  listingId: string;
  nextStatus: ProviderListingStatus;
};

export type UpdateProviderListingLifecycleStatusResult = {
  ok: boolean;
  message: string;
  previousStatus?: ProviderListingStatus;
  nextStatus?: ProviderListingStatus;
};

function isUuid(value: string | null | undefined) {
  if (typeof value !== "string") {
    return false;
  }

  return UUID_PATTERN.test(value);
}

function normalizeSupabaseError(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "You do not have permission to manage this listing.";
  }

  if (normalized.includes("check constraint")) {
    return "This status change conflicts with listing constraints.";
  }

  return "Listing status update failed. Please retry.";
}

function isMissingOwnershipColumnsError(input: {
  code?: string | null;
  message?: string | null;
}) {
  const message = (input.message ?? "").toLowerCase();
  if (input.code !== "42703") {
    return false;
  }

  return (
    (message.includes("listings.organization_id") && message.includes("does not exist")) ||
    (message.includes("listings.created_by_user_id") && message.includes("does not exist")) ||
    (message.includes("listings.assigned_agent_user_id") && message.includes("does not exist")) ||
    (message.includes("listings.published_by_user_id") && message.includes("does not exist"))
  );
}

function getLifecycleStatusSuccessMessage(nextStatus: ProviderListingStatus) {
  switch (nextStatus) {
    case "draft":
      return "Listing restored to draft.";
    case "paused":
      return "Listing paused.";
    case "archived":
      return "Listing archived.";
    case "sold":
      return "Listing marked as sold.";
    case "rented":
      return "Listing marked as rented.";
    case "published":
      return "Listing set to active.";
    case "hidden_by_admin":
      return "Listing status updated by admin controls.";
    default:
      return "Listing status updated.";
  }
}

function buildStatusPatch(
  nextStatus: ProviderListingStatus,
  currentListing: ProviderOwnedListingStatus,
  actorUserId: string
) {
  if (nextStatus === "draft") {
    return {
      listing_status: nextStatus,
      archived_at: null,
      published_at: null,
    };
  }

  if (nextStatus === "published") {
    return {
      listing_status: nextStatus,
      published_at: currentListing.published_at ?? new Date().toISOString(),
      published_by_user_id: actorUserId,
      archived_at: null,
    };
  }

  if (nextStatus === "archived") {
    return {
      listing_status: nextStatus,
      archived_at: new Date().toISOString(),
    };
  }

  return {
    listing_status: nextStatus,
    archived_at: null,
  };
}

async function ensureProviderMutationContext(): Promise<ProviderMutationContext> {
  const supabase = await createServerSupabaseClient();
  const profileResult = await getCurrentUserProfile(supabase);

  if (!profileResult.ok) {
    return {
      ok: false,
      message: profileResult.message,
    };
  }

  if (!isProviderRole(profileResult.profile.role)) {
    return {
      ok: false,
      message: "Switch your profile role to provider before managing listings.",
    };
  }

  return {
    ok: true,
    supabase,
    profile: profileResult.profile,
  };
}

async function loadProviderOwnedListing(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  input: {
    listingId: string;
    userId: string;
  }
) {
  const query = supabase
    .from("listings")
    .select(
      "id, owner_id, organization_id, created_by_user_id, assigned_agent_user_id, published_by_user_id, listing_status, published_at"
    )
    .eq("id", input.listingId)
    .eq("owner_id", input.userId)
    .limit(1);

  const { data, error } = await query.maybeSingle();

  if (!error && data) {
    return {
      ok: true as const,
      listing: data as ProviderOwnedListingStatus,
    };
  }

  if (error && isMissingOwnershipColumnsError({ code: error.code ?? null, message: error.message ?? null })) {
    const legacyResult = await supabase
      .from("listings")
      .select("id, owner_id, listing_status, published_at")
      .eq("id", input.listingId)
      .eq("owner_id", input.userId)
      .limit(1)
      .maybeSingle();

    if (!legacyResult.error && legacyResult.data) {
      console.warn(
        "[ProviderDashboard] listings ownership columns are missing; falling back to legacy listing status projection."
      );
      return {
        ok: true as const,
        listing: {
          id: legacyResult.data.id,
          owner_id: legacyResult.data.owner_id,
          organization_id: null,
          created_by_user_id: legacyResult.data.owner_id,
          assigned_agent_user_id: null,
          published_by_user_id: null,
          listing_status: legacyResult.data.listing_status,
          published_at: legacyResult.data.published_at,
        } satisfies ProviderOwnedListingStatus,
      };
    }
  }

  if (error || !data) {
    return {
      ok: false as const,
      message: "Listing not found or inaccessible.",
      listing: null as ProviderOwnedListingStatus | null,
    };
  }

  return {
    ok: false as const,
    message: "Listing not found or inaccessible.",
    listing: null as ProviderOwnedListingStatus | null,
  };
}

export async function updateProviderListingLifecycleStatusAction(
  input: UpdateProviderListingLifecycleStatusInput
): Promise<UpdateProviderListingLifecycleStatusResult> {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      message: "Listing status mutation payload is invalid.",
    };
  }

  const listingId = typeof input.listingId === "string" ? input.listingId : null;
  const nextStatus = input.nextStatus;

  if (!listingId || !isUuid(listingId)) {
    return {
      ok: false,
      message: "Listing id is invalid.",
    };
  }

  if (!isProviderListingStatus(nextStatus)) {
    return {
      ok: false,
      message: "Listing status transition target is invalid.",
    };
  }

  const context = await ensureProviderMutationContext();

  if (!context.ok) {
    return {
      ok: false,
      message: context.message,
    };
  }

  const { supabase, profile } = context;
  const lifecycleTrafficControl = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.providerStatusUpdatePerListing,
    identity: {
      userId: profile.id,
      scope: listingId,
      includeIp: false,
    },
    throttledMessage: "Too many status changes for this listing. Please wait before trying again.",
    unavailableMessage: "Listing status updates are temporarily unavailable. Please retry shortly.",
  });
  if (!lifecycleTrafficControl.ok) {
    return {
      ok: false,
      message: lifecycleTrafficControl.message,
    };
  }

  if (nextStatus === "hidden_by_admin") {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.listingStatusChangeDenied,
        actorUserId: profile.id,
        actorRole: profile.role,
        targetType: "listing",
        targetId: listingId,
        listingId,
        metadata: {
          reason: "provider_cannot_set_hidden_by_admin",
          requested_status: nextStatus,
        },
      },
    });
    return {
      ok: false,
      message: "Hidden-by-admin status can only be set by moderation workflows.",
    };
  }

  const listingResult = await loadProviderOwnedListing(supabase, {
    listingId,
    userId: profile.id,
  });

  if (!listingResult.ok || !listingResult.listing) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.listingStatusChangeFailed,
        actorUserId: profile.id,
        actorRole: profile.role,
        targetType: "listing",
        targetId: listingId,
        listingId,
        metadata: {
          reason: "listing_not_found_or_inaccessible",
          requested_status: nextStatus,
        },
      },
    });
    return {
      ok: false,
      message: listingResult.ok ? "Listing not found or inaccessible." : listingResult.message,
    };
  }

  const currentListing = listingResult.listing;

  if (currentListing.organization_id) {
    return {
      ok: false,
      message:
        "Company-owned listings use internal workflow actions. Open the listing workflow panel to continue.",
      previousStatus: currentListing.listing_status,
    };
  }

  if (currentListing.listing_status === nextStatus) {
    return {
      ok: true,
      message: "Listing already has this status.",
      previousStatus: currentListing.listing_status,
      nextStatus: currentListing.listing_status,
    };
  }

  if (!canTransitionProviderListingStatus(currentListing.listing_status, nextStatus)) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.listingStatusChangeDenied,
        actorUserId: profile.id,
        actorRole: profile.role,
        targetType: "listing",
        targetId: currentListing.id,
        listingId: currentListing.id,
        fromStatus: currentListing.listing_status,
        toStatus: nextStatus,
        metadata: {
          reason: "invalid_status_transition",
        },
      },
    });
    return {
      ok: false,
      message: `Cannot move listing from ${currentListing.listing_status} to ${nextStatus}.`,
      previousStatus: currentListing.listing_status,
    };
  }

  const patch = buildStatusPatch(nextStatus, currentListing, profile.id);
  const updateQuery = supabase
    .from("listings")
    .update(patch)
    .eq("id", currentListing.id)
    .eq("owner_id", profile.id)
    .select("listing_status")
    .limit(1);

  const { data, error } = await updateQuery.maybeSingle();

  if (error || !data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.listingStatusChangeFailed,
        actorUserId: profile.id,
        actorRole: profile.role,
        targetType: "listing",
        targetId: currentListing.id,
        listingId: currentListing.id,
        fromStatus: currentListing.listing_status,
        toStatus: nextStatus,
        metadata: {
          reason: error ? "update_failed" : "empty_update_result",
        },
      },
    });
    return {
      ok: false,
      message: error
        ? normalizeSupabaseError(error.message)
        : "Listing status update could not be completed.",
      previousStatus: currentListing.listing_status,
    };
  }

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.listingStatusChanged,
      actorUserId: profile.id,
      actorRole: profile.role,
      targetType: "listing",
      targetId: currentListing.id,
      listingId: currentListing.id,
      fromStatus: currentListing.listing_status,
      toStatus: data.listing_status,
      metadata: {
        action_source: "provider_dashboard",
      },
    },
  });

  return {
    ok: true,
    message: getLifecycleStatusSuccessMessage(data.listing_status),
    previousStatus: currentListing.listing_status,
    nextStatus: data.listing_status,
  };
}
