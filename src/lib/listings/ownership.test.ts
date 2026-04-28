import assert from "node:assert/strict";
import test from "node:test";

import {
  applyProviderListingWorkspaceScope,
  buildListingDraftOwnershipPayload,
  canPublishFromProviderControls,
  createProviderListingWorkspaceScope,
  listingBelongsToProviderWorkspace,
  resolveListingOwnershipContext,
} from "./ownership-model";

class QueryStub {
  public filters: Array<{ column: string; value: unknown }> = [];

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }
}

test("provider listing workspace scope is explicit for individual and company contexts", () => {
  assert.deepEqual(
    createProviderListingWorkspaceScope({
      ownerUserId: "user-a",
      organizationId: null,
    }),
    {
      ownershipMode: "individual",
      ownerUserId: "user-a",
      organizationId: null,
    }
  );

  assert.deepEqual(
    createProviderListingWorkspaceScope({
      ownerUserId: "user-a",
      organizationId: "org-a",
    }),
    {
      ownershipMode: "company",
      ownerUserId: "user-a",
      organizationId: "org-a",
    }
  );
});

test("listing workspace filters do not mix personal and company inventory", () => {
  const individualQuery = applyProviderListingWorkspaceScope(
    new QueryStub(),
    createProviderListingWorkspaceScope({
      ownerUserId: "user-a",
      organizationId: null,
    })
  );
  assert.deepEqual(individualQuery.filters, [{ column: "owner_id", value: "user-a" }]);

  const companyQuery = applyProviderListingWorkspaceScope(
    new QueryStub(),
    createProviderListingWorkspaceScope({
      ownerUserId: "user-a",
      organizationId: "org-a",
    })
  );
  assert.deepEqual(companyQuery.filters, [{ column: "organization_id", value: "org-a" }]);
});

test("listing ownership context keeps company ownership separate from actor attribution", () => {
  const context = resolveListingOwnershipContext({
    owner_id: "provider-user",
    organization_id: "org-a",
    created_by_user_id: "creator-user",
    assigned_agent_user_id: "agent-user",
    published_by_user_id: "publisher-user",
  });

  assert.equal(context.ownershipMode, "company");
  assert.equal(context.ownerUserId, "provider-user");
  assert.equal(context.organizationId, "org-a");
  assert.equal(context.createdByUserId, "creator-user");
  assert.equal(context.assignedAgentUserId, "agent-user");
  assert.equal(context.publishedByUserId, "publisher-user");
  assert.equal(context.workflowMode, "company_workflow");
});

test("draft ownership payload sets assignee only for company listings", () => {
  assert.deepEqual(
    buildListingDraftOwnershipPayload({
      actorUserId: "user-a",
      scope: createProviderListingWorkspaceScope({
        ownerUserId: "user-a",
        organizationId: null,
      }),
    }),
    {
      owner_id: "user-a",
      organization_id: null,
      created_by_user_id: "user-a",
      assigned_agent_user_id: null,
      published_by_user_id: null,
    }
  );

  assert.deepEqual(
    buildListingDraftOwnershipPayload({
      actorUserId: "user-a",
      scope: createProviderListingWorkspaceScope({
        ownerUserId: "user-a",
        organizationId: "org-a",
      }),
    }),
    {
      owner_id: "user-a",
      organization_id: "org-a",
      created_by_user_id: "user-a",
      assigned_agent_user_id: "user-a",
      published_by_user_id: null,
    }
  );
});

test("provider publish controls stay individual-only and workspace matching is deterministic", () => {
  assert.equal(canPublishFromProviderControls({ organization_id: null }), true);
  assert.equal(canPublishFromProviderControls({ organization_id: "org-a" }), false);

  const companyScope = createProviderListingWorkspaceScope({
    ownerUserId: "user-a",
    organizationId: "org-a",
  });
  assert.equal(
    listingBelongsToProviderWorkspace({
      listing: {
        owner_id: "user-a",
        organization_id: "org-a",
      },
      scope: companyScope,
    }),
    true
  );
  assert.equal(
    listingBelongsToProviderWorkspace({
      listing: {
        owner_id: "user-a",
        organization_id: null,
      },
      scope: companyScope,
    }),
    false
  );
});
