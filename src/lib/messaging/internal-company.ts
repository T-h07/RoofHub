import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { notifyInternalCompanyMessageReceived } from "@/lib/notifications";
import { AUDIT_EVENT_TYPES, recordSecurityAuditEvent } from "@/lib/security/audit";
import { enforceTrafficControl, TRAFFIC_CONTROL_RULES } from "@/lib/security/traffic-control";
import type { Database, Tables } from "@/types/database";

import { canManageCompanyConversationRouting } from "./authorization";
import { getMessagingAdminClient, loadActiveOrganizationAssignableMembers } from "./company";
import { getMessagingViewerContext, toMessagingFailure } from "./context";
import type {
  ConversationReadResult,
  CreateInternalConversationInput,
  CreateInternalConversationResult,
  LoadInternalConversationSummariesInput,
  LoadInternalConversationThreadInput,
  MessagingAssignableCompanyMember,
  MessagingInternalConversationRecord,
  MessagingInternalConversationSummariesResult,
  MessagingInternalConversationSummary,
  MessagingInternalMessageRecord,
  MessagingInternalParticipantSummary,
  MessagingInternalThreadResult,
  MessagingResult,
  SendInternalConversationMessageInput,
} from "./types";
import { isUuid, normalizeMessageBody, toMessagePreview } from "./validation";

const INTERNAL_CONVERSATION_SELECT =
  "id, organization_id, kind, title, created_by_user_id, last_message_at, created_at, updated_at";
const INTERNAL_PARTICIPANT_SELECT =
  "id, conversation_id, organization_id, user_id, added_by_user_id, joined_at, last_read_at, created_at, updated_at";
const INTERNAL_MESSAGE_SELECT = "id, conversation_id, sender_user_id, body, created_at";
const PROFILE_DISPLAY_NAME_SELECT = "id, display_name";
const ORGANIZATION_MEMBER_ROLE_SELECT = "user_id, role, member_status";

type MessagingViewerSuccess = Extract<
  Awaited<ReturnType<typeof getMessagingViewerContext>>,
  { ok: true }
>["data"];

type CompanyMessagingViewer = Extract<MessagingViewerSuccess, { mode: "company_workspace" }>;

type InternalConversationRow = Pick<
  Tables<"company_internal_conversations">,
  | "id"
  | "organization_id"
  | "kind"
  | "title"
  | "created_by_user_id"
  | "last_message_at"
  | "created_at"
  | "updated_at"
>;

type InternalParticipantRow = Pick<
  Tables<"company_internal_conversation_participants">,
  | "id"
  | "conversation_id"
  | "organization_id"
  | "user_id"
  | "added_by_user_id"
  | "joined_at"
  | "last_read_at"
  | "created_at"
  | "updated_at"
>;

type InternalMessageRow = Pick<
  Tables<"company_internal_messages">,
  "id" | "conversation_id" | "sender_user_id" | "body" | "created_at"
>;

type ProfileDisplayNameRow = Pick<Tables<"profiles">, "id" | "display_name">;

type OrganizationMemberRoleRow = Pick<
  Tables<"organization_members">,
  "user_id" | "role" | "member_status"
>;

function clampLimit(value: number | null | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function toInternalConversationRecord(
  row: InternalConversationRow
): MessagingInternalConversationRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    kind: row.kind,
    title: row.title,
    created_by_user_id: row.created_by_user_id,
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toInternalMessageRecord(
  row: InternalMessageRow,
  mode: "summary" | "thread"
): MessagingInternalMessageRecord {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_user_id: row.sender_user_id,
    body: mode === "summary" ? toMessagePreview(row.body) : row.body,
    created_at: row.created_at,
  };
}

async function getCompanyMessagingViewerContext(): Promise<
  MessagingResult<CompanyMessagingViewer>
> {
  const contextResult = await getMessagingViewerContext();
  if (!contextResult.ok) {
    return contextResult;
  }

  if (contextResult.data.mode !== "company_workspace") {
    return toMessagingFailure(
      "forbidden",
      "Internal company conversations are available only inside an active RoofHub company workspace."
    );
  }

  return {
    ok: true,
    data: contextResult.data,
  };
}

