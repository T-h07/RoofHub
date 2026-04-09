import type { Enums, Tables } from "@/types/database";

export type MessagingErrorCode =
  | "auth_required"
  | "invalid_input"
  | "forbidden"
  | "not_found"
  | "not_contactable"
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

export type MessagingConversationRecord = Pick<
  Tables<"conversations">,
  "id" | "listing_id" | "provider_id" | "seeker_id" | "last_message_at" | "created_at" | "updated_at"
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
  unreadCount: number;
  lastMessage: MessagingMessageRecord | null;
};

export type MessagingConversationSummariesResult = {
  summaries: MessagingConversationSummary[];
  unreadTotalCount: number;
};

export type MessagingThreadResult = {
  conversation: MessagingConversationRecord;
  listing: MessagingListingSnippet | null;
  listingCoverImageUrl: string | null;
  participantRole: MessagingParticipantRole;
  counterpartUserId: string;
  messages: MessagingMessageRecord[];
  unreadCount: number;
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

export type LoadConversationSummariesInput = {
  limit?: number;
};

export type LoadConversationThreadInput = {
  conversationId: string;
  limit?: number;
};

export type ListingStatus = Enums<"listing_status">;
