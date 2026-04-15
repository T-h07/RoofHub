import type { Enums, Tables } from "@/types/database";

export type CompanyListingWorkflowStatus = Extract<
  Enums<"listing_status">,
  | "draft"
  | "submitted_for_review"
  | "needs_changes"
  | "approved"
  | "published"
  | "unpublished"
  | "hidden_by_admin"
>;

export type CompanyListingWorkflowAction =
  | "submit_for_review"
  | "needs_changes"
  | "approve"
  | "publish"
  | "unpublish";

export type CompanyListingWorkflowEventType = Enums<"listing_workflow_event_type">;

export type CompanyListingWorkflowAccessRole =
  | Tables<"organization_members">["role"]
  | "admin";

export type CompanyListingWorkflowTimelineEvent = Pick<
  Tables<"listing_workflow_events">,
  | "id"
  | "listing_id"
  | "organization_id"
  | "actor_user_id"
  | "event_type"
  | "from_status"
  | "to_status"
  | "note"
  | "created_at"
> & {
  actorProfile: Pick<Tables<"profiles">, "id" | "display_name" | "avatar_url"> | null;
};

export type CompanyListingWorkflowListingSummary = Pick<
  Tables<"listings">,
  | "id"
  | "organization_id"
  | "created_by_user_id"
  | "assigned_agent_user_id"
  | "published_by_user_id"
  | "title"
  | "slug"
  | "updated_at"
> & {
  listing_status: CompanyListingWorkflowStatus;
};

export type CompanyListingWorkflowCapabilities = {
  canSubmitForReview: boolean;
  canRequestChanges: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canManageWorkflow: boolean;
};

export const COMPANY_LISTING_WORKFLOW_EVENT_LABELS: Record<
  CompanyListingWorkflowEventType,
  string
> = {
  created: "Draft created",
  submitted_for_review: "Submitted for review",
  needs_changes: "Needs changes requested",
  approved: "Approved",
  published: "Published",
  unpublished: "Unpublished",
};
