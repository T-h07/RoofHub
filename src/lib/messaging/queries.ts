import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Tables } from "@/types/database";
import {
  buildCompanyRoutingDetail,
  buildCompanyRoutingSummary,
  createListingImageSignedUrlForMessaging,
  getMessagingAdminClient,
  loadActiveOrganizationAssignableMembers,
  loadCompanyConversationAccessRecord,
  loadCompanyConversationUnreadCount,
  viewerCanAccessCompanyConversation,
} from "@/lib/messaging/company";
import { createListingImageSignedUrl } from "@/lib/supabase/storage/listing-images";

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

const CONVERSATION_SELECT =
  "id, listing_id, provider_id, seeker_id, owner_mode, organization_id, assigned_member_user_id, routing_status, assigned_at, last_message_at, created_at, updated_at";
const MESSAGE_SELECT = "id, conversation_id, sender_id, body, read_at, created_at";
const LISTING_SNIPPET_SELECT =
  "id, slug, title, city, neighborhood, listing_status, listing_type, property_type, price_amount, currency_code";
const LISTING_COVER_IMAGE_SELECT = "storage_path, is_cover, sort_order";
const PROFILE_DISPLAY_NAME_SELECT = "id, display_name";

type ConversationRow = Pick<
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

type ListingCoverImageRow = Pick<Tables<"listing_images">, "storage_path" | "is_cover" | "sort_order">;
type ProfileDisplayNameRow = Pick<Tables<"profiles">, "id" | "display_name">;

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
    owner_mode: row.owner_mode,
    organization_id: row.organization_id,
    assigned_member_user_id: row.assigned_member_user_id,
    routing_status: row.routing_status,
    assigned_at: row.assigned_at,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isConversationParticipant(conversation: ConversationRow, userId: string) {
  return conversation.provider_id === userId || conversation.seeker_id === userId;
}

async function loadLatestMessagesMap(
  supabase: SupabaseClient<Database>,
  conversationIds: string[]
): Promise<Map<string, MessagingMessageRecord>> {
  const latestMessageMap = new Map<string, MessagingMessageRecord>();
  if (conversationIds.length === 0) {
    return latestMessageMap;
  }

  const { data, error } = await supabase
    .from("messages")
    .select(MESSAGE_SELECT)
    .in("conversation_id", conversationIds)
    .order("conversation_id", { ascending: true })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return latestMessageMap;
  }

  for (const row of data as MessageRow[]) {
    if (latestMessageMap.has(row.conversation_id)) {
      continue;
    }

    latestMessageMap.set(
      row.conversation_id,
      toConversationSummaryMessage(row)
    );

    if (latestMessageMap.size === conversationIds.length) {
      break;
    }
  }

  return latestMessageMap;
}

async function loadListingSnippetMap(
  supabase: SupabaseClient<Database>,
  listingIds: string[]
) {
  if (listingIds.length === 0) {
    return new Map<string, MessagingListingSnippet>();
  }

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SNIPPET_SELECT)
    .in("id", listingIds);

  const listingMap = new Map<string, MessagingListingSnippet>();
  if (error || !data) {
    return listingMap;
  }

  for (const row of data as ListingSnippetRow[]) {
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

  return listingMap;
}

async function loadDisplayNameMap(
  supabase: SupabaseClient<Database>,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_DISPLAY_NAME_SELECT)
    .in("id", userIds);

  const profileDisplayNameMap = new Map<string, string>();
  if (error || !data) {
    return profileDisplayNameMap;
  }

  for (const row of data as ProfileDisplayNameRow[]) {
    const normalizedName = row.display_name.trim();
    if (normalizedName.length > 0) {
      profileDisplayNameMap.set(row.id, normalizedName);
    }
  }

  return profileDisplayNameMap;
}

