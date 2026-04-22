import type {
  CompanyProfileFormErrors,
  CompanyProfileUpdateInput,
  CompanyWorkspaceCreateInput,
  CompanyWorkspaceFormErrors,
} from "@/lib/company/types";

const COMPANY_NAME_MIN = 2;
const COMPANY_NAME_MAX = 120;
const COMPANY_DESCRIPTION_MAX = 600;
const COMPANY_CONTACT_EMAIL_MAX = 254;
const COMPANY_CONTACT_PHONE_MIN = 7;
const COMPANY_CONTACT_PHONE_MAX = 32;
const COMPANY_WEBSITE_URL_MAX = 255;
const COMPANY_COVERAGE_AREA_MAX = 220;

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PHONE_PATTERN = /^[0-9+()\-\s]{7,32}$/;
const SCHEME_PATTERN = /^[a-z][a-z0-9+.-]*:\/\//i;
const NON_BREAKING_SPACES_PATTERN = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const DASH_SEPARATORS_PATTERN = /[\u2010-\u2015]/g;
const ZERO_WIDTH_PATTERN = /[\u200B-\u200D\uFEFF]/g;

function normalizeTrimmed(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKC")
    .replace(NON_BREAKING_SPACES_PATTERN, " ")
    .replace(ZERO_WIDTH_PATTERN, "")
    .trim();
}

function toNullable(value: string) {
  return value.length > 0 ? value : null;
}

function normalizeEmail(value: string | null) {
  if (!value) {
    return null;
  }

  const stripped = value.replace(/^mailto:/i, "").replace(/^.*<([^<>]+)>.*$/u, "$1");

  const normalized = stripped
    .normalize("NFKC")
    .replace(NON_BREAKING_SPACES_PATTERN, " ")
    .replace(/\p{Cf}+/gu, "")
    .replace(/\p{Cc}+/gu, "")
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(/\s+/g, "")
    .replace(/^['"`]+|['"`]+$/g, "")
    .trim()
    .toLowerCase();

  return normalized.length > 0 ? normalized : null;
}

export function readCompanyWorkspaceInput(formData: FormData): CompanyWorkspaceCreateInput {
  const name = normalizeTrimmed(formData.get("name"));
  const description = toNullable(normalizeTrimmed(formData.get("description")));

  return {
    name,
    description,
  };
}

export function validateCompanyWorkspaceInput(input: CompanyWorkspaceCreateInput) {
  const errors: CompanyWorkspaceFormErrors = {};

  if (input.name.length < COMPANY_NAME_MIN || input.name.length > COMPANY_NAME_MAX) {
    errors.name = `Company name must be ${COMPANY_NAME_MIN}-${COMPANY_NAME_MAX} characters.`;
  }

  if (input.description && input.description.length > COMPANY_DESCRIPTION_MAX) {
    errors.description = `Company description must be ${COMPANY_DESCRIPTION_MAX} characters or fewer.`;
  }

  return errors;
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value
    .normalize("NFKC")
    .replace(NON_BREAKING_SPACES_PATTERN, " ")
    .replace(DASH_SEPARATORS_PATTERN, "-")
    .replace(/[./]/g, " ")
    .replace(ZERO_WIDTH_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > 0 ? normalized : null;
}

function normalizeWebsiteUrl(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return SCHEME_PATTERN.test(normalized) ? normalized : `https://${normalized}`;
}

export function readCompanyProfileInput(formData: FormData): CompanyProfileUpdateInput {
  const name = normalizeTrimmed(formData.get("name"));
  const description = toNullable(normalizeTrimmed(formData.get("description")));
  const contactEmail = normalizeEmail(toNullable(normalizeTrimmed(formData.get("contactEmail"))));
  const contactPhone = normalizePhone(toNullable(normalizeTrimmed(formData.get("contactPhone"))));
  const websiteUrl = normalizeWebsiteUrl(toNullable(normalizeTrimmed(formData.get("websiteUrl"))));
  const coverageArea = toNullable(normalizeTrimmed(formData.get("coverageArea")));

  return {
    name,
    description,
    contactEmail,
    contactPhone,
    websiteUrl,
    coverageArea,
  };
}

export function validateCompanyProfileInput(input: CompanyProfileUpdateInput) {
  const errors: CompanyProfileFormErrors = {};

  if (input.name.length < COMPANY_NAME_MIN || input.name.length > COMPANY_NAME_MAX) {
    errors.name = `Company name must be ${COMPANY_NAME_MIN}-${COMPANY_NAME_MAX} characters.`;
  }

  if (input.description && input.description.length > COMPANY_DESCRIPTION_MAX) {
    errors.description = `Company description must be ${COMPANY_DESCRIPTION_MAX} characters or fewer.`;
  }

  if (input.contactEmail) {
    if (
      input.contactEmail.length > COMPANY_CONTACT_EMAIL_MAX ||
      !EMAIL_PATTERN.test(input.contactEmail)
    ) {
      errors.contactEmail = "Enter a valid email address.";
    }
  }

  if (input.contactPhone) {
    if (
      input.contactPhone.length < COMPANY_CONTACT_PHONE_MIN ||
      input.contactPhone.length > COMPANY_CONTACT_PHONE_MAX ||
      !PHONE_PATTERN.test(input.contactPhone)
    ) {
      errors.contactPhone = "Enter a valid phone number.";
    }
  }

  if (input.websiteUrl) {
    if (input.websiteUrl.length > COMPANY_WEBSITE_URL_MAX) {
      errors.websiteUrl = `Website URL must be ${COMPANY_WEBSITE_URL_MAX} characters or fewer.`;
    } else if (
      !input.websiteUrl.toLowerCase().startsWith("http://") &&
      !input.websiteUrl.toLowerCase().startsWith("https://")
    ) {
      errors.websiteUrl = "Website URL must use http or https.";
    } else {
      try {
        const parsedUrl = new URL(input.websiteUrl);
        if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
          errors.websiteUrl = "Website URL must use http or https.";
        }
      } catch {
        errors.websiteUrl = "Enter a valid website URL.";
      }
    }
  }

  if (input.coverageArea && input.coverageArea.length > COMPANY_COVERAGE_AREA_MAX) {
    errors.coverageArea = `Coverage summary must be ${COMPANY_COVERAGE_AREA_MAX} characters or fewer.`;
  }

  return errors;
}
