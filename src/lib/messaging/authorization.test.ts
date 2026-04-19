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
    conversationOrganizationId: "org-a",
  };

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "owner",
      assignedMemberUserId: null,
    }),
    true
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "agent",
      assignedMemberUserId: "viewer-user",
    }),
    true
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "agent",
      assignedMemberUserId: null,
    }),
    false
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "agent",
      assignedMemberUserId: "other-user",
    }),
    false
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      activeOrganizationId: "org-b",
      membershipRole: "manager",
      assignedMemberUserId: null,
    }),
    false
  );

  assert.equal(
    canAccessCompanyConversation({
      ...baseInput,
      membershipRole: "manager",
      membershipStatus: "inactive",
      assignedMemberUserId: null,
    }),
    false
  );
});
