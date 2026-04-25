import "server-only";

import { canReviewCompanyListingWorkflow } from "@/lib/company/permissions";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Enums, Json, Tables } from "@/types/database";

export const LISTING_EDIT_PATCH_COLUMNS = [
  "title",
  "description",
  "listing_type",
  "property_type",
  "price_amount",
  "currency_code",
  "deposit_amount",
  "area_m2",
  "bedrooms",
  "bathrooms",
  "floor_number",
  "total_floors",
  "city",
  "neighborhood",
  "address_text",
  "available_from",
  "furnished",
  "parking",
  "pets_allowed",
  "elevator",
  "balcony",
  "internet_included",
  "utilities_included",
  "heating_type",
  "public_location_mode",
  "latitude",
  "longitude",
] as const;

const LISTING_EDIT_PATCH_COLUMN_SET: ReadonlySet<string> = new Set(LISTING_EDIT_PATCH_COLUMNS);

export type ListingEditPatchColumn = (typeof LISTING_EDIT_PATCH_COLUMNS)[number];
export type ListingEditSubmissionStatus = Enums<"listing_edit_submission_status">;
export type OrganizationMemberRole = Tables<"organization_members">["role"];

export type ListingEditPatch = Partial<Record<ListingEditPatchColumn, Json>>;

export type ListingEditSubmissionRecord = Tables<"listing_edit_submissions">;

export type ListingEditSubmissionWithProfiles = ListingEditSubmissionRecord & {
  submittedBy: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
  reviewerProfile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
};

export const ACTIVE_LISTING_EDIT_SUBMISSION_STATUSES: readonly ListingEditSubmissionStatus[] = [
  "draft",
  "pending_review",
  "needs_changes",
];

const ACTIVE_LISTING_EDIT_SUBMISSION_STATUS_SET: ReadonlySet<ListingEditSubmissionStatus> = new Set(
  ACTIVE_LISTING_EDIT_SUBMISSION_STATUSES
);

const LISTING_EDIT_SUBMISSION_SELECT = `
  id,
  listing_id,
  organization_id,
  submitted_by_user_id,
  reviewer_user_id,
  status,
  proposed_patch,
  review_note,
  submitted_at,
  reviewed_at,
  applied_at,
  created_at,
  updated_at,
  submittedBy:profiles!listing_edit_submissions_submitted_by_user_id_fkey(id, display_name, avatar_url),
  reviewerProfile:profiles!listing_edit_submissions_reviewer_user_id_fkey(id, display_name, avatar_url)
`;

type JsonPrimitive = string | number | boolean | null;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toJsonPrimitive(value: unknown): JsonPrimitive | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return undefined;
}

export function isListingEditSubmissionStatus(value: unknown): value is ListingEditSubmissionStatus {
  return (
    typeof value === "string" &&
    (["draft", "pending_review", "needs_changes", "approved", "rejected"] as const).includes(
      value as ListingEditSubmissionStatus
    )
  );
}

export function isActiveListingEditSubmissionStatus(
  value: unknown
): value is ListingEditSubmissionStatus {
  return (
    isListingEditSubmissionStatus(value) &&
    ACTIVE_LISTING_EDIT_SUBMISSION_STATUS_SET.has(value)
  );
}

export function isCompanyWorkflowReviewerRole(role: OrganizationMemberRole | null) {
  if (!role) {
    return false;
  }

  return canReviewCompanyListingWorkflow(role, "active");
}

export function sanitizeListingEditPatch(input: unknown): ListingEditPatch {
  if (!isObjectRecord(input)) {
    return {};
  }

  const sanitized: ListingEditPatch = {};
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (!LISTING_EDIT_PATCH_COLUMN_SET.has(rawKey)) {
      continue;
    }

    const normalized = toJsonPrimitive(rawValue);
    if (normalized === undefined) {
      continue;
    }

    sanitized[rawKey as ListingEditPatchColumn] = normalized;
  }

  return sanitized;
}

