import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { Database, Tables } from "@/types/database";

import type {
  MessagingAssignableCompanyMember,
  MessagingCompanyRoutingDetail,
  MessagingCompanyRoutingSummary,
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

export type CompanyConversationRow = Pick<
  Tables<"conversations">,
  | "id"
  | "listing_id"
  | "provider_id"
  | "seeker_id"
  | "last_message_at"
  | "created_at"
  | "updated_at"
>;

export type CompanyConversationAccessRecord = {
  conversation: CompanyConversationRow;
  listing: CompanyConversationListingRow;
};

type AssignableMemberRow = Pick<Tables<"organization_members">, "user_id" | "role"> & {
  profile: Pick<Tables<"profiles">, "display_name"> | null;
};

export function getMessagingAdminClient() {
  return createAdminSupabaseClient();
}

export async function loadCompanyConversationAccessRecord(
  adminSupabase: ReturnType<typeof getMessagingAdminClient>,
  conversationId: string
): Promise<CompanyConversationAccessRecord | null> {
  const { data, error } = await adminSupabase
    .from("conversations")
    .select(
      "id, listing_id, provider_id, seeker_id, last_message_at, created_at, updated_at, listing:listings!conversations_listing_provider_fk(id, slug, title, city, neighborhood, listing_status, listing_type, property_type, price_amount, currency_code, organization_id, assigned_agent_user_id)"
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data || !data.listing) {
    return null;
  }

  return {
    conversation: {
      id: data.id,
      listing_id: data.listing_id,
      provider_id: data.provider_id,
      seeker_id: data.seeker_id,
      last_message_at: data.last_message_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
    listing: data.listing as CompanyConversationListingRow,
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

export function buildCompanyRoutingSummary(input: {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  assignedAgentUserId: string | null;
  assignedAgentDisplayName: string | null;
  queueAccess: "company_queue" | "assigned_only";
  canManageRouting: boolean;
}): MessagingCompanyRoutingSummary {
  return {
    organizationId: input.organizationId,
    organizationName: input.organizationName,
    organizationSlug: input.organizationSlug,
    assignedAgentUserId: input.assignedAgentUserId,
    assignedAgentDisplayName: input.assignedAgentDisplayName,
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
  listing: Pick<
    CompanyConversationListingRow,
    "organization_id" | "assigned_agent_user_id"
  >;
}) {
  return canAccessCompanyConversation({
    viewerUserId: input.viewerUserId,
    activeOrganizationId: input.activeOrganizationId,
    membershipRole: input.membershipRole,
    membershipStatus: input.membershipStatus,
    listingOrganizationId: input.listing.organization_id,
    assignedAgentUserId: input.listing.assigned_agent_user_id,
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
