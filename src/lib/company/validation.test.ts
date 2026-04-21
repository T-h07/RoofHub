import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeCompanyLogoDeclaredMimeType,
  validateCompanyLogoFile,
} from "@/lib/storage/company-logo";

import { readCompanyProfileInput, validateCompanyProfileInput } from "./validation";

function createFormData(entries: Array<[string, string]>) {
  const formData = new FormData();

  for (const [key, value] of entries) {
    formData.append(key, value);
  }

  return formData;
}

test("company profile validation normalizes common website and phone input", () => {
  const input = readCompanyProfileInput(
    createFormData([
      ["name", "RoofHub Realty"],
      ["description", "Marketplace-ready company profile."],
      ["contactEmail", "INFO@ROOFHUB.EXAMPLE"],
      ["contactPhone", "+49.555/0100"],
      ["websiteUrl", "www.roofhub.example"],
      ["coverageArea", "Berlin and surrounding neighborhoods"],
    ])
  );

  assert.equal(input.contactEmail, "info@roofhub.example");
  assert.equal(input.contactPhone, "+49 555 0100");
  assert.equal(input.websiteUrl, "https://www.roofhub.example");
  assert.deepEqual(validateCompanyProfileInput(input), {});
});

test("company profile validation still rejects unsafe website schemes", () => {
  const input = readCompanyProfileInput(
    createFormData([
      ["name", "RoofHub Realty"],
      ["websiteUrl", "javascript:alert(1)"],
    ])
  );

  assert.equal(
    validateCompanyProfileInput(input).websiteUrl,
    "Website URL must use http or https."
  );
});

test("company logo validation allows empty MIME metadata and jpg aliases", () => {
  const pngWithoutDeclaredType = new File(["logo"], "logo.png", { type: "" });
  const jpegAlias = new File(["logo"], "logo.jpg", { type: "image/jpg" });

  assert.deepEqual(validateCompanyLogoFile(pngWithoutDeclaredType), []);
  assert.deepEqual(validateCompanyLogoFile(jpegAlias), []);
  assert.equal(normalizeCompanyLogoDeclaredMimeType("image/jpg"), "image/jpeg");
});
