import assert from "node:assert/strict";
import test from "node:test";

import {
  canEditCompanyProfile,
  canInviteOrganizationRole,
  canManageCompanyConversationRouting,
  canManageCompanyTeam,
  canMutateOrganizationMemberRole,
  canPublishCompanyListingWorkflow,
  canReviewCompanyListingWorkflow,
  canViewCompanyActivityFeed,
  canViewCompanyInboxQueue,
} from "./permissions";

test("reviewer-capable company roles match the enforced permission matrix", () => {
  assert.equal(canReviewCompanyListingWorkflow("owner", "active"), true);
  assert.equal(canReviewCompanyListingWorkflow("admin", "active"), true);
  assert.equal(canReviewCompanyListingWorkflow("manager", "active"), true);
  assert.equal(canReviewCompanyListingWorkflow("agent", "active"), false);

  assert.equal(canPublishCompanyListingWorkflow("owner", "active"), true);
  assert.equal(canPublishCompanyListingWorkflow("manager", "active"), true);
  assert.equal(canPublishCompanyListingWorkflow("agent", "active"), false);

  assert.equal(canViewCompanyInboxQueue("owner", "active"), true);
  assert.equal(canViewCompanyInboxQueue("manager", "active"), true);
  assert.equal(canViewCompanyInboxQueue("agent", "active"), false);

  assert.equal(canManageCompanyConversationRouting("owner", "active"), true);
  assert.equal(canManageCompanyConversationRouting("admin", "active"), true);
  assert.equal(canManageCompanyConversationRouting("manager", "active"), true);
  assert.equal(canManageCompanyConversationRouting("agent", "active"), false);
});

test("inactive memberships lose protected access", () => {
  assert.equal(canManageCompanyTeam("owner", "inactive"), false);
  assert.equal(canViewCompanyActivityFeed("manager", "inactive"), false);
  assert.equal(canEditCompanyProfile("owner", "inactive"), false);
});

test("invite and member-role mutations stay owner/admin scoped with anti-escalation rules", () => {
  assert.equal(canInviteOrganizationRole("owner", "active", "admin"), true);
  assert.equal(canInviteOrganizationRole("admin", "active", "manager"), true);
  assert.equal(canInviteOrganizationRole("admin", "active", "admin"), false);
  assert.equal(canInviteOrganizationRole("manager", "active", "agent"), false);

  assert.equal(canMutateOrganizationMemberRole("owner", "active", "owner", "admin"), true);
  assert.equal(canMutateOrganizationMemberRole("admin", "active", "manager", "agent"), true);
  assert.equal(canMutateOrganizationMemberRole("admin", "active", "manager", "admin"), false);
  assert.equal(canMutateOrganizationMemberRole("admin", "active", "owner", "manager"), false);
});
