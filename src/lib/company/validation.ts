import type { CompanyWorkspaceCreateInput, CompanyWorkspaceFormErrors } from "@/lib/company/types";

const COMPANY_NAME_MIN = 2;
const COMPANY_NAME_MAX = 120;
const COMPANY_DESCRIPTION_MAX = 600;

function normalizeTrimmed(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function toNullable(value: string) {
  return value.length > 0 ? value : null;
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
