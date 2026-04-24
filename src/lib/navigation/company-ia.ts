import type { OrganizationMemberRole } from "@/lib/company/team-types";

export type CompanyRouteCategory = "operational" | "governance" | "external";

export type CompanyRouteClassification = {
  route: string;
  category: CompanyRouteCategory;
  purpose: string;
};

export const COMPANY_CANONICAL_PATHS = {
  operationalHome: "/dashboard",
  agentOperationalHome: "/dashboard/listings",
  listingsInventory: "/dashboard/listings",
  createListing: "/dashboard/listings/new",
  editListing: "/dashboard/listings/[id]/edit",
  listingWorkflow: "/dashboard/listings/[id]/workflow",
  inbox: "/messages",
  activity: "/dashboard/activity",
  governanceHome: "/profile/company",
  companyProfile: "/profile/company/edit",
  companyTeam: "/profile/company/team",
  inviteAcceptance: "/profile/company/invites/[token]",
  publicCompanyProfile: "/companies/[slug]",
  notifications: "/notifications",
} as const;

export const COMPANY_ROUTE_CLASSIFICATIONS: readonly CompanyRouteClassification[] = [
  {
    route: "/company",
    category: "operational",
    purpose: "Role-aware company shortcut that routes to the right workspace home.",
  },
  {
    route: "/dashboard",
    category: "operational",
    purpose: "Operational workspace home for company listing and review work.",
  },
  {
    route: "/dashboard/listings",
    category: "operational",
    purpose: "Listing inventory and lifecycle queue.",
  },
  {
    route: "/dashboard/listings/new",
    category: "operational",
    purpose: "Create listing flow.",
  },
  {
    route: "/dashboard/listings/[id]/edit",
    category: "operational",
    purpose: "Listing edit flow.",
  },
  {
    route: "/dashboard/listings/[id]/workflow",
    category: "operational",
    purpose: "Company review and publish workflow.",
  },
  {
    route: "/dashboard/activity",
    category: "operational",
    purpose: "Company operational activity and workflow history.",
  },
  {
    route: "/messages",
    category: "operational",
    purpose: "Company inbox and assigned inquiry handling.",
  },
  {
    route: "/notifications",
    category: "operational",
    purpose: "Attention queue for actionable domain events.",
  },
  {
    route: "/profile/company",
    category: "governance",
    purpose: "Company governance home for workspace identity and settings.",
  },
  {
    route: "/profile/company/new",
    category: "governance",
    purpose: "Create company workspace and governance root.",
  },
  {
    route: "/profile/company/edit",
    category: "governance",
    purpose: "Company profile and branding management.",
  },
  {
    route: "/profile/company/team",
    category: "governance",
    purpose: "Team membership and invite management.",
  },
  {
    route: "/profile/company/invites/[token]",
    category: "governance",
    purpose: "Invite acceptance and membership onboarding.",
  },
  {
    route: "/companies/[slug]",
    category: "external",
    purpose: "Public company profile reference page.",
  },
] as const;

export function getCompanyOperationalHomeForRole(
  membershipRole: OrganizationMemberRole | null
) {
  if (membershipRole === "agent") {
    return "/dashboard/listings";
  }

  return "/dashboard";
}

export function canAccessCompanyActivityInNav(
  membershipRole: OrganizationMemberRole | null
) {
  return (
    membershipRole === "owner" ||
    membershipRole === "admin" ||
    membershipRole === "manager"
  );
}

export function canAccessCompanyTeamInNav(
  membershipRole: OrganizationMemberRole | null
) {
  return membershipRole === "owner" || membershipRole === "admin";
}
