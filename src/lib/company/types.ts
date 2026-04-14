export type CompanyWorkspaceFieldName = "name" | "description" | "form";

export type CompanyWorkspaceFormErrors = Partial<Record<CompanyWorkspaceFieldName, string>>;

export type CompanyWorkspaceCreateInput = {
  name: string;
  description: string | null;
};

export type CompanyWorkspaceCreateActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: CompanyWorkspaceFormErrors;
  redirectTo?: string;
  organizationSlug?: string;
};

export const COMPANY_WORKSPACE_CREATE_IDLE_STATE: CompanyWorkspaceCreateActionState = {
  status: "idle",
};

export type CompanyProfileFieldName =
  | "name"
  | "description"
  | "contactEmail"
  | "contactPhone"
  | "websiteUrl"
  | "coverageArea"
  | "form";

export type CompanyProfileFormErrors = Partial<Record<CompanyProfileFieldName, string>>;

export type CompanyProfileUpdateInput = {
  name: string;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  websiteUrl: string | null;
  coverageArea: string | null;
};

export type CompanyProfileActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: CompanyProfileFormErrors;
  redirectTo?: string;
};

export const COMPANY_PROFILE_IDLE_STATE: CompanyProfileActionState = {
  status: "idle",
};

export type CompanyLogoActionState = {
  status: "idle" | "error" | "success";
  message?: string;
};

export const COMPANY_LOGO_ACTION_IDLE_STATE: CompanyLogoActionState = {
  status: "idle",
};
