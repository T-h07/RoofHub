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