function mergeListingEditPatch(input: { current: ListingEditPatch; next: ListingEditPatch }) {
  return {
    ...input.current,
    ...input.next,
  } satisfies ListingEditPatch;
}

export async function loadActiveOrganizationMembershipRole(input: {
  organizationId: string;
  userId: string;
}): Promise<OrganizationMemberRole | null> {
  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase
    .from("organization_members")
    .select("role, member_status")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.userId)
    .eq("member_status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.role;
}

export async function loadListingActiveEditSubmission(input: {
  listingId: string;
  statuses?: readonly ListingEditSubmissionStatus[];
}) {
  const statuses = input.statuses ?? ACTIVE_LISTING_EDIT_SUBMISSION_STATUSES;
  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase
    .from("listing_edit_submissions")
    .select(LISTING_EDIT_SUBMISSION_SELECT)
    .eq("listing_id", input.listingId)
    .in("status", [...statuses])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ListingEditSubmissionWithProfiles;
}

export async function loadActorListingEditSubmission(input: {
  listingId: string;
  actorUserId: string;
  statuses?: readonly ListingEditSubmissionStatus[];
}) {
  const statuses = input.statuses ?? ACTIVE_LISTING_EDIT_SUBMISSION_STATUSES;
  const adminSupabase = createAdminSupabaseClient();
  const { data, error } = await adminSupabase
    .from("listing_edit_submissions")
    .select(LISTING_EDIT_SUBMISSION_SELECT)
    .eq("listing_id", input.listingId)
    .eq("submitted_by_user_id", input.actorUserId)
    .in("status", [...statuses])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ListingEditSubmissionWithProfiles;
}

