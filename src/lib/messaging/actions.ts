"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import {
  notifyConversationInquiryCreated,
  notifyConversationMessageReceived,
  notifyConversationRoutingChanged,
} from "@/lib/notifications";
import type { Database, Tables } from "@/types/database";

import {
  getMessagingAdminClient,
  loadActiveOrganizationAssignableMembers,
  loadCompanyConversationAccessRecord,
  resolveInitialCompanyConversationAssignee,
  viewerCanAccessCompanyConversation,
} from "./company";
import { canManageCompanyConversationRouting } from "./authorization";
import { isListingContactableForNewConversation } from "./contact-rules";
import { getMessagingViewerContext, toMessagingFailure } from "./context";
import {
  loadMessagingConversationSummariesQuery,
  loadMessagingThreadQuery,
} from "./queries";
import {
  createInternalCompanyConversationMutation,
  loadInternalCompanyConversationSummariesQuery,
  loadInternalCompanyThreadQuery,
  markInternalCompanyConversationReadMutation,
  sendInternalCompanyMessageMutation,
} from "./internal-company";
import type {
  ConversationCreateResult,
  ConversationReadResult,
  ConversationSendMessageResult,
  CreateInternalConversationInput,
  CreateInternalConversationResult,
  CreateOrGetConversationInput,
  LoadConversationSummariesInput,
  LoadConversationThreadInput,
  LoadInternalConversationSummariesInput,
  LoadInternalConversationThreadInput,
  MarkConversationReadInput,
  MarkInternalConversationReadInput,
  MessagingConversationRecord,
  MessagingConversationSummariesResult,
  MessagingInternalConversationSummariesResult,
  MessagingInternalMessageRecord,
  MessagingInternalThreadResult,
  MessagingThreadResult,
  MessagingMessageRecord,
  MessagingResult,
  SendConversationMessageInput,
  SendInternalConversationMessageInput,
  UpdateConversationRoutingInput,
  UpdateConversationRoutingResult,
} from "./types";
import { isUuid, normalizeMessageBody } from "./validation";

const CONVERSATION_SELECT =
  "id, listing_id, provider_id, seeker_id, owner_mode, organization_id, assigned_member_user_id, routing_status, assigned_at, last_message_at, created_at, updated_at";
const MESSAGE_SELECT = "id, conversation_id, sender_id, body, read_at, created_at";

type ConversationEligibilityRow = Pick<
  Tables<"listings">,
  | "id"
  | "owner_id"
  | "title"
  | "listing_status"
  | "organization_id"
  | "assigned_agent_user_id"
>;

type AccessibleConversationRow = Pick<
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

function toTrafficFailure(
  result: Extract<Awaited<ReturnType<typeof enforceTrafficControl>>, { ok: false }>
) {
  return toMessagingFailure(result.reason === "throttled" ? "rate_limited" : "internal", result.message);
}

