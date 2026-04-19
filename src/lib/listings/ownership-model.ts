import type { Tables } from "@/types/database";

export type ListingOwnershipMode = "individual" | "company";
export type ListingWorkflowMode = "provider_lifecycle" | "company_workflow";

type ListingWorkspaceQuery<TQuery> = {
  eq(column: string, value: unknown): TQuery;
};

type ListingWorkspaceRecord = Pick<Tables<"listings">, "owner_id" | "organization_id">;

type ListingOwnershipRecord = Pick<
  Tables<"listings">,
  | "owner_id"
  | "organization_id"
  | "created_by_user_id"
  | "assigned_agent_user_id"
  | "published_by_user_id"
>;

export type ProviderListingWorkspaceScope =
  | {
      ownershipMode: "individual";
      ownerUserId: string;
      organizationId: null;
    }
  | {
      ownershipMode: "company";
      ownerUserId: string;
      organizationId: string;
    };

export type ListingOwnershipContext = ProviderListingWorkspaceScope & {
  createdByUserId: string;
  assignedAgentUserId: string | null;
  publishedByUserId: string | null;
  workflowMode: ListingWorkflowMode;
};

export function getListingOwnershipMode(input: {
  organization_id: string | null;
}): ListingOwnershipMode {
  return input.organization_id ? "company" : "individual";
}

export function isCompanyOwnedListing(input: {
  organization_id: string | null;
}) {
  return getListingOwnershipMode(input) === "company";
}

export function getListingWorkflowMode(input: {
  organization_id: string | null;
}): ListingWorkflowMode {
  return isCompanyOwnedListing(input) ? "company_workflow" : "provider_lifecycle";
}

export function createProviderListingWorkspaceScope(input: {
  ownerUserId: string;
  organizationId?: string | null;
}): ProviderListingWorkspaceScope {
  if (input.organizationId) {
    return {
      ownershipMode: "company",
      ownerUserId: input.ownerUserId,
      organizationId: input.organizationId,
    };
  }

  return {
    ownershipMode: "individual",
    ownerUserId: input.ownerUserId,
    organizationId: null,
  };
}

export function applyProviderListingWorkspaceScope<TQuery extends ListingWorkspaceQuery<TQuery>>(
  query: TQuery,
  scope: ProviderListingWorkspaceScope
): TQuery {
  if (scope.ownershipMode === "company") {
    return query.eq("organization_id", scope.organizationId);
  }

  return query.eq("owner_id", scope.ownerUserId);
}

export function listingBelongsToProviderWorkspace(input: {
  listing: ListingWorkspaceRecord;
  scope: ProviderListingWorkspaceScope;
}) {
  if (input.scope.ownershipMode === "company") {
    return input.listing.organization_id === input.scope.organizationId;
  }

  return (
    input.listing.organization_id === null && input.listing.owner_id === input.scope.ownerUserId
  );
}

export function resolveListingOwnershipContext(
  input: ListingOwnershipRecord
): ListingOwnershipContext {
  const scope = createProviderListingWorkspaceScope({
    ownerUserId: input.owner_id,
    organizationId: input.organization_id,
  });

  return {
    ...scope,
    createdByUserId: input.created_by_user_id,
    assignedAgentUserId: input.assigned_agent_user_id,
    publishedByUserId: input.published_by_user_id,
    workflowMode: getListingWorkflowMode(input),
  };
}

export function buildListingDraftOwnershipPayload(input: {
  actorUserId: string;
  scope: ProviderListingWorkspaceScope;
}) {
  return {
    owner_id: input.scope.ownerUserId,
    organization_id: input.scope.organizationId,
    created_by_user_id: input.actorUserId,
    assigned_agent_user_id: input.scope.ownershipMode === "company" ? input.actorUserId : null,
    published_by_user_id: null,
  } satisfies Pick<
    Tables<"listings">,
    | "owner_id"
    | "organization_id"
    | "created_by_user_id"
    | "assigned_agent_user_id"
    | "published_by_user_id"
  >;
}

export function canPublishFromProviderControls(input: {
  organization_id: string | null;
}) {
  return getListingWorkflowMode(input) === "provider_lifecycle";
}
