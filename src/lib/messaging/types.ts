import type { Enums, Tables } from "@/types/database";
import type {
  OrganizationMemberRole,
  OrganizationMemberStatus,
} from "@/lib/company/team-types";
import type { MessagingCompanyQueueAccess } from "./authorization";

export type MessagingErrorCode =
  | "auth_required"
  | "invalid_input"
  | "forbidden"
  | "not_found"
  | "not_contactable"
  | "rate_limited"
  | "conflict"
  | "internal";

export type MessagingFailure = {
  ok: false;
  code: MessagingErrorCode;
  message: string;
  requiresAuth: boolean;
};

export type MessagingResult<TData> =
  | {
      ok: true;
      data: TData;
    }
  | MessagingFailure;

export type MessagingConversationOwnerMode = Enums<"conversation_owner_mode">;
export type MessagingConversationRoutingStatus = Enums<"conversation_routing_status">;

export type MessagingConversationRecord = Pick<
  Tables<"conversations">,
  | "id"
  | "listing_id"
  | "provider_id"
  | "seeker_id"
  | "owner_mode"
  | "organization_id"
  | "assigned_member_user_id"
  | "routing_status"
  | "assigned_at"
  | "last_message_at"
  | "created_at"
  | "updated_at"
>;

export type MessagingMessageRecord = Pick<
  Tables<"messages">,
  "id" | "conversation_id" | "sender_id" | "body" | "read_at" | "created_at"
>;

export type MessagingListingSnippet = Pick<
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
>;

export type MessagingParticipantRole = "provider" | "seeker";

export type MessagingInboxMode =
  | "seeker"
  | "individual_provider"
  | "company_workspace";

export type MessagingInboxContext = {
  viewerUserId: string;
  mode: MessagingInboxMode;
  workspaceName: string | null;
  workspaceSlug: string | null;
  workspaceOrganizationId: string | null;
  companyQueueAccess: MessagingCompanyQueueAccess | null;
};

export type MessagingAssignableCompanyMember = {
  userId: string;
  displayName: string;
  role: OrganizationMemberRole;
};

export type MessagingCompanyRoutingSummary = {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  routingStatus: MessagingConversationRoutingStatus;
  assignedMemberUserId: string | null;
  assignedMemberDisplayName: string | null;
  assignedMemberActive: boolean;
  queueAccess: MessagingCompanyQueueAccess;
  canManageRouting: boolean;
};

export type MessagingCompanyRoutingDetail = MessagingCompanyRoutingSummary & {
  membershipRole: OrganizationMemberRole;
  membershipStatus: OrganizationMemberStatus;
  assignableMembers: MessagingAssignableCompanyMember[];
};

export type ConversationCreateResult = {
  conversation: MessagingConversationRecord;
  created: boolean;
};

export type ConversationSendMessageResult = {
  conversationId: string;
  message: MessagingMessageRecord;
};

export type ConversationReadResult = {
  conversationId: string;
  markedReadCount: number;
};

export type MessagingConversationSummary = {
  conversation: MessagingConversationRecord;
  listing: MessagingListingSnippet | null;
  participantRole: MessagingParticipantRole;
  counterpartUserId: string;
  counterpartDisplayName: string | null;
  unreadCount: number;
  lastMessage: MessagingMessageRecord | null;
  companyRouting: MessagingCompanyRoutingSummary | null;
};

export type MessagingConversationSummariesResult = {
  summaries: MessagingConversationSummary[];
  unreadTotalCount: number;
  inbox: MessagingInboxContext;
};

export type MessagingThreadResult = {
  conversation: MessagingConversationRecord;
  listing: MessagingListingSnippet | null;
  listingCoverImageUrl: string | null;
  participantRole: MessagingParticipantRole;
  counterpartUserId: string;
  counterpartDisplayName: string | null;
  messages: MessagingMessageRecord[];
  unreadCount: number;
  companyRouting: MessagingCompanyRoutingDetail | null;
  inbox: MessagingInboxContext;
};

export type CreateOrGetConversationInput = {
  listingId: string;
};

export type SendConversationMessageInput = {
  conversationId: string;
  body: string;
};

export type MarkConversationReadInput = {
  conversationId: string;
};

export type UpdateConversationRoutingInput = {
  conversationId: string;
  assigneeUserId: string | null;
};

export type UpdateConversationRoutingResult = {
  conversationId: string;
  assignedMemberUserId: string | null;
};

export type LoadConversationSummariesInput = {
  limit?: number;
};

export type LoadConversationThreadInput = {
  conversationId: string;
  limit?: number;
};

export type ListingStatus = Enums<"listing_status">;