async function loadConversationEligibilityListing(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  const { data, error } = await supabase
    .from("listings")
    .select("id, owner_id, title, listing_status, organization_id, assigned_agent_user_id")
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

async function loadCompanyConversationForViewer(
  conversationId: string,
  viewer: Extract<
    Awaited<ReturnType<typeof getMessagingViewerContext>>,
    { ok: true }
  >["data"] & { mode: "company_workspace" }
) {
  const adminSupabase = getMessagingAdminClient();
  const record = await loadCompanyConversationAccessRecord(
    adminSupabase,
    conversationId
  );

  if (!record) {
    return {
      ok: false as const,
      failure: toMessagingFailure(
        "not_found",
        "Conversation not found or inaccessible."
      ),
    };
  }

  if (
    !viewerCanAccessCompanyConversation({
      viewerUserId: viewer.profile.id,
      activeOrganizationId: viewer.organization.id,
      membershipRole: viewer.membership.role,
      membershipStatus: viewer.membership.member_status,
      conversation: record.conversation,
    })
  ) {
    return {
      ok: false as const,
      failure: toMessagingFailure(
        "forbidden",
        "You do not have permission to access this company conversation."
      ),
    };
  }

  return {
    ok: true as const,
    record,
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

  const conversationCreationUserLimit = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingCreateConversationPerUser,
    identity: { userId: profile.id, includeIp: true },
    throttledMessage: "Too many new conversation attempts. Please wait before trying again.",
    unavailableMessage: "Conversation start is temporarily unavailable. Please retry shortly.",
  });
  if (!conversationCreationUserLimit.ok) {
    return toTrafficFailure(conversationCreationUserLimit);
  }

  const conversationCreationListingLimit = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingCreateConversationPerListing,
    identity: { userId: profile.id, scope: listing.id, includeIp: false },
    throttledMessage: "Too many attempts to open this conversation. Please wait before retrying.",
    unavailableMessage: "Conversation start is temporarily unavailable. Please retry shortly.",
  });
  if (!conversationCreationListingLimit.ok) {
    return toTrafficFailure(conversationCreationListingLimit);
  }

  let initialAssignedMemberUserId: string | null = null;
  if (listing.organization_id) {
    initialAssignedMemberUserId = await resolveInitialCompanyConversationAssignee(
      getMessagingAdminClient(),
      listing.organization_id,
      listing.assigned_agent_user_id
    );
  }

  const conversationInsert = {
    listing_id: listing.id,
    provider_id: listing.owner_id,
    seeker_id: profile.id,
    assigned_member_user_id: initialAssignedMemberUserId,
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(conversationInsert)
    .select(CONVERSATION_SELECT)
    .maybeSingle();

  if (!error && data) {
    await recordSecurityAuditEvent({
      supabase,
      event: {
        eventType: AUDIT_EVENT_TYPES.conversationCreated,
        actorUserId: profile.id,
        actorRole: profile.role,
        targetType: "conversation",
        targetId: data.id,
        listingId: listing.id,
        conversationId: data.id,
        metadata: {
          outcome: "created",
          participant_role: "seeker",
          owner_mode: data.owner_mode,
          organization_id: data.organization_id,
          routing_status: data.routing_status,
          assigned_member_user_id: data.assigned_member_user_id,
        },
      },
    });

    await notifyConversationInquiryCreated({
      conversationId: data.id,
      listingId: listing.id,
      listingTitle: listing.title,
      ownerMode: data.owner_mode,
      organizationId: data.organization_id,
      providerUserId: data.provider_id,
      seekerUserId: data.seeker_id,
      assignedMemberUserId: data.assigned_member_user_id,
    });

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
      await recordSecurityAuditEvent({
        supabase,
        event: {
          eventType: AUDIT_EVENT_TYPES.conversationCreated,
          actorUserId: profile.id,
          actorRole: profile.role,
          targetType: "conversation",
          targetId: existing.id,
          listingId: listing.id,
          conversationId: existing.id,
          metadata: {
            outcome: "existing",
            participant_role: "seeker",
            owner_mode: existing.owner_mode,
            organization_id: existing.organization_id,
            routing_status: existing.routing_status,
            assigned_member_user_id: existing.assigned_member_user_id,
          },
        },
      });

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
  let conversation: AccessibleConversationRow;

  if (contextResult.data.mode === "company_workspace") {
    const conversationResult = await loadCompanyConversationForViewer(
      input.conversationId,
      contextResult.data
    );
    if (!conversationResult.ok) {
      return conversationResult.failure;
    }

    conversation = conversationResult.record.conversation;
  } else {
    const conversationResult = await loadAccessibleConversationForViewer(
      supabase,
      input.conversationId
    );
    if (!conversationResult.ok) {
      return conversationResult.failure;
    }

    conversation = conversationResult.conversation;
    const isParticipant =
      conversation.provider_id === profile.id || conversation.seeker_id === profile.id;

    if (!isParticipant) {
      return toMessagingFailure(
        "forbidden",
        "You are not a participant in this conversation."
      );
    }
  }

  const messagePerConversationLimit = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingSendPerConversation,
    identity: { userId: profile.id, scope: conversation.id, includeIp: true },
    throttledMessage: "Message rate limit reached for this conversation.",
    unavailableMessage: "Message send is temporarily unavailable. Please retry shortly.",
  });
  if (!messagePerConversationLimit.ok) {
    return toTrafficFailure(messagePerConversationLimit);
  }

  const messagePerUserLimit = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingSendPerUser,
    identity: { userId: profile.id, includeIp: false },
    throttledMessage: "Message rate limit reached for your account.",
    unavailableMessage: "Message send is temporarily unavailable. Please retry shortly.",
  });
  if (!messagePerUserLimit.ok) {
    return toTrafficFailure(messagePerUserLimit);
  }

  const existingMessageCountResult = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversation.id);
  const isFirstMessageInConversation =
    !existingMessageCountResult.error && (existingMessageCountResult.count ?? 0) === 0;

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

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.messageSent,
      actorUserId: profile.id,
      actorRole: profile.role,
      targetType: "message",
      targetId: data.id,
      listingId: conversation.listing_id,
      conversationId: conversation.id,
      metadata: {
        body_length: normalizedBody.length,
        sender_role: profile.role,
        owner_mode: conversation.owner_mode,
        organization_id: conversation.organization_id,
        routing_status: conversation.routing_status,
        assigned_member_user_id: conversation.assigned_member_user_id,
      },
    },
  });

  await notifyConversationMessageReceived({
    conversationId: conversation.id,
    listingId: conversation.listing_id,
    ownerMode: conversation.owner_mode,
    organizationId: conversation.organization_id,
    providerUserId: conversation.provider_id,
    seekerUserId: conversation.seeker_id,
    assignedMemberUserId: conversation.assigned_member_user_id,
    senderUserId: profile.id,
    senderDisplayName: profile.display_name,
    messageId: data.id,
    messageBody: normalizedBody,
    isFirstMessageInConversation,
  });

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
  let conversation: AccessibleConversationRow;

  if (contextResult.data.mode === "company_workspace") {
    const conversationResult = await loadCompanyConversationForViewer(
      input.conversationId,
      contextResult.data
    );
    if (!conversationResult.ok) {
      return conversationResult.failure;
    }

    conversation = conversationResult.record.conversation;
  } else {
    const conversationResult = await loadAccessibleConversationForViewer(
      supabase,
      input.conversationId
    );
    if (!conversationResult.ok) {
      return conversationResult.failure;
    }

    conversation = conversationResult.conversation;
    const isParticipant =
      conversation.provider_id === profile.id || conversation.seeker_id === profile.id;

    if (!isParticipant) {
      return toMessagingFailure(
        "forbidden",
        "You are not a participant in this conversation."
      );
    }
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
      conversationId: conversation.id,
      markedReadCount: data?.length ?? 0,
    },
  };
}