async function loadDisplayNameMap(supabase: SupabaseClient<Database>, userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, string>();
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_DISPLAY_NAME_SELECT)
    .in("id", userIds);

  const map = new Map<string, string>();
  if (error || !data) {
    return map;
  }

  for (const row of data as ProfileDisplayNameRow[]) {
    const normalizedName = row.display_name.trim();
    if (normalizedName.length > 0) {
      map.set(row.id, normalizedName);
      continue;
    }

    map.set(row.id, `Member ${row.id.slice(0, 6)}`);
  }

  return map;
}

async function loadOrganizationMemberRoleMap(
  supabase: SupabaseClient<Database>,
  organizationId: string,
  userIds: string[]
) {
  if (userIds.length === 0) {
    return new Map<
      string,
      {
        role: OrganizationMemberRoleRow["role"] | null;
        memberStatus: OrganizationMemberRoleRow["member_status"] | null;
      }
    >();
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select(ORGANIZATION_MEMBER_ROLE_SELECT)
    .eq("organization_id", organizationId)
    .in("user_id", userIds);

  const map = new Map<
    string,
    {
      role: OrganizationMemberRoleRow["role"] | null;
      memberStatus: OrganizationMemberRoleRow["member_status"] | null;
    }
  >();

  if (error || !data) {
    return map;
  }

  for (const row of data as OrganizationMemberRoleRow[]) {
    map.set(row.user_id, {
      role: row.role,
      memberStatus: row.member_status,
    });
  }

  return map;
}

function normalizeGroupTitle(value: string | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length < 2 || normalized.length > 120) {
    return null;
  }

  return normalized;
}

async function findExistingDirectInternalConversation(input: {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  viewerUserId: string;
  counterpartUserId: string;
}) {
  const { data: viewerConversationRows, error: viewerConversationError } = await input.adminSupabase
    .from("company_internal_conversation_participants")
    .select("conversation_id")
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.viewerUserId);

  if (viewerConversationError || !viewerConversationRows || viewerConversationRows.length === 0) {
    return null;
  }

  const candidateConversationIds = Array.from(
    new Set(viewerConversationRows.map((row) => row.conversation_id))
  );

  const { data: directConversationRows, error: directConversationError } = await input.adminSupabase
    .from("company_internal_conversations")
    .select(INTERNAL_CONVERSATION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("kind", "direct")
    .in("id", candidateConversationIds)
    .order("last_message_at", { ascending: false });

  if (directConversationError || !directConversationRows || directConversationRows.length === 0) {
    return null;
  }

  const directConversationIds = directConversationRows.map((row) => row.id);
  const { data: participantRows, error: participantError } = await input.adminSupabase
    .from("company_internal_conversation_participants")
    .select("conversation_id, user_id")
    .in("conversation_id", directConversationIds);

  if (participantError || !participantRows) {
    return null;
  }

  const participantSetByConversationId = new Map<string, Set<string>>();
  for (const participantRow of participantRows) {
    const set =
      participantSetByConversationId.get(participantRow.conversation_id) ?? new Set<string>();
    set.add(participantRow.user_id);
    participantSetByConversationId.set(participantRow.conversation_id, set);
  }

  const matchingConversation = (directConversationRows as InternalConversationRow[]).find(
    (conversation) => {
      const participantSet = participantSetByConversationId.get(conversation.id);
      if (!participantSet || participantSet.size !== 2) {
        return false;
      }

      return participantSet.has(input.viewerUserId) && participantSet.has(input.counterpartUserId);
    }
  );

  return matchingConversation ?? null;
}

function toParticipantSummary(input: {
  participantRow: InternalParticipantRow;
  viewerUserId: string;
  displayNameMap: Map<string, string>;
  roleMap: Map<
    string,
    {
      role: OrganizationMemberRoleRow["role"] | null;
      memberStatus: OrganizationMemberRoleRow["member_status"] | null;
    }
  >;
}): MessagingInternalParticipantSummary {
  const role = input.roleMap.get(input.participantRow.user_id)?.role ?? null;
  const memberStatus = input.roleMap.get(input.participantRow.user_id)?.memberStatus ?? null;

  return {
    userId: input.participantRow.user_id,
    displayName:
      input.displayNameMap.get(input.participantRow.user_id) ??
      `Member ${input.participantRow.user_id.slice(0, 6)}`,
    role,
    memberStatus,
    joinedAt: input.participantRow.joined_at,
    lastReadAt: input.participantRow.last_read_at,
    isViewer: input.participantRow.user_id === input.viewerUserId,
  };
}

