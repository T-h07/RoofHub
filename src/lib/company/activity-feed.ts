import type { Database, Json, Tables } from "@/types/database";

import type { OrganizationMemberRole } from "./team-types";

export type CompanyActivityRpcRow =
  Database["public"]["Functions"]["get_company_dashboard_activity_feed"]["Returns"][number];

export type CompanyActivitySource =
  | "listing_workflow"
  | "team_audit"
  | "organization_audit"
  | "messaging_routing"
  | "unknown";

export type CompanyActivityGroup =
  | "listing_workflow"
  | "team_invite"
  | "team_membership"
  | "company_profile"
  | "messaging_routing"
  | "organization_audit";

export type CompanyActivityItem = {
  id: string;
  source: CompanyActivitySource;
  group: CompanyActivityGroup;
  eventType: string;
  occurredAt: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  targetId: string;
  targetLabel: string;
  note: string | null;
  fromStatus: Tables<"listings">["listing_status"] | null;
  toStatus: Tables<"listings">["listing_status"] | null;
  previousRole: OrganizationMemberRole | null;
  newRole: OrganizationMemberRole | null;
  targetRole: OrganizationMemberRole | null;
  removedRole: OrganizationMemberRole | null;
  previousMemberStatus: Database["public"]["Enums"]["organization_member_status"] | null;
  newMemberStatus: Database["public"]["Enums"]["organization_member_status"] | null;
  removedMemberStatus: Database["public"]["Enums"]["organization_member_status"] | null;
  inviteRole: OrganizationMemberRole | null;
  inviteStatus: Database["public"]["Enums"]["organization_invite_status"] | null;
  acceptanceOutcome: string | null;
  conversationId: string | null;
};

function toMetadataRecord(metadata: Json): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return metadata as Record<string, unknown>;
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toOptionalListingStatus(value: unknown): Tables<"listings">["listing_status"] | null {
  return typeof value === "string" ? (value as Tables<"listings">["listing_status"]) : null;
}

function toOptionalMemberRole(value: unknown): OrganizationMemberRole | null {
  return typeof value === "string" ? (value as OrganizationMemberRole) : null;
}

function toOptionalMemberStatus(
  value: unknown
): Database["public"]["Enums"]["organization_member_status"] | null {
  return typeof value === "string"
    ? (value as Database["public"]["Enums"]["organization_member_status"])
    : null;
}

function toOptionalInviteStatus(
  value: unknown
): Database["public"]["Enums"]["organization_invite_status"] | null {
  return typeof value === "string"
    ? (value as Database["public"]["Enums"]["organization_invite_status"])
    : null;
}

function toActivitySource(value: string): CompanyActivitySource {
  switch (value) {
    case "listing_workflow":
      return "listing_workflow";
    case "team_audit":
      return "team_audit";
    case "organization_audit":
      return "organization_audit";
    case "messaging_routing":
      return "messaging_routing";
    default:
      return "unknown";
  }
}

function toActivityGroup(value: unknown): CompanyActivityGroup {
  if (typeof value !== "string") {
    return "organization_audit";
  }

  switch (value) {
    case "listing_workflow":
      return "listing_workflow";
    case "team_invite":
      return "team_invite";
    case "team_membership":
      return "team_membership";
    case "company_profile":
      return "company_profile";
    case "messaging_routing":
      return "messaging_routing";
    default:
      return "organization_audit";
  }
}

export function mapCompanyActivityRows(rows: CompanyActivityRpcRow[]): CompanyActivityItem[] {
  return rows.map((row) => {
    const metadata = toMetadataRecord(row.metadata);

    return {
      id: row.event_id,
      source: toActivitySource(row.event_source),
      group: toActivityGroup(metadata.event_group),
      eventType: row.event_type,
      occurredAt: row.occurred_at,
      actorUserId: row.actor_user_id,
      actorDisplayName: row.actor_display_name,
      targetId: row.target_id,
      targetLabel: row.target_label,
      note: toOptionalString(metadata.note),
      fromStatus: toOptionalListingStatus(metadata.from_status),
      toStatus: toOptionalListingStatus(metadata.to_status),
      previousRole: toOptionalMemberRole(metadata.previous_role),
      newRole: toOptionalMemberRole(metadata.new_role),
      targetRole: toOptionalMemberRole(metadata.target_role),
      removedRole: toOptionalMemberRole(metadata.removed_role),
      previousMemberStatus: toOptionalMemberStatus(metadata.previous_status),
      newMemberStatus: toOptionalMemberStatus(metadata.new_status),
      removedMemberStatus: toOptionalMemberStatus(metadata.removed_status),
      inviteRole: toOptionalMemberRole(metadata.invite_role),
      inviteStatus: toOptionalInviteStatus(metadata.invite_status),
      acceptanceOutcome: toOptionalString(metadata.acceptance_outcome),
      conversationId: toOptionalString(metadata.conversation_id),
    };
  });
}

export function getCompanyActivityEventLabel(eventType: string) {
  switch (eventType) {
    case "created":
      return "Draft created";
    case "submitted_for_review":
      return "Submitted for review";
    case "needs_changes":
      return "Needs changes requested";
    case "approved":
      return "Listing approved";
    case "published":
      return "Listing published";
    case "unpublished":
      return "Listing unpublished";
    case "organization.invite.created":
      return "Invite created";
    case "organization.invite.accepted":
      return "Invite accepted";
    case "organization.invite.revoked":
      return "Invite revoked";
    case "organization.member.role_changed":
      return "Member role changed";
    case "organization.member.suspended":
      return "Member suspended";
    case "organization.member.reactivated":
      return "Member reactivated";
    case "organization.member.removed":
      return "Member removed";
    case "organization.profile.updated":
      return "Company profile updated";
    case "organization.workspace.selected":
      return "Workspace selected";
    case "organization.logo.updated":
      return "Company logo updated";
    case "organization.logo.removed":
      return "Company logo removed";
    case "messaging.conversation.assigned":
      return "Conversation assigned";
    case "messaging.conversation.reassigned":
      return "Conversation reassigned";
    case "messaging.conversation.unassigned":
      return "Conversation unassigned";
    default:
      return eventType;
  }
}

export function describeCompanyActivityContext(event: CompanyActivityItem) {
  if (event.fromStatus || event.toStatus) {
    const fromLabel = event.fromStatus ?? "--";
    const toLabel = event.toStatus ?? "--";
    return `${fromLabel} -> ${toLabel}`;
  }

  if (event.previousRole || event.newRole) {
    return `${event.previousRole ?? "--"} -> ${event.newRole ?? "--"}`;
  }

  if (event.previousMemberStatus || event.newMemberStatus) {
    return `${event.previousMemberStatus ?? "--"} -> ${event.newMemberStatus ?? "--"}`;
  }

  if (event.removedRole || event.removedMemberStatus) {
    return `Removed role ${event.removedRole ?? "--"} (${event.removedMemberStatus ?? "unknown status"})`;
  }

  if (event.inviteRole || event.inviteStatus) {
    return `Invite role ${event.inviteRole ?? "--"} (${event.inviteStatus ?? "unknown status"})`;
  }

  if (event.conversationId) {
    return `Conversation ${event.conversationId.slice(0, 8)}`;
  }

  return null;
}