export async function updateConversationRoutingAction(
  input: UpdateConversationRoutingInput
): Promise<MessagingResult<UpdateConversationRoutingResult>> {
  if (
    !isRecord(input) ||
    typeof input.conversationId !== "string" ||
    !isUuid(input.conversationId)
  ) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  if (
    input.assigneeUserId !== null &&
    (typeof input.assigneeUserId !== "string" || !isUuid(input.assigneeUserId))
  ) {
    return toMessagingFailure("invalid_input", "Assignee reference is invalid.");
  }

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  if (contextResult.data.mode !== "company_workspace") {
    return toMessagingFailure(
      "forbidden",
      "Conversation routing is available only inside an active RoofHub company workspace."
    );
  }

  const { supabase, profile, organization, membership } = contextResult.data;
  if (
    !canManageCompanyConversationRouting(
      membership.role,
      membership.member_status
    )
  ) {
    return toMessagingFailure(
      "forbidden",
      "Only owner, admin, or manager members can route company conversations."
    );
  }

  const conversationResult = await loadCompanyConversationForViewer(
    input.conversationId,
    contextResult.data
  );
  if (!conversationResult.ok) {
    return conversationResult.failure;
  }

  const { record } = conversationResult;

  if (
    !record.conversation.organization_id ||
    record.conversation.organization_id !== organization.id
  ) {
    return toMessagingFailure(
      "forbidden",
      "This conversation does not belong to the active RoofHub company workspace."
    );
  }

  const assignableMembers = await loadActiveOrganizationAssignableMembers(
    getMessagingAdminClient(),
    organization.id
  );
  const requestedAssignee =
    input.assigneeUserId === null
      ? null
      : assignableMembers.find((member) => member.userId === input.assigneeUserId) ??
        null;

  if (input.assigneeUserId !== null && !requestedAssignee) {
    return toMessagingFailure(
      "forbidden",
      "The selected handler is not an active member of this RoofHub company workspace."
    );
  }

  const trafficResult = await enforceTrafficControl({
    supabase,
    rule: TRAFFIC_CONTROL_RULES.companyMemberMutatePerUser,
    identity: {
      userId: profile.id,
      scope: `conversation-route:${input.conversationId}`,
      includeIp: false,
    },
    throttledMessage:
      "Too many conversation routing updates from this account. Please wait and retry.",
    unavailableMessage:
      "Conversation routing is temporarily unavailable. Please retry shortly.",
  });
  if (!trafficResult.ok) {
    return toTrafficFailure(trafficResult);
  }

  const previousAssigneeUserId = record.conversation.assigned_member_user_id;
  const previousAssigneeDisplayName =
    previousAssigneeUserId === null
      ? null
      : assignableMembers.find((member) => member.userId === previousAssigneeUserId)
          ?.displayName ?? null;

  if (previousAssigneeUserId === (requestedAssignee?.userId ?? null)) {
    return {
      ok: true,
      data: {
        conversationId: record.conversation.id,
        assignedMemberUserId: requestedAssignee?.userId ?? null,
        assignedAt: record.conversation.assigned_at,
        routingStatus: record.conversation.routing_status,
      },
    };
  }

  const nextAssignedAt = requestedAssignee?.userId ? new Date().toISOString() : null;
  const nextRoutingStatus = requestedAssignee?.userId
    ? "assigned_member"
    : "shared_queue";
  const { error } = await supabase
    .from("conversations")
    .update({
      assigned_member_user_id: requestedAssignee?.userId ?? null,
      assigned_at: nextAssignedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", record.conversation.id)
    .eq("owner_mode", "company_workspace")
    .eq("organization_id", organization.id);

  if (error) {
    const normalized = normalizeSupabaseError(
      error.message,
      "Conversation routing could not be updated right now.",
      "You do not have permission to update conversation routing in this workspace."
    );

    return toMessagingFailure(normalized.code, normalized.message);
  }

  const eventType =
    previousAssigneeUserId === null && requestedAssignee?.userId
      ? AUDIT_EVENT_TYPES.messagingConversationAssigned
      : requestedAssignee?.userId
        ? AUDIT_EVENT_TYPES.messagingConversationReassigned
        : AUDIT_EVENT_TYPES.messagingConversationUnassigned;

  await recordSecurityAuditEvent({
    supabase,
    event: {
      eventType,
      actorUserId: profile.id,
      actorRole: profile.role,
      targetType: "conversation",
      targetId: record.conversation.id,
      listingId: record.listing.id,
      conversationId: record.conversation.id,
      metadata: {
        organization_id: organization.id,
        previous_assigned_member_user_id: previousAssigneeUserId,
        previous_assigned_member_display_name: previousAssigneeDisplayName,
        assigned_member_user_id: requestedAssignee?.userId ?? null,
        assigned_member_display_name: requestedAssignee?.displayName ?? null,
        previous_routing_status: record.conversation.routing_status,
        next_routing_status: nextRoutingStatus,
        membership_role: membership.role,
      },
    },
  });

  await notifyConversationRoutingChanged({
    conversationId: record.conversation.id,
    listingId: record.listing.id,
    organizationId: organization.id,
    actorUserId: profile.id,
    previousAssigneeUserId,
    previousAssigneeDisplayName,
    nextAssigneeUserId: requestedAssignee?.userId ?? null,
    nextAssigneeDisplayName: requestedAssignee?.displayName ?? null,
    eventType,
  });

  return {
    ok: true,
    data: {
      conversationId: record.conversation.id,
      assignedMemberUserId: requestedAssignee?.userId ?? null,
      assignedAt: nextAssignedAt,
      routingStatus: nextRoutingStatus,
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

export async function loadInternalCompanyConversationSummariesAction(
  input: LoadInternalConversationSummariesInput = {}
): Promise<MessagingResult<MessagingInternalConversationSummariesResult>> {
  const normalizedInput = isRecord(input)
    ? {
        limit: readOptionalLimit(input.limit),
      }
    : {};

  return loadInternalCompanyConversationSummariesQuery(normalizedInput);
}

export async function loadInternalCompanyThreadAction(
  input: LoadInternalConversationThreadInput
): Promise<MessagingResult<MessagingInternalThreadResult>> {
  if (!isRecord(input) || typeof input.conversationId !== "string") {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  return loadInternalCompanyThreadQuery({
    conversationId: input.conversationId,
    limit: readOptionalLimit(input.limit),
  });
}

export async function createInternalCompanyConversationAction(
  input: CreateInternalConversationInput
): Promise<MessagingResult<CreateInternalConversationResult>> {
  if (!isRecord(input)) {
    return toMessagingFailure("invalid_input", "Conversation request is invalid.");
  }

  if (input.kind !== "direct" && input.kind !== "group") {
    return toMessagingFailure("invalid_input", "Conversation kind is invalid.");
  }

  return createInternalCompanyConversationMutation({
    kind: input.kind,
    participantUserIds: Array.isArray(input.participantUserIds)
      ? input.participantUserIds.filter(
          (participantUserId): participantUserId is string =>
            typeof participantUserId === "string"
        )
      : [],
    title: typeof input.title === "string" ? input.title : undefined,
  });
}

export async function sendInternalCompanyMessageAction(
  input: SendInternalConversationMessageInput
): Promise<
  MessagingResult<{
    conversationId: string;
    message: MessagingInternalMessageRecord;
  }>
> {
  if (!isRecord(input) || typeof input.conversationId !== "string") {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  return sendInternalCompanyMessageMutation({
    conversationId: input.conversationId,
    body: typeof input.body === "string" ? input.body : "",
  });
}

export async function markInternalCompanyConversationReadAction(
  input: MarkInternalConversationReadInput
): Promise<MessagingResult<ConversationReadResult>> {
  if (!isRecord(input) || typeof input.conversationId !== "string") {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  return markInternalCompanyConversationReadMutation(input.conversationId);
}