async function loadInternalConversationAccess(input: {
  adminSupabase: SupabaseClient<Database>;
  organizationId: string;
  viewerUserId: string;
  conversationId: string;
}) {
  const { data: conversationRow, error: conversationError } = await input.adminSupabase
    .from("company_internal_conversations")
    .select(INTERNAL_CONVERSATION_SELECT)
    .eq("organization_id", input.organizationId)
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationError || !conversationRow) {
    return {
      ok: false as const,
      failure: toMessagingFailure("not_found", "Internal conversation not found."),
    };
  }

  const { data: participantRow, error: participantError } = await input.adminSupabase
    .from("company_internal_conversation_participants")
    .select(INTERNAL_PARTICIPANT_SELECT)
    .eq("conversation_id", input.conversationId)
    .eq("organization_id", input.organizationId)
    .eq("user_id", input.viewerUserId)
    .maybeSingle();

  if (participantError || !participantRow) {
    return {
      ok: false as const,
      failure: toMessagingFailure(
        "forbidden",
        "You are not a participant in this internal company conversation."
      ),
    };
  }

  return {
    ok: true as const,
    conversation: conversationRow as InternalConversationRow,
    viewerParticipant: participantRow as InternalParticipantRow,
  };
}

export async function loadInternalCompanyConversationSummariesQuery(
  input: LoadInternalConversationSummariesInput = {}
): Promise<MessagingResult<MessagingInternalConversationSummariesResult>> {
  const limit = clampLimit(input.limit, 80, 1, 120);

  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();

  const [activeMembers, viewerParticipantResult] = await Promise.all([
    loadActiveOrganizationAssignableMembers(adminSupabase, viewer.organization.id),
    adminSupabase
      .from("company_internal_conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("organization_id", viewer.organization.id)
      .eq("user_id", viewer.profile.id),
  ]);

  const memberOptions = activeMembers.filter((member) => member.userId !== viewer.profile.id);

  if (viewerParticipantResult.error) {
    return toMessagingFailure(
      "internal",
      "Internal company conversations could not be loaded right now."
    );
  }

  const viewerParticipantRows = viewerParticipantResult.data ?? [];
  const conversationIds = Array.from(
    new Set(viewerParticipantRows.map((row) => row.conversation_id))
  );

  if (conversationIds.length === 0) {
    return {
      ok: true,
      data: {
        summaries: [],
        unreadTotalCount: 0,
        inbox: viewer.inbox,
        members: memberOptions,
      },
    };
  }

  const { data: conversationRows, error: conversationError } = await adminSupabase
    .from("company_internal_conversations")
    .select(INTERNAL_CONVERSATION_SELECT)
    .eq("organization_id", viewer.organization.id)
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false })
    .limit(limit);

  if (conversationError) {
    return toMessagingFailure(
      "internal",
      "Internal company conversations could not be loaded right now."
    );
  }

  const conversations = (conversationRows ?? []) as InternalConversationRow[];
  if (conversations.length === 0) {
    return {
      ok: true,
      data: {
        summaries: [],
        unreadTotalCount: 0,
        inbox: viewer.inbox,
        members: memberOptions,
      },
    };
  }

  const scopedConversationIds = conversations.map((conversation) => conversation.id);
  const [participantRowsResult, messageRowsResult] = await Promise.all([
    adminSupabase
      .from("company_internal_conversation_participants")
      .select(INTERNAL_PARTICIPANT_SELECT)
      .eq("organization_id", viewer.organization.id)
      .in("conversation_id", scopedConversationIds)
      .order("joined_at", { ascending: true }),
    adminSupabase
      .from("company_internal_messages")
      .select(INTERNAL_MESSAGE_SELECT)
      .in("conversation_id", scopedConversationIds)
      .order("conversation_id", { ascending: true })
      .order("created_at", { ascending: false }),
  ]);

  if (participantRowsResult.error || messageRowsResult.error) {
    return toMessagingFailure(
      "internal",
      "Internal company conversations could not be loaded right now."
    );
  }

  const participantRows = (participantRowsResult.data ?? []) as InternalParticipantRow[];
  const messageRows = (messageRowsResult.data ?? []) as InternalMessageRow[];

  const participantRowsByConversationId = new Map<string, InternalParticipantRow[]>();
  for (const participantRow of participantRows) {
    const rows = participantRowsByConversationId.get(participantRow.conversation_id) ?? [];
    rows.push(participantRow);
    participantRowsByConversationId.set(participantRow.conversation_id, rows);
  }

  const userIds = Array.from(new Set(participantRows.map((participant) => participant.user_id)));
  const displayNameMap = await loadDisplayNameMap(adminSupabase, userIds);

  const viewerLastReadAtByConversationId = new Map<string, string | null>();
  for (const participantRow of viewerParticipantRows) {
    viewerLastReadAtByConversationId.set(
      participantRow.conversation_id,
      participantRow.last_read_at
    );
  }

  const latestMessageByConversationId = new Map<string, MessagingInternalMessageRecord>();
  const unreadCountByConversationId = new Map<string, number>();

  for (const messageRow of messageRows) {
    if (!latestMessageByConversationId.has(messageRow.conversation_id)) {
      latestMessageByConversationId.set(
        messageRow.conversation_id,
        toInternalMessageRecord(messageRow, "summary")
      );
    }

    if (messageRow.sender_user_id === viewer.profile.id) {
      continue;
    }

    const viewerLastReadAt = viewerLastReadAtByConversationId.get(messageRow.conversation_id);
    if (!viewerLastReadAt || Date.parse(messageRow.created_at) > Date.parse(viewerLastReadAt)) {
      unreadCountByConversationId.set(
        messageRow.conversation_id,
        (unreadCountByConversationId.get(messageRow.conversation_id) ?? 0) + 1
      );
    }
  }

  const summaries: MessagingInternalConversationSummary[] = conversations.map((conversation) => {
    const participants = participantRowsByConversationId.get(conversation.id) ?? [];
    const participantUserIds = participants.map((participant) => participant.user_id);
    const otherParticipants = participantUserIds.filter(
      (participantUserId) => participantUserId !== viewer.profile.id
    );
    const participantPreview = otherParticipants
      .slice(0, 3)
      .map(
        (participantUserId) =>
          displayNameMap.get(participantUserId) ?? `Member ${participantUserId.slice(0, 6)}`
      );

    const counterpartUserId =
      conversation.kind === "direct" ? (otherParticipants[0] ?? null) : null;

    return {
      conversation: toInternalConversationRecord(conversation),
      unreadCount: unreadCountByConversationId.get(conversation.id) ?? 0,
      participantCount: participantUserIds.length,
      counterpartUserId,
      counterpartDisplayName: counterpartUserId
        ? (displayNameMap.get(counterpartUserId) ?? `Member ${counterpartUserId.slice(0, 6)}`)
        : null,
      participantPreview,
      lastMessage: latestMessageByConversationId.get(conversation.id) ?? null,
    };
  });

  return {
    ok: true,
    data: {
      summaries,
      unreadTotalCount: summaries.reduce((count, summary) => count + summary.unreadCount, 0),
      inbox: viewer.inbox,
      members: memberOptions,
    },
  };
}

