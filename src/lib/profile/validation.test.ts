import assert from "node:assert/strict";
import test from "node:test";

import {
  readAccountModeFormInput,
  readContactPreferencesFormInput,
  readPublicProfileFormInput,
  validateAccountModeFormInput,
  validateContactPreferencesFormInput,
  validatePublicProfileFormInput,
} from "./validation";

function createFormData(entries: Array<[string, string]>) {
  const formData = new FormData();

  for (const [key, value] of entries) {
    formData.append(key, value);
  }

  return formData;
}

test("public profile validation accepts a valid display name and bio", () => {
  const input = readPublicProfileFormInput(
    createFormData([
      ["displayName", "RoofHub Agent"],
      ["bio", "Focused on high-intent rental leads across the city core."],
    ])
  );

  assert.deepEqual(validatePublicProfileFormInput(input), {});
});

test("contact preferences validation requires at least one enabled channel", () => {
  const input = readContactPreferencesFormInput(
    createFormData([
      ["preferredContactMethod", ""],
      ["phone", "+49 555 0100"],
    ])
  );

  assert.equal(
    validateContactPreferencesFormInput(input).contactMethods,
    "Choose at least one contact channel."
  );
});

test("contact preferences validation rejects email channel without contact email", () => {
  const input = readContactPreferencesFormInput(
    createFormData([
      ["contactMethods", "email"],
      ["preferredContactMethod", "email"],
    ])
  );

  assert.equal(
    validateContactPreferencesFormInput(input).contactEmail,
    "Contact email is required when email contact is enabled."
  );
});

test("account mode validation rejects unknown roles", () => {
  const input = readAccountModeFormInput(createFormData([["role", "company-owner"]]));

  assert.equal(validateAccountModeFormInput(input).role, "Role selection is invalid.");
});