export async function stageListingEditSubmissionDraft(input: {
  listingId: string;
  organizationId: string;
  actorUserId: string;
  patch: ListingEditPatch;
}) {
  const sanitizedPatch = sanitizeListingEditPatch(input.patch);
  if (Object.keys(sanitizedPatch).length === 0) {
    return {
      ok: false as const,
      message: "No listing edits were detected for review staging.",
      submission: null as ListingEditSubmissionWithProfiles | null,
      created: false,
    };
  }

  const adminSupabase = createAdminSupabaseClient();
  const existingSubmission = await loadListingActiveEditSubmission({
    listingId: input.listingId,
  });

  if (existingSubmission) {
    if (existingSubmission.submitted_by_user_id !== input.actorUserId) {
      return {
        ok: false as const,
        message:
          "Another team member already has a live-listing edit submission in progress for this listing.",
        submission: null as ListingEditSubmissionWithProfiles | null,
        created: false,
      };
    }

    if (existingSubmission.status === "pending_review") {
      return {
        ok: false as const,
        message:
          "This edit submission is already pending reviewer approval. Wait for reviewer feedback before staging more updates.",
        submission: existingSubmission,
        created: false,
      };
    }

    const mergedPatch = mergeListingEditPatch({
      current: sanitizeListingEditPatch(existingSubmission.proposed_patch),
      next: sanitizedPatch,
    });

    const { data: updatedRow, error: updateError } = await adminSupabase
      .from("listing_edit_submissions")
      .update({
        status: "draft",
        proposed_patch: mergedPatch as Json,
        reviewer_user_id: null,
        review_note: null,
        reviewed_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingSubmission.id)
      .select(LISTING_EDIT_SUBMISSION_SELECT)
      .limit(1)
      .maybeSingle();

    if (updateError || !updatedRow) {
      return {
        ok: false as const,
        message: "Listing edit submission could not be staged. Please retry.",
        submission: null as ListingEditSubmissionWithProfiles | null,
        created: false,
      };
    }

    return {
      ok: true as const,
      message: "Changes staged. Submit from review to request live update approval.",
      submission: updatedRow as ListingEditSubmissionWithProfiles,
      created: false,
    };
  }

  const { data: insertedRow, error: insertError } = await adminSupabase
    .from("listing_edit_submissions")
    .insert({
      listing_id: input.listingId,
      organization_id: input.organizationId,
      submitted_by_user_id: input.actorUserId,
      status: "draft",
      proposed_patch: sanitizedPatch as Json,
      submitted_at: null,
    })
    .select(LISTING_EDIT_SUBMISSION_SELECT)
    .limit(1)
    .maybeSingle();

  if (insertError || !insertedRow) {
    return {
      ok: false as const,
      message: "Listing edit submission could not be created. Please retry.",
      submission: null as ListingEditSubmissionWithProfiles | null,
      created: false,
    };
  }

  return {
    ok: true as const,
    message: "Changes staged. Submit from review to request live update approval.",
    submission: insertedRow as ListingEditSubmissionWithProfiles,
    created: true,
  };
}

export async function submitListingEditSubmissionForReview(input: {
  listingId: string;
  actorUserId: string;
}) {
  const activeSubmission = await loadActorListingEditSubmission({
    listingId: input.listingId,
    actorUserId: input.actorUserId,
  });

  if (!activeSubmission) {
    return {
      ok: false as const,
      message:
        "No staged live-listing edits were found. Save listing changes before submitting for review.",
      submission: null as ListingEditSubmissionWithProfiles | null,
      alreadyPending: false,
    };
  }

  if (activeSubmission.status === "pending_review") {
    return {
      ok: true as const,
      message: "Listing edit submission is already pending reviewer approval.",
      submission: activeSubmission,
      alreadyPending: true,
    };
  }

  const sanitizedPatch = sanitizeListingEditPatch(activeSubmission.proposed_patch);
  if (Object.keys(sanitizedPatch).length === 0) {
    return {
      ok: false as const,
      message:
        "No staged live-listing edits were found. Save listing changes before submitting for review.",
      submission: null as ListingEditSubmissionWithProfiles | null,
      alreadyPending: false,
    };
  }

  const adminSupabase = createAdminSupabaseClient();
  const { data: updatedRow, error: updateError } = await adminSupabase
    .from("listing_edit_submissions")
    .update({
      status: "pending_review",
      submitted_at: new Date().toISOString(),
      reviewer_user_id: null,
      review_note: null,
      reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", activeSubmission.id)
    .eq("submitted_by_user_id", input.actorUserId)
    .select(LISTING_EDIT_SUBMISSION_SELECT)
    .limit(1)
    .maybeSingle();

  if (updateError || !updatedRow) {
    return {
      ok: false as const,
      message: "Listing edit submission could not be sent for review. Please retry.",
      submission: null as ListingEditSubmissionWithProfiles | null,
      alreadyPending: false,
    };
  }

  return {
    ok: true as const,
    message: "Changes submitted for company review. Live listing remains unchanged until approval.",
    submission: updatedRow as ListingEditSubmissionWithProfiles,
    alreadyPending: false,
  };
}

export function toListingEditPatchValueLabel(value: Json | undefined) {
  if (value === undefined) {
    return "--";
  }

  if (value === null) {
    return "None";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

export const LISTING_EDIT_PATCH_FIELD_LABELS: Record<ListingEditPatchColumn, string> = {
  title: "Title",
  description: "Description",
  listing_type: "Listing type",
  property_type: "Property type",
  price_amount: "Price amount",
  currency_code: "Currency",
  deposit_amount: "Deposit",
  area_m2: "Area (m²)",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  floor_number: "Floor number",
  total_floors: "Total floors",
  city: "City",
  neighborhood: "Neighborhood",
  address_text: "Address",
  available_from: "Available from",
  furnished: "Furnished",
  parking: "Parking",
  pets_allowed: "Pets allowed",
  elevator: "Elevator",
  balcony: "Balcony",
  internet_included: "Internet included",
  utilities_included: "Utilities included",
  heating_type: "Heating type",
  public_location_mode: "Public location mode",
  latitude: "Latitude",
  longitude: "Longitude",
};