export async function loadInternalCompanyMemberOptionsQuery(): Promise<
  MessagingResult<MessagingAssignableCompanyMember[]>
> {
  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();
  const activeMembers = await loadActiveOrganizationAssignableMembers(
    adminSupabase,
    viewer.organization.id
  );

  return {
    ok: true,
    data: activeMembers.filter((member) => member.userId !== viewer.profile.id),
  };
}

export async function loadInternalCompanyThreadQuery(
  input: LoadInternalConversationThreadInput
): Promise<MessagingResult<MessagingInternalThreadResult>> {
  if (!input || typeof input !== "object" || !isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  const limit = clampLimit(input.limit, 240, 1, 400);

  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();

  const accessResult = await loadInternalConversationAccess({
    adminSupabase,
    organizationId: viewer.organization.id,
    viewerUserId: viewer.profile.id,
    conversationId: input.conversationId,
  });

  if (!accessResult.ok) {
    return accessResult.failure;
  }

  const [participantRowsResult, messageRowsResult] = await Promise.all([
    adminSupabase
      .from("company_internal_conversation_participants")
      .select(INTERNAL_PARTICIPANT_SELECT)
      .eq("organization_id", viewer.organization.id)
      .eq("conversation_id", input.conversationId)
      .order("joined_at", { ascending: true }),
    adminSupabase
      .from("company_internal_messages")
      .select(INTERNAL_MESSAGE_SELECT)
      .eq("conversation_id", input.conversationId)
      .order("created_at", { ascending: true })
      .limit(limit),
  ]);

  if (participantRowsResult.error || messageRowsResult.error) {
    return toMessagingFailure("internal", "Internal company thread could not be loaded right now.");
  }

  const participantRows = (participantRowsResult.data ?? []) as InternalParticipantRow[];
  const messageRows = (messageRowsResult.data ?? []) as InternalMessageRow[];

  const participantUserIds = Array.from(
    new Set(participantRows.map((participant) => participant.user_id))
  );

  const [displayNameMap, roleMap] = await Promise.all([
    loadDisplayNameMap(adminSupabase, participantUserIds),
    loadOrganizationMemberRoleMap(adminSupabase, viewer.organization.id, participantUserIds),
  ]);

  const unreadCount = messageRows.reduce((count, message) => {
    if (message.sender_user_id === viewer.profile.id) {
      return count;
    }

    if (!accessResult.viewerParticipant.last_read_at) {
      return count + 1;
    }

    return Date.parse(message.created_at) > Date.parse(accessResult.viewerParticipant.last_read_at)
      ? count + 1
      : count;
  }, 0);

  return {
    ok: true,
    data: {
      conversation: toInternalConversationRecord(accessResult.conversation),
      participants: participantRows.map((participantRow) =>
        toParticipantSummary({
          participantRow,
          viewerUserId: viewer.profile.id,
          displayNameMap,
          roleMap,
        })
      ),
      messages: messageRows.map((messageRow) => toInternalMessageRecord(messageRow, "thread")),
      unreadCount,
      inbox: viewer.inbox,
      canManageParticipants:
        canManageCompanyConversationRouting(
          viewer.membership.role,
          viewer.membership.member_status
        ) || accessResult.conversation.created_by_user_id === viewer.profile.id,
    },
  };
}

export async function createInternalCompanyConversationMutation(
  input: CreateInternalConversationInput
): Promise<MessagingResult<CreateInternalConversationResult>> {
  if (!input || typeof input !== "object") {
    return toMessagingFailure("invalid_input", "Conversation request is invalid.");
  }

  if (input.kind !== "direct" && input.kind !== "group") {
    return toMessagingFailure("invalid_input", "Conversation kind is invalid.");
  }

  if (!Array.isArray(input.participantUserIds)) {
    return toMessagingFailure("invalid_input", "Conversation participants are invalid.");
  }

  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();

  const trafficResult = await enforceTrafficControl({
    supabase: viewer.supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingCreateConversationPerUser,
    identity: {
      userId: viewer.profile.id,
      scope: `internal-company:${viewer.organization.id}`,
      includeIp: true,
    },
    throttledMessage:
      "Too many internal conversation creation attempts. Please wait before retrying.",
    unavailableMessage:
      "Internal conversation creation is temporarily unavailable. Please retry shortly.",
  });

  if (!trafficResult.ok) {
    return toMessagingFailure(
      trafficResult.reason === "throttled" ? "rate_limited" : "internal",
      trafficResult.message
    );
  }

  const activeMembers = await loadActiveOrganizationAssignableMembers(
    adminSupabase,
    viewer.organization.id
  );
  const activeMemberIdSet = new Set(activeMembers.map((member) => member.userId));

  const selectedParticipantUserIds = Array.from(
    new Set(
      input.participantUserIds
        .filter(
          (participantUserId): participantUserId is string => typeof participantUserId === "string"
        )
        .map((participantUserId) => participantUserId.trim())
        .filter(
          (participantUserId) =>
            isUuid(participantUserId) && participantUserId !== viewer.profile.id
        )
    )
  );

  for (const participantUserId of selectedParticipantUserIds) {
    if (!activeMemberIdSet.has(participantUserId)) {
      return toMessagingFailure(
        "forbidden",
        "All internal conversation participants must be active members of this RoofHub company workspace."
      );
    }
  }

  const title = normalizeGroupTitle(input.title);

  if (input.kind === "direct") {
    if (selectedParticipantUserIds.length !== 1) {
      return toMessagingFailure(
        "invalid_input",
        "Direct internal conversations require exactly one company teammate."
      );
    }

    const counterpartUserId = selectedParticipantUserIds[0];
    const existingConversation = await findExistingDirectInternalConversation({
      adminSupabase,
      organizationId: viewer.organization.id,
      viewerUserId: viewer.profile.id,
      counterpartUserId,
    });

    if (existingConversation) {
      return {
        ok: true,
        data: {
          conversation: toInternalConversationRecord(existingConversation),
          created: false,
        },
      };
    }
  }

  if (input.kind === "group") {
    if (selectedParticipantUserIds.length < 2) {
      return toMessagingFailure(
        "invalid_input",
        "Group internal conversations require at least two teammates."
      );
    }

    if (!title) {
      return toMessagingFailure(
        "invalid_input",
        "Group conversations require a title between 2 and 120 characters."
      );
    }
  }

  const { data: insertedConversation, error: conversationError } = await adminSupabase
    .from("company_internal_conversations")
    .insert({
      organization_id: viewer.organization.id,
      kind: input.kind,
      title: input.kind === "group" ? title : null,
      created_by_user_id: viewer.profile.id,
    })
    .select(INTERNAL_CONVERSATION_SELECT)
    .maybeSingle();

  if (conversationError || !insertedConversation) {
    if (conversationError) {
      console.error("[Messaging] Failed to create internal company conversation", {
        organizationId: viewer.organization.id,
        actorUserId: viewer.profile.id,
        kind: input.kind,
        participantUserIds: selectedParticipantUserIds,
        code: conversationError.code,
        message: conversationError.message,
        details: conversationError.details,
        hint: conversationError.hint,
      });
    }

    return toMessagingFailure("internal", "Internal conversation could not be created right now.");
  }

  const nowIso = new Date().toISOString();
  const participantUserIds =
    input.kind === "direct"
      ? [viewer.profile.id, selectedParticipantUserIds[0]]
      : [viewer.profile.id, ...selectedParticipantUserIds];

  const { error: participantInsertError } = await adminSupabase
    .from("company_internal_conversation_participants")
    .insert(
      participantUserIds.map((participantUserId) => ({
        conversation_id: insertedConversation.id,
        organization_id: viewer.organization.id,
        user_id: participantUserId,
        added_by_user_id: viewer.profile.id,
        last_read_at: nowIso,
      }))
    );

  if (participantInsertError) {
    console.error("[Messaging] Failed to add internal company conversation participants", {
      conversationId: insertedConversation.id,
      organizationId: viewer.organization.id,
      actorUserId: viewer.profile.id,
      kind: input.kind,
      participantUserIds,
      code: participantInsertError.code,
      message: participantInsertError.message,
      details: participantInsertError.details,
      hint: participantInsertError.hint,
    });

    await adminSupabase
      .from("company_internal_conversations")
      .delete()
      .eq("id", insertedConversation.id);

    return toMessagingFailure("internal", "Internal conversation could not be created right now.");
  }

  await recordSecurityAuditEvent({
    supabase: viewer.supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.conversationCreated,
      actorUserId: viewer.profile.id,
      actorRole: viewer.profile.role,
      targetType: "conversation",
      targetId: insertedConversation.id,
      conversationId: insertedConversation.id,
      metadata: {
        messaging_scope: "internal_company",
        organization_id: viewer.organization.id,
        conversation_kind: input.kind,
        participant_count: participantUserIds.length,
      },
    },
  });

  return {
    ok: true,
    data: {
      conversation: toInternalConversationRecord(insertedConversation as InternalConversationRow),
      created: true,
    },
  };
}

