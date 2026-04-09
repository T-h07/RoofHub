import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database";

import { getMessagingViewerContext, toMessagingFailure } from "./context";
import type {
  LoadConversationSummariesInput,
  LoadConversationThreadInput,
  MessagingConversationRecord,
  MessagingConversationSummariesResult,
  MessagingConversationSummary,
  MessagingListingSnippet,
  MessagingMessageRecord,
  MessagingResult,
  MessagingThreadResult,
} from "./types";
import { isUuid, toMessagePreview } from "./validation";

const CONVERSATION_SELECT = "id, listing_id, provider_id, seeker_id, last_message_at, created_at, updated_at";
const MESSAGE_SELECT = "id, conversation_id, sender_id, body, read_at, created_at";
const LISTING_SNIPPET_SELECT =
  "id, slug, title, city, neighborhood, listing_status, listing_type, property_type, price_amount, currency_code";

type ConversationRow = Pick<
  Tables<"conversations">,
  "id" | "listing_id" | "provider_id" | "seeker_id" | "last_message_at" | "created_at" | "updated_at"
>;

type MessageRow = Pick<
  Tables<"messages">,
  "id" | "conversation_id" | "sender_id" | "body" | "read_at" | "created_at"
>;

type ListingSnippetRow = Pick<
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

export type ProviderUnreadLeadCountResult =
  | {
      ok: true;
      count: number;
    }
  | {
      ok: false;
      count: number;
      message: string;
    };

function clampLimit(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function toConversationSummaryMessage(message: MessageRow): MessagingMessageRecord {
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    sender_id: message.sender_id,
    body: toMessagePreview(message.body),
    read_at: message.read_at,
    created_at: message.created_at,
  };
}

