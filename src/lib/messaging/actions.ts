"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database";

import { isListingContactableForNewConversation } from "./contact-rules";
import { getMessagingViewerContext, toMessagingFailure } from "./context";
import {
  loadMessagingConversationSummariesQuery,
  loadMessagingThreadQuery,
} from "./queries";
import type {
  ConversationCreateResult,
  ConversationReadResult,
  ConversationSendMessageResult,
  CreateOrGetConversationInput,
  LoadConversationSummariesInput,
  LoadConversationThreadInput,
  MarkConversationReadInput,
  MessagingConversationRecord,
  MessagingConversationSummariesResult,
  MessagingThreadResult,
  MessagingMessageRecord,
  MessagingResult,
  SendConversationMessageInput,
} from "./types";
import { isUuid, normalizeMessageBody } from "./validation";

const CONVERSATION_SELECT = "id, listing_id, provider_id, seeker_id, last_message_at, created_at, updated_at";
const MESSAGE_SELECT = "id, conversation_id, sender_id, body, read_at, created_at";

type ConversationEligibilityRow = Pick<Tables<"listings">, "id" | "owner_id" | "listing_status">;

type AccessibleConversationRow = Pick<
  Tables<"conversations">,
  "id" | "listing_id" | "provider_id" | "seeker_id" | "last_message_at" | "created_at" | "updated_at"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function readOptionalLimit(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function normalizeSupabaseError(
  message: string,
  fallback: string,
  forbiddenFallback = "You do not have permission to perform this conversation action."
) {
  const normalized = message.toLowerCase();

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return {
      code: "forbidden" as const,
      message: forbiddenFallback,
    };
  }

  if (normalized.includes("check constraint") || normalized.includes("violates check constraint")) {
    return {
      code: "invalid_input" as const,
      message: "Message payload failed validation.",
    };
  }

  return {
    code: "internal" as const,
    message: fallback,
  };
}

async function loadConversationEligibilityListing(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id, listing_status")
    .eq("id", listingId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      failure: toMessagingFailure("not_found", "Listing not found or unavailable for messaging."),
    };
  }

  return {
    ok: true as const,
    listing: data as ConversationEligibilityRow,
  };
}

async function loadAccessibleConversationForViewer(
  supabase: SupabaseClient<Database>,
  conversationId: string
) {
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false as const,
      failure: toMessagingFailure("not_found", "Conversation not found or inaccessible."),
    };
  }

  return {
    ok: true as const,
    conversation: data as AccessibleConversationRow,
  };
}

export async function createOrGetConversationForListingAction(
  input: CreateOrGetConversationInput
): Promise<MessagingResult<ConversationCreateResult>> {
  if (!isRecord(input) || typeof input.listingId !== "string" || !isUuid(input.listingId)) {
    return toMessagingFailure("invalid_input", "Listing reference is invalid.");
  }

  const listingId = input.listingId;

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  const { supabase, profile } = contextResult.data;

  if (profile.role !== "seeker") {
    return toMessagingFailure("forbidden", "Only seeker accounts can initiate new listing conversations.");
  }

  const listingResult = await loadConversationEligibilityListing(supabase, listingId);
  if (!listingResult.ok) {
    return listingResult.failure;
  }

  const listing = listingResult.listing;

  if (listing.owner_id === profile.id) {
    return toMessagingFailure("forbidden", "You cannot open a conversation with your own listing.");
  }

  if (!isListingContactableForNewConversation(listing.listing_status)) {
    return toMessagingFailure(
      "not_contactable",
      "This listing is not currently accepting new conversations."
    );
  }

  const conversationInsert = {
    listing_id: listing.id,
    provider_id: listing.owner_id,
    seeker_id: profile.id,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(conversationInsert)
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (!error && data) {
    return {
      ok: true,
      data: {
        conversation: data as MessagingConversationRecord,
        created: true,
      },
    };
  }

  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await supabase
      .from("conversations")
      .select(CONVERSATION_SELECT)
      .eq("listing_id", listing.id)
      .eq("provider_id", listing.owner_id)
      .eq("seeker_id", profile.id)
      .maybeSingle();

    if (!existingError && existing) {
      return {
        ok: true,
        data: {
          conversation: existing as MessagingConversationRecord,
          created: false,
        },
      };
    }

    return toMessagingFailure(
      "conflict",
      "Conversation already exists but could not be loaded. Please retry."
    );
  }

  if (error) {
    const normalized = normalizeSupabaseError(
      error.message,
      "Conversation could not be created right now.",
      "You do not have permission to open this conversation."
    );

    return toMessagingFailure(normalized.code, normalized.message);
  }

  return toMessagingFailure("internal", "Conversation could not be created right now.");
}