async function loadUnreadCountMap(
  supabase: SupabaseClient<Database>,
  conversationIds: string[],
  viewerUserId: string
) {
  const unreadCountMap = new Map<string, number>();
  if (conversationIds.length === 0) {
    return unreadCountMap;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", conversationIds)
    .neq("sender_id", viewerUserId)
    .is("read_at", null);

  if (error) {
    return unreadCountMap;
  }

  for (const row of data ?? []) {
    unreadCountMap.set(
      row.conversation_id,
      (unreadCountMap.get(row.conversation_id) ?? 0) + 1
    );
  }

  return unreadCountMap;
}

async function loadCompanyMessagingConversationSummariesQuery(
  viewer: Extract<
    Awaited<ReturnType<typeof getMessagingViewerContext>>,
    { ok: true }
  >["data"] & { mode: "company_workspace" },
  limit: number
): Promise<MessagingResult<MessagingConversationSummariesResult>> {
  const adminSupabase = getMessagingAdminClient();
  let conversationQuery = adminSupabase
    .from("conversations")
    .select(CONVERSATION_SELECT)
    .eq("owner_mode", "company_workspace")
    .eq("organization_id", viewer.organization.id)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (viewer.inbox.companyQueueAccess === "assigned_only") {
    conversationQuery = conversationQuery.eq(
      "assigned_member_user_id",
      viewer.profile.id
    );
  }

  const { data: conversationRows, error: conversationError } = await conversationQuery;

  if (conversationError) {
    return toMessagingFailure(
      "internal",
      "Company conversations could not be loaded right now."
    );
  }

  const conversations = (conversationRows ?? []) as ConversationRow[];
  if (conversations.length === 0) {
    return {
      ok: true,
      data: {
        summaries: [],
        unreadTotalCount: 0,
        inbox: viewer.inbox,
      },
    };
  }

  const conversationIds = conversations.map((conversation) => conversation.id);
  const listingIds = Array.from(new Set(conversations.map((conversation) => conversation.listing_id)));
  const seekerIds = Array.from(new Set(conversations.map((conversation) => conversation.seeker_id)));
  const assigneeIds = Array.from(
    new Set(
      conversations
        .map((conversation) => conversation.assigned_member_user_id)
        .filter((value): value is string => typeof value === "string")
    )
  );

  const [
    latestMessageMap,
    unreadCountMap,
    listingMap,
    seekerDisplayNameMap,
    assigneeDisplayNameMap,
    activeAssignableMembers,
  ] = await Promise.all([
    loadLatestMessagesMap(adminSupabase, conversationIds),
    loadUnreadCountMap(adminSupabase, conversationIds, viewer.profile.id),
    loadListingSnippetMap(adminSupabase, listingIds),
    loadDisplayNameMap(adminSupabase, seekerIds),
    loadDisplayNameMap(adminSupabase, assigneeIds),
    loadActiveOrganizationAssignableMembers(adminSupabase, viewer.organization.id),
  ]);

  const activeAssignableMemberIds = new Set(
    activeAssignableMembers.map((member) => member.userId)
  );

  const summaries: MessagingConversationSummary[] = conversations.map(
    (conversation) => {
      const assignedMemberUserId = conversation.assigned_member_user_id;

      return {
        conversation: toConversationRecord(conversation),
        listing: listingMap.get(conversation.listing_id) ?? null,
        participantRole: "provider",
        counterpartUserId: conversation.seeker_id,
        counterpartDisplayName:
          seekerDisplayNameMap.get(conversation.seeker_id) ?? null,
        unreadCount: unreadCountMap.get(conversation.id) ?? 0,
        lastMessage: latestMessageMap.get(conversation.id) ?? null,
        companyRouting: buildCompanyRoutingSummary({
          organizationId: viewer.organization.id,
          organizationName: viewer.organization.name,
          organizationSlug: viewer.organization.slug,
          routingStatus: conversation.routing_status,
          assignedMemberUserId,
          assignedMemberDisplayName: assignedMemberUserId
            ? assigneeDisplayNameMap.get(assignedMemberUserId) ?? null
            : null,
          assignedMemberActive: assignedMemberUserId
            ? activeAssignableMemberIds.has(assignedMemberUserId)
            : false,
          queueAccess: viewer.inbox.companyQueueAccess,
          canManageRouting: viewer.canManageRouting,
        }),
      };
    }
  );

  return {
    ok: true,
    data: {
      summaries,
      unreadTotalCount: summaries.reduce(
        (total, summary) => total + summary.unreadCount,
        0
      ),
      inbox: viewer.inbox,
    },
  };
}

async function loadCompanyMessagingThreadQuery(
  viewer: Extract<
    Awaited<ReturnType<typeof getMessagingViewerContext>>,
    { ok: true }
  >["data"] & { mode: "company_workspace" },
  input: LoadConversationThreadInput & { conversationId: string }
): Promise<MessagingResult<MessagingThreadResult>> {
  const adminSupabase = getMessagingAdminClient();
  const record = await loadCompanyConversationAccessRecord(
    adminSupabase,
    input.conversationId
  );

  if (!record) {
    return toMessagingFailure("not_found", "Conversation not found or inaccessible.");
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
    return toMessagingFailure(
      "forbidden",
      "You do not have permission to access this company conversation."
    );
  }

  const limit = clampLimit(input.limit, 180, 1, 400);
  const assignedMemberUserId = record.conversation.assigned_member_user_id;
  const [
    messagesResult,
    unreadCount,
    listingCoverImageResult,
    seekerProfileResult,
    assigneeProfileResult,
    activeAssignableMembers,
  ] = await Promise.all([
    adminSupabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("conversation_id", record.conversation.id)
      .order("created_at", { ascending: true })
      .limit(limit),
    loadCompanyConversationUnreadCount(
      adminSupabase,
      record.conversation.id,
      viewer.profile.id
    ),
    adminSupabase
      .from("listing_images")
      .select(LISTING_COVER_IMAGE_SELECT)
      .eq("listing_id", record.listing.id)
      .order("is_cover", { ascending: false })
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    adminSupabase
      .from("profiles")
      .select(PROFILE_DISPLAY_NAME_SELECT)
      .eq("id", record.conversation.seeker_id)
      .maybeSingle(),
    assignedMemberUserId
      ? adminSupabase
          .from("profiles")
          .select(PROFILE_DISPLAY_NAME_SELECT)
          .eq("id", assignedMemberUserId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadActiveOrganizationAssignableMembers(adminSupabase, viewer.organization.id),
  ]);

  if (messagesResult.error) {
    return toMessagingFailure(
      "internal",
      "Conversation messages could not be loaded right now."
    );
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

  let listingCoverImageUrl: string | null = null;
  if (!listingCoverImageResult.error && listingCoverImageResult.data) {
    try {
      listingCoverImageUrl = await createListingImageSignedUrlForMessaging(
        adminSupabase,
        (listingCoverImageResult.data as ListingCoverImageRow).storage_path
      );
    } catch {
      listingCoverImageUrl = null;
    }
  }

  const counterpartDisplayName =
    !seekerProfileResult.error && seekerProfileResult.data
      ? (seekerProfileResult.data as ProfileDisplayNameRow).display_name.trim() ||
        null
      : null;

  const assignedMemberDisplayName =
    assignedMemberUserId === null
      ? null
      : !assigneeProfileResult.error && assigneeProfileResult.data
        ? (assigneeProfileResult.data as ProfileDisplayNameRow).display_name.trim() ||
          null
        : activeAssignableMembers.find((member) => member.userId === assignedMemberUserId)
              ?.displayName ?? null;

  const activeAssignableMemberIds = new Set(
    activeAssignableMembers.map((member) => member.userId)
  );

  return {
    ok: true,
    data: {
      conversation: toConversationRecord(record.conversation),
      listing: {
        id: record.listing.id,
        slug: record.listing.slug,
        title: record.listing.title,
        city: record.listing.city,
        neighborhood: record.listing.neighborhood,
        listing_status: record.listing.listing_status,
        listing_type: record.listing.listing_type,
        property_type: record.listing.property_type,
        price_amount: record.listing.price_amount,
        currency_code: record.listing.currency_code,
      },
      listingCoverImageUrl,
      participantRole: "provider",
      counterpartUserId: record.conversation.seeker_id,
      counterpartDisplayName,
      messages,
      unreadCount,
      companyRouting: buildCompanyRoutingDetail({
        summary: buildCompanyRoutingSummary({
          organizationId: viewer.organization.id,
          organizationName: viewer.organization.name,
          organizationSlug: viewer.organization.slug,
          routingStatus: record.conversation.routing_status,
          assignedMemberUserId,
          assignedMemberDisplayName,
          assignedMemberActive: assignedMemberUserId
            ? activeAssignableMemberIds.has(assignedMemberUserId)
            : false,
          queueAccess: viewer.inbox.companyQueueAccess,
          canManageRouting: viewer.canManageRouting,
        }),
        membershipRole: viewer.membership.role,
        membershipStatus: viewer.membership.member_status,
        assignableMembers: viewer.canManageRouting ? activeAssignableMembers : [],
      }),
      inbox: viewer.inbox,
    },
  };
}

export async function loadMessagingConversationSummariesQuery(
  input: LoadConversationSummariesInput = {}
): Promise<MessagingResult<MessagingConversationSummariesResult>> {
  const normalizedInput =
    input && typeof input === "object" ? (input as LoadConversationSummariesInput) : {};
  const limit = clampLimit(normalizedInput.limit, 40, 1, 120);

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  if (contextResult.data.mode === "company_workspace") {
    return loadCompanyMessagingConversationSummariesQuery(
      contextResult.data,
      limit
    );
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
  const participantConversations = conversations.filter((conversation) =>
    isConversationParticipant(conversation, profile.id)
  );

  if (participantConversations.length === 0) {
    return {
      ok: true,
      data: {
        summaries: [],
        unreadTotalCount: 0,
        inbox: contextResult.data.inbox,
      },
    };
  }

  const conversationIds = participantConversations.map((conversation) => conversation.id);
  const listingIds = Array.from(
    new Set(participantConversations.map((conversation) => conversation.listing_id))
  );
  const counterpartUserIds = Array.from(
    new Set(
      participantConversations.map((conversation) =>
        conversation.provider_id === profile.id ? conversation.seeker_id : conversation.provider_id
      )
    )
  );

  const [latestMessageMap, unreadCountMap, listingMap, profileDisplayNameMap] = await Promise.all([
    loadLatestMessagesMap(supabase, conversationIds),
    loadUnreadCountMap(supabase, conversationIds, profile.id),
    loadListingSnippetMap(supabase, listingIds),
    loadDisplayNameMap(supabase, counterpartUserIds),
  ]);

  const summaries: MessagingConversationSummary[] = participantConversations.map((conversation) => {
    const participantRole = conversation.provider_id === profile.id ? "provider" : "seeker";
    const counterpartUserId =
      participantRole === "provider" ? conversation.seeker_id : conversation.provider_id;

    return {
      conversation: toConversationRecord(conversation),
      listing: listingMap.get(conversation.listing_id) ?? null,
      participantRole,
      counterpartUserId,
      counterpartDisplayName: profileDisplayNameMap.get(counterpartUserId) ?? null,
      unreadCount: unreadCountMap.get(conversation.id) ?? 0,
      lastMessage: latestMessageMap.get(conversation.id) ?? null,
      companyRouting: null,
    };
  });

  return {
    ok: true,
    data: {
      summaries,
      unreadTotalCount: summaries.reduce((total, summary) => total + summary.unreadCount, 0),
      inbox: contextResult.data.inbox,
    },
  };
}

export async function loadMessagingThreadQuery(
  input: LoadConversationThreadInput
): Promise<MessagingResult<MessagingThreadResult>> {
  if (!input || typeof input !== "object" || !isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  const limit = clampLimit(input.limit, 180, 1, 400);

  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  if (contextResult.data.mode === "company_workspace") {
    return loadCompanyMessagingThreadQuery(contextResult.data, {
      conversationId: input.conversationId,
      limit: input.limit,
    });
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
  if (!isConversationParticipant(conversation, profile.id)) {
    return toMessagingFailure("forbidden", "You are not a participant in this conversation.");
  }

  const participantRole = conversation.provider_id === profile.id ? "provider" : "seeker";
  const counterpartUserId =
    participantRole === "provider" ? conversation.seeker_id : conversation.provider_id;

  const [messagesResult, listingMap, unreadCountResult, listingCoverImageResult, counterpartProfileResult] =
    await Promise.all([
      supabase
        .from("messages")
        .select(MESSAGE_SELECT)
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
        .limit(limit),
      loadListingSnippetMap(supabase, [conversation.listing_id]),
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .neq("sender_id", profile.id)
        .is("read_at", null),
      supabase
        .from("listing_images")
        .select(LISTING_COVER_IMAGE_SELECT)
        .eq("listing_id", conversation.listing_id)
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select(PROFILE_DISPLAY_NAME_SELECT)
        .eq("id", counterpartUserId)
        .maybeSingle(),
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

  let listingCoverImageUrl: string | null = null;
  if (!listingCoverImageResult.error && listingCoverImageResult.data) {
    try {
      listingCoverImageUrl = await createListingImageSignedUrl(
        supabase,
        (listingCoverImageResult.data as ListingCoverImageRow).storage_path,
        30 * 60
      );
    } catch {
      listingCoverImageUrl = null;
    }
  }

  const counterpartDisplayName =
    !counterpartProfileResult.error && counterpartProfileResult.data
      ? (counterpartProfileResult.data as ProfileDisplayNameRow).display_name.trim() || null
      : null;

  return {
    ok: true,
    data: {
      conversation: toConversationRecord(conversation),
      listing: listingMap.get(conversation.listing_id) ?? null,
      listingCoverImageUrl,
      participantRole,
      counterpartUserId,
      counterpartDisplayName,
      messages,
      unreadCount: unreadCountResult.error ? 0 : unreadCountResult.count ?? 0,
      companyRouting: null,
      inbox: contextResult.data.inbox,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== providerUserId) {
    return {
      ok: false,
      count: 0,
      message: "Unread lead count requires the current provider session context.",
    };
  }

  const { data: conversations, error: conversationError } = await supabase
    .from("conversations")
    .select("id")
    .eq("provider_id", providerUserId)
    .eq("owner_mode", "individual_provider");

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