export async function sendInternalCompanyMessageMutation(
  input: SendInternalConversationMessageInput
): Promise<
  MessagingResult<{
    conversationId: string;
    message: MessagingInternalMessageRecord;
  }>
> {
  if (!input || typeof input !== "object" || !isUuid(input.conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  if (typeof input.body !== "string") {
    return toMessagingFailure("invalid_input", "Message body is invalid.");
  }

  const normalizedBody = normalizeMessageBody(input.body);
  if (!normalizedBody) {
    return toMessagingFailure("invalid_input", "Message must be between 1 and 2000 characters.");
  }

  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();

  const accessResult = await loadInternalConversationAccess({
    adminSupabase,
    organizationId: viewer.organization.id,
    viewerUserId: viewer.profile.id,
    conversationId: input.conversationId,
  });

  if (!accessResult.ok) {
    return accessResult.failure;
  }

  const perConversationTraffic = await enforceTrafficControl({
    supabase: viewer.supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingSendPerConversation,
    identity: {
      userId: viewer.profile.id,
      scope: `internal-company:${input.conversationId}`,
      includeIp: true,
    },
    throttledMessage: "Message rate limit reached for this internal conversation.",
    unavailableMessage: "Message send is temporarily unavailable. Please retry shortly.",
  });
  if (!perConversationTraffic.ok) {
    return toMessagingFailure(
      perConversationTraffic.reason === "throttled" ? "rate_limited" : "internal",
      perConversationTraffic.message
    );
  }

  const perUserTraffic = await enforceTrafficControl({
    supabase: viewer.supabase,
    rule: TRAFFIC_CONTROL_RULES.messagingSendPerUser,
    identity: {
      userId: viewer.profile.id,
      scope: `internal-company:${viewer.organization.id}`,
      includeIp: false,
    },
    throttledMessage: "Message rate limit reached for your account.",
    unavailableMessage: "Message send is temporarily unavailable. Please retry shortly.",
  });

  if (!perUserTraffic.ok) {
    return toMessagingFailure(
      perUserTraffic.reason === "throttled" ? "rate_limited" : "internal",
      perUserTraffic.message
    );
  }

  const { data: messageRow, error: messageInsertError } = await adminSupabase
    .from("company_internal_messages")
    .insert({
      conversation_id: input.conversationId,
      sender_user_id: viewer.profile.id,
      body: normalizedBody,
    })
    .select(INTERNAL_MESSAGE_SELECT)
    .maybeSingle();

  if (messageInsertError || !messageRow) {
    return toMessagingFailure("internal", "Message could not be sent right now.");
  }

  await recordSecurityAuditEvent({
    supabase: viewer.supabase,
    event: {
      eventType: AUDIT_EVENT_TYPES.messageSent,
      actorUserId: viewer.profile.id,
      actorRole: viewer.profile.role,
      targetType: "message",
      targetId: messageRow.id,
      conversationId: input.conversationId,
      metadata: {
        messaging_scope: "internal_company",
        organization_id: viewer.organization.id,
        body_length: normalizedBody.length,
      },
    },
  });

  const { data: participantRows } = await adminSupabase
    .from("company_internal_conversation_participants")
    .select("user_id")
    .eq("conversation_id", input.conversationId)
    .eq("organization_id", viewer.organization.id);

  const recipientUserIds = Array.from(
    new Set(
      (participantRows ?? [])
        .map((participantRow) => participantRow.user_id)
        .filter((userId) => userId !== viewer.profile.id)
    )
  );

  if (recipientUserIds.length > 0) {
    await notifyInternalCompanyMessageReceived({
      conversationId: input.conversationId,
      organizationId: viewer.organization.id,
      senderUserId: viewer.profile.id,
      senderDisplayName: viewer.profile.display_name,
      conversationTitle: accessResult.conversation.title,
      recipientUserIds,
      messageBody: normalizedBody,
    });
  }

  return {
    ok: true,
    data: {
      conversationId: input.conversationId,
      message: toInternalMessageRecord(messageRow as InternalMessageRow, "thread"),
    },
  };
}

export async function markInternalCompanyConversationReadMutation(
  conversationId: string
): Promise<MessagingResult<ConversationReadResult>> {
  if (!isUuid(conversationId)) {
    return toMessagingFailure("invalid_input", "Conversation reference is invalid.");
  }

  const viewerResult = await getCompanyMessagingViewerContext();
  if (!viewerResult.ok) {
    return viewerResult;
  }

  const viewer = viewerResult.data;
  const adminSupabase = getMessagingAdminClient();

  const accessResult = await loadInternalConversationAccess({
    adminSupabase,
    organizationId: viewer.organization.id,
    viewerUserId: viewer.profile.id,
    conversationId,
  });

  if (!accessResult.ok) {
    return accessResult.failure;
  }

  const { data, error } = await adminSupabase
    .from("company_internal_conversation_participants")
    .update({
      last_read_at: new Date().toISOString(),
    })
    .eq("conversation_id", conversationId)
    .eq("organization_id", viewer.organization.id)
    .eq("user_id", viewer.profile.id)
    .select("id");

  if (error) {
    return toMessagingFailure("internal", "Conversation read state could not be updated.");
  }

  return {
    ok: true,
    data: {
      conversationId,
      markedReadCount: data?.length ?? 0,
    },
  };
}