export async function sendConversationMessageAction(
  input: SendConversationMessageInput
): Promise<MessagingResult<ConversationSendMessageResult>> {
  if (!isRecord(input) || typeof input.conversationId !== "string") {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  if (!isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  if (typeof input.body !== "string") {
    return toMessagingFailure("invalid_input", "Message body is invalid.");
  }

  const normalizedBody = normalizeMessageBody(input.body);
  if (!normalizedBody) {
    return toMessagingFailure("invalid_input", "Message must be between 1 and 2000 characters.");
  }

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  const { supabase, profile } = contextResult.data;

  const conversationResult = await loadAccessibleConversationForViewer(
    supabase,
    input.conversationId
  );
  if (!conversationResult.ok) {
    return conversationResult.failure;
  }

  const conversation = conversationResult.conversation;
  const isParticipant =
    conversation.provider_id === profile.id || conversation.seeker_id === profile.id;

  if (!isParticipant) {
    return toMessagingFailure("forbidden", "You are not a participant in this conversation.");
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_id: profile.id,
      body: normalizedBody,
    })
    .select(MESSAGE_SELECT)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      const normalized = normalizeSupabaseError(
        error.message,
        "Message could not be sent right now.",
        "You do not have permission to send a message in this conversation."
      );

      return toMessagingFailure(normalized.code, normalized.message);
    }

    return toMessagingFailure("internal", "Message could not be sent right now.");
  }

  return {
    ok: true,
    data: {
      conversationId: conversation.id,
      message: data as MessagingMessageRecord,
    },
  };
}

export async function markConversationReadAction(
  input: MarkConversationReadInput
): Promise<MessagingResult<ConversationReadResult>> {
  if (!isRecord(input) || typeof input.conversationId !== "string" || !isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  const { supabase, profile } = contextResult.data;

  const conversationResult = await loadAccessibleConversationForViewer(
    supabase,
    input.conversationId
  );
  if (!conversationResult.ok) {
    return conversationResult.failure;
  }
  const conversation = conversationResult.conversation;
  const isParticipant =
    conversation.provider_id === profile.id || conversation.seeker_id === profile.id;

  if (!isParticipant) {
    return toMessagingFailure("forbidden", "You are not a participant in this conversation.");
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .update({
      read_at: nowIso,
    })
    .eq("conversation_id", input.conversationId)
    .neq("sender_id", profile.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    const normalized = normalizeSupabaseError(
      error.message,
      "Conversation read state could not be updated.",
      "You do not have permission to update read state for this conversation."
    );

    return toMessagingFailure(normalized.code, normalized.message);
  }

  return {
    ok: true,
    data: {
      conversationId: input.conversationId,
      markedReadCount: data?.length ?? 0,
    },
  };
}

export async function loadMessagingConversationSummariesAction(
  input: LoadConversationSummariesInput = {}
): Promise<MessagingResult<MessagingConversationSummariesResult>> {
  const normalizedInput = isRecord(input)
    ? {
        limit: readOptionalLimit(input.limit),
      }
    : {};

  return loadMessagingConversationSummariesQuery(normalizedInput);
}

export async function loadMessagingThreadAction(
  input: LoadConversationThreadInput
): Promise<MessagingResult<MessagingThreadResult>> {
  if (!isRecord(input) || typeof input.conversationId !== "string") {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  return loadMessagingThreadQuery({
    conversationId: input.conversationId,
    limit: readOptionalLimit(input.limit),
  });
}
