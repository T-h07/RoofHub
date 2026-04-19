import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessCompanyConversation,
  canManageCompanyConversationRouting,
  getCompanyConversationQueueAccess,
} from "./authorization";

test("reviewer-capable company members receive shared queue access", () => {
  assert.equal(getCompanyConversationQueueAccess("owner", "active"), "company_queue");
  assert.equal(getCompanyConversationQueueAccess("admin", "active"), "company_queue");
  assert.equal(getCompanyConversationQueueAccess("manager", "active"), "company_queue");
  assert.equal(getCompanyConversationQueueAccess("agent", "active"), "assigned_only");
  assert.equal(getCompanyConversationQueueAccess("agent", "inactive"), null);
});

test("only owner admin and manager roles can reroute company conversations", () => {
  assert.equal(canManageCompanyConversationRouting("owner", "active"), true);
  assert.equal(canManageCompanyConversationRouting("admin", "active"), true);
  assert.equal(canManageCompanyConversationRouting("manager", "active"), true);
  assert.equal(canManageCompanyConversationRouting("agent", "active"), false);
  assert.equal(canManageCompanyConversationRouting("manager", "inactive"), false);
});

test("company conversation access respects active workspace organization and assignment", () => {
  const baseInput = {
    viewerUserId: "viewer-user",
    activeOrganizationId: "org-a",
    membershipStatus: "active" as const,
    listingOrganizationId: "org-a",
  };

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "owner",
      assignedAgentUserId: null,
    }),
    true
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "agent",
      assignedAgentUserId: "viewer-user",
    }),
    true
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "agent",
      assignedAgentUserId: "other-user",
    }),
    false
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      activeOrganizationId: "org-b",
      membershipRole: "manager",
      assignedAgentUserId: null,
    }),
    false
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "manager",
      membershipStatus: "inactive",
      assignedAgentUserId: null,
    }),
    false
  );
});