function toConversationRecord(row: ConversationRow): MessagingConversationRecord {
  return {
    id: row.id,
    listing_id: row.listing_id,
    provider_id: row.provider_id,
    seeker_id: row.seeker_id,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function loadLatestMessagesMap(
  supabase: SupabaseClient<Database>,
  conversationIds: string[]
): Promise<Map<string, MessagingMessageRecord>> {
  const latestRows = await Promise.all(
    conversationIds.map(async (conversationId) => {
      const { data, error } = await supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return toConversationSummaryMessage(data as MessageRow);
    })
  );

  return new Map(
    latestRows
      .filter((value): value is MessagingMessageRecord => Boolean(value))
      .map((message) => [message.conversation_id, message])
  );
}

export async function loadMessagingConversationSummariesQuery(
  input: LoadConversationSummariesInput = {}
): Promise<MessagingResult<MessagingConversationSummariesResult>> {
  const limit = clampLimit(input.limit, 40, 1, 120);

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  const { supabase, profile } = contextResult.data;

  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .or(`provider_id.eq.${profile.id},seeker_id.eq.${profile.id}`)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (error) {
    return toMessagingFailure("internal", "Conversations could not be loaded right now.");
  }

  const conversations = (data ?? []) as ConversationRow[];

  if (conversations.length === 0) {
    return {
      ok: true,
      data: {
        summaries: [],
        unreadTotalCount: 0,
      },
    };
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const listingIds = Array.from(new Set(conversations.map((conversation) => conversation.listing_id)));

  const [latestMessageMap, unreadRowsResult, listingRowsResult] = await Promise.all([
    loadLatestMessagesMap(supabase, conversationIds),
    supabase
      .from("messages")
      .select("conversation_id")
      .in("conversation_id", conversationIds)
      .neq("sender_id", profile.id)
      .is("read_at", null),
    supabase.from("listings").select(LISTING_SNIPPET_SELECT).in("id", listingIds),
  ]);

  if (unreadRowsResult.error) {
    return toMessagingFailure("internal", "Unread message state could not be loaded.");
  }

  const unreadCountMap = new Map<string, number>();
  for (const unreadRow of unreadRowsResult.data ?? []) {
    unreadCountMap.set(
      unreadRow.conversation_id,
      (unreadCountMap.get(unreadRow.conversation_id) ?? 0) + 1
    );
  }

  const listingMap = new Map<string, MessagingListingSnippet>();
  if (!listingRowsResult.error) {
    for (const listingRow of listingRowsResult.data ?? []) {
      const row = listingRow as ListingSnippetRow;
      listingMap.set(row.id, {
        id: row.id,
        slug: row.slug,
        title: row.title,
        city: row.city,
        neighborhood: row.neighborhood,
        listing_status: row.listing_status,
        listing_type: row.listing_type,
        property_type: row.property_type,
        price_amount: row.price_amount,
        currency_code: row.currency_code,
      });
    }
  }

  const summaries: MessagingConversationSummary[] = conversations.map((conversation) => {
    const participantRole = conversation.provider_id === profile.id ? "provider" : "seeker";
    const counterpartUserId =
      participantRole === "provider" ? conversation.seeker_id : conversation.provider_id;

    return {
      conversation: toConversationRecord(conversation),
      listing: listingMap.get(conversation.listing_id) ?? null,
      participantRole,
      counterpartUserId,
      unreadCount: unreadCountMap.get(conversation.id) ?? 0,
      lastMessage: latestMessageMap.get(conversation.id) ?? null,
    };
  });

  return {
    ok: true,
    data: {
      summaries,
      unreadTotalCount: summaries.reduce((total, summary) => total + summary.unreadCount, 0),
    },
  };
}

export async function loadMessagingThreadQuery(
  input: LoadConversationThreadInput
): Promise<MessagingResult<MessagingThreadResult>> {
  if (!isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  const limit = clampLimit(input.limit, 180, 1, 400);

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  const { supabase, profile } = contextResult.data;

  const conversationResult = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationResult.error || !conversationResult.data) {
    return toMessagingFailure("not_found", "Conversation not found or inaccessible.");
  }

  const conversation = conversationResult.data as ConversationRow;
  const participantRole = conversation.provider_id === profile.id ? "provider" : "seeker";
  const counterpartUserId =
    participantRole === "provider" ? conversation.seeker_id : conversation.provider_id;

  const [messagesResult, listingResult, unreadCountResult] = await Promise.all([
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(limit),
    supabase
      .from("listings")
      .select(LISTING_SNIPPET_SELECT)
      .eq("id", conversation.listing_id)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation.id)
      .neq("sender_id", profile.id)
      .is("read_at", null),
  ]);

  if (messagesResult.error) {
    return toMessagingFailure("internal", "Conversation messages could not be loaded right now.");
  }

  const messages: MessagingMessageRecord[] = (messagesResult.data ?? []).map((row) => {
    const message = row as MessageRow;

    return {
      id: message.id,
      conversation_id: message.conversation_id,
      sender_id: message.sender_id,
      body: message.body,
      read_at: message.read_at,
      created_at: message.created_at,
    };
  });

  const listing: MessagingListingSnippet | null =
    !listingResult.error && listingResult.data
      ? {
          id: (listingResult.data as ListingSnippetRow).id,
          slug: (listingResult.data as ListingSnippetRow).slug,
          title: (listingResult.data as ListingSnippetRow).title,
          city: (listingResult.data as ListingSnippetRow).city,
          neighborhood: (listingResult.data as ListingSnippetRow).neighborhood,
          listing_status: (listingResult.data as ListingSnippetRow).listing_status,
          listing_type: (listingResult.data as ListingSnippetRow).listing_type,
          property_type: (listingResult.data as ListingSnippetRow).property_type,
          price_amount: (listingResult.data as ListingSnippetRow).price_amount,
          currency_code: (listingResult.data as ListingSnippetRow).currency_code,
        }
      : null;

  return {
    ok: true,
    data: {
      conversation: toConversationRecord(conversation),
      listing,
      participantRole,
      counterpartUserId,
      messages,
      unreadCount: unreadCountResult.error ? 0 : unreadCountResult.count ?? 0,
    },
  };
}

export async function loadProviderUnreadLeadCount(
  supabase: SupabaseClient<Database>,
  providerUserId: string
): Promise<ProviderUnreadLeadCountResult> {
  if (!isUuid(providerUserId)) {
    return {
      ok: false,
      count: 0,
      message: "Provider user reference is invalid.",
    };
  }

  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("provider_id", providerUserId);

  if (conversationError) {
    return {
      ok: false,
      count: 0,
      message: "Unread lead count could not be loaded.",
    };
  }

  const conversationIds = (conversations ?? []).map((row) => row.id);
  if (conversationIds.length === 0) {
    return {
      ok: true,
      count: 0,
    };
  }

  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", conversationIds)
    .neq("sender_id", providerUserId)
    .is("read_at", null);

  if (error) {
    return {
      ok: false,
      count: 0,
      message: "Unread lead count could not be loaded.",
    };
  }

  return {
    ok: true,
    count: count ?? 0,
  };
}