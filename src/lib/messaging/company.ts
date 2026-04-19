import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

import type {
  MessagingAssignableCompanyMember,
  MessagingCompanyRoutingDetail,
  MessagingCompanyRoutingSummary,
  MessagingConversationRecord,
} from "./types";
import { canAccessCompanyConversation } from "./authorization";

export type CompanyConversationListingRow = Pick<
  Tables<"listings">,
  | "id"
  | "slug"
  | "title"
  | "city"
  | "neighborhood"
  | "listing_status"
  | "listing_type"
  | "property_type"
  | "price_amount"
  | "currency_code"
  | "organization_id"
  | "assigned_agent_user_id"
>;

export type CompanyConversationRow = MessagingConversationRecord;

export type CompanyConversationAccessRecord = {
  conversation: CompanyConversationRow;
  listing: CompanyConversationListingRow;
};

type AssignableMemberRow = Pick<Tables<"organization_members">, "user_id" | "role"> & {
  profile: Pick<Tables<"profiles">, "display_name"> | null;
};

const COMPANY_CONVERSATION_SELECT =
  "id, listing_id, provider_id, seeker_id, owner_mode, organization_id, assigned_member_user_id, routing_status, assigned_at, last_message_at, created_at, updated_at";

export function getMessagingAdminClient() {
  return createAdminSupabaseClient();
}

export async function loadCompanyConversationAccessRecord(
  adminSupabase: ReturnType<typeof getMessagingAdminClient>,
  conversationId: string
): Promise<CompanyConversationAccessRecord | null> {
  const { data: conversation, error: conversationError } = await adminSupabase
    .from("conversations")
    .select(COMPANY_CONVERSATION_SELECT)
    .eq("id", conversationId)
    .eq("owner_mode", "company_workspace")
    .maybeSingle();

  if (conversationError || !conversation) {
    return null;
  }

  const { data: listing, error: listingError } = await adminSupabase
    .from("listings")
    .select(
      "id, slug, title, city, neighborhood, listing_status, listing_type, property_type, price_amount, currency_code, organization_id, assigned_agent_user_id"
    )
    .eq("id", conversation.listing_id)
    .maybeSingle();

  if (listingError || !listing) {
    return null;
  }

  return {
    conversation: conversation as CompanyConversationRow,
    listing: listing as CompanyConversationListingRow,
  };
}

export async function loadActiveOrganizationAssignableMembers(
  adminSupabase: ReturnType<typeof getMessagingAdminClient>,
  organizationId: string
): Promise<MessagingAssignableCompanyMember[]> {
  const { data, error } = await adminSupabase
    .from("organization_members")
    .select(
      "user_id, role, profile:profiles!organization_members_user_id_fkey(display_name)"
    )
    .eq("organization_id", organizationId)
    .eq("member_status", "active")
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (data as AssignableMemberRow[])
    .map((row) => ({
      userId: row.user_id,
      role: row.role,
      displayName: row.profile?.display_name?.trim() || `Member ${row.user_id.slice(0, 6)}`,
    }))
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

export async function resolveInitialCompanyConversationAssignee(
  adminSupabase: ReturnType<typeof getMessagingAdminClient>,
  organizationId: string | null,
  preferredUserId: string | null
) {
  if (!organizationId || !preferredUserId) {
    return null;
  }

  const { data, error } = await adminSupabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", preferredUserId)
    .eq("member_status", "active")
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.user_id;
}

export function buildCompanyRoutingSummary(input: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  routingStatus: MessagingCompanyRoutingSummary["routingStatus"];
  assignedMemberUserId: string | null;
  assignedMemberDisplayName: string | null;
  assignedMemberActive: boolean;
  queueAccess: "company_queue" | "assigned_only";
  canManageRouting: boolean;
}): MessagingCompanyRoutingSummary {
  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    organizationSlug: input.organizationSlug,
    routingStatus: input.routingStatus,
    assignedMemberUserId: input.assignedMemberUserId,
    assignedMemberDisplayName: input.assignedMemberDisplayName,
    assignedMemberActive: input.assignedMemberActive,
    queueAccess: input.queueAccess,
    canManageRouting: input.canManageRouting,
  };
}

export function buildCompanyRoutingDetail(input: {
  summary: MessagingCompanyRoutingSummary;
  membershipRole: MessagingCompanyRoutingDetail["membershipRole"];
  membershipStatus: MessagingCompanyRoutingDetail["membershipStatus"];
  assignableMembers: MessagingAssignableCompanyMember[];
}): MessagingCompanyRoutingDetail {
  return {
    ...input.summary,
    membershipRole: input.membershipRole,
    membershipStatus: input.membershipStatus,
    assignableMembers: input.assignableMembers,
  };
}

export function viewerCanAccessCompanyConversation(input: {
  viewerUserId: string;
  activeOrganizationId: string;
  membershipRole: MessagingCompanyRoutingDetail["membershipRole"];
  membershipStatus: MessagingCompanyRoutingDetail["membershipStatus"];
  conversation: Pick<CompanyConversationRow, "organization_id" | "assigned_member_user_id">;
}) {
  return canAccessCompanyConversation({
    viewerUserId: input.viewerUserId,
    activeOrganizationId: input.activeOrganizationId,
    membershipRole: input.membershipRole,
    membershipStatus: input.membershipStatus,
    conversationOrganizationId: input.conversation.organization_id,
    assignedMemberUserId: input.conversation.assigned_member_user_id,
  });
}

export async function loadCompanyConversationUnreadCount(
  adminSupabase: ReturnType<typeof getMessagingAdminClient>,
  conversationId: string,
  viewerUserId: string
) {
  const { count, error } = await adminSupabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .neq("sender_id", viewerUserId)
    .is("read_at", null);

  if (error) {
    return 0;
  }

  return count ?? 0;
}

export async function createListingImageSignedUrlForMessaging(
  supabase: SupabaseClient<Database>,
  storagePath: string
) {
  const { createListingImageSignedUrl } = await import(
    "@/lib/supabase/storage/listing-images"
  );

  return createListingImageSignedUrl(supabase, storagePath, 30 * 60);
}
