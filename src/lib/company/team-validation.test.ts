import assert from "node:assert/strict";
import test from "node:test";

import {
  readCompanyTeamInviteInput,
  readInviteRevocationInput,
  readMemberRemovalInput,
  readMembershipRoleChangeInput,
  readMembershipStatusInput,
  validateCompanyTeamInviteInput,
  validateInviteRevocationInput,
  validateMemberRemovalInput,
  validateMembershipRoleChangeInput,
  validateMembershipStatusInput,
} from "./team-validation";

const ORGANIZATION_ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";
const INVITE_ID = "33333333-3333-4333-8333-333333333333";

function createFormData(entries: Array<[string, string]>) {
  const formData = new FormData();

  for (const [key, value] of entries) {
    formData.append(key, value);
  }

  return formData;
}

test("team invite validation carries the scoped company workspace id", () => {
  const input = readCompanyTeamInviteInput(
    createFormData([
      ["organizationId", ORGANIZATION_ID],
      ["inviteMethod", "email"],
      ["inviteEmail", "teammate@roofhub.example"],
      ["role", "agent"],
    ])
  );

  assert.equal(input.organizationId, ORGANIZATION_ID);
  assert.deepEqual(validateCompanyTeamInviteInput(input), {});
});

test("team invite validation rejects missing company workspace scope", () => {
  const input = readCompanyTeamInviteInput(
    createFormData([
      ["inviteMethod", "email"],
      ["inviteEmail", "teammate@roofhub.example"],
      ["role", "agent"],
    ])
  );

  assert.equal(
    validateCompanyTeamInviteInput(input).organizationId,
    "Company workspace reference is invalid."
  );
});

test("team member mutations require scoped company workspace ids", () => {
  const roleChange = readMembershipRoleChangeInput(
    createFormData([
      ["organizationId", ORGANIZATION_ID],
      ["membershipId", MEMBER_ID],
      ["newRole", "manager"],
    ])
  );
  const statusChange = readMembershipStatusInput(
    createFormData([
      ["organizationId", ORGANIZATION_ID],
      ["membershipId", MEMBER_ID],
      ["nextStatus", "inactive"],
    ])
  );
  const removal = readMemberRemovalInput(
    createFormData([
      ["organizationId", ORGANIZATION_ID],
      ["membershipId", MEMBER_ID],
    ])
  );
  const revocation = readInviteRevocationInput(
    createFormData([
      ["organizationId", ORGANIZATION_ID],
      ["inviteId", INVITE_ID],
    ])
  );

  assert.equal(validateMembershipRoleChangeInput(roleChange), null);
  assert.equal(validateMembershipStatusInput(statusChange), null);
  assert.equal(validateMemberRemovalInput(removal), null);
  assert.equal(validateInviteRevocationInput(revocation), null);
});
