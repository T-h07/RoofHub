import {
  getRoleLabel,
  isAdminRole,
  isProviderRole,
  type AppRole,
  type ProviderAccountType,
} from "@/lib/auth/roles";
import {
  ORGANIZATION_MEMBER_ROLE_LABELS,
  type OrganizationMemberRole,
} from "@/lib/company/team-types";
import {
  COMPANY_CANONICAL_PATHS,
  canAccessCompanyActivityInNav,
  canAccessCompanyTeamInNav,
} from "@/lib/navigation/company-ia";
import type { NavItem } from "@/types/navigation";

type NavViewer = {
  isAuthenticated: boolean;
  role: AppRole | null;
  providerAccountType: ProviderAccountType | null;
  companyMembershipRole: OrganizationMemberRole | null;
};

export type ViewerNavigation = {
  primary: NavItem[];
  secondary: NavItem[];
  account: NavItem[];
};

const GUEST_NAVIGATION: ViewerNavigation = {
  primary: [
    { title: "Home", href: "/" },
    { title: "Listings", href: "/explore" },
    { title: "Map", href: "/map" },
    { title: "Company", href: COMPANY_CANONICAL_PATHS.publicCompanyHome },
  ],
  secondary: [],
  account: [],
};

const AUTH_COMMUNICATION_PRIMARY_NAV: NavItem[] = [
  { title: "Messages", href: COMPANY_CANONICAL_PATHS.inbox },
];

const AUTH_DISCOVERY_PRIMARY_NAV: NavItem[] = [
  { title: "Listings", href: "/explore" },
  { title: "Map", href: "/map" },
  { title: "Company", href: COMPANY_CANONICAL_PATHS.publicCompanyHome },
];

const AUTH_ACCOUNT_NAV: NavItem[] = [
  { title: "Profile", href: "/profile" },
  { title: "Favorites", href: "/favorites" },
];

const PROVIDER_OPERATIONS_NAV: NavItem[] = [
  { title: "Operations", href: COMPANY_CANONICAL_PATHS.operationalHome },
  { title: "Listings", href: COMPANY_CANONICAL_PATHS.listingsInventory },
];

const APP_ADMIN_NAV: NavItem[] = [{ title: "Moderation", href: "/admin/moderation" }];

function getCompanyInboxNavItem(role: OrganizationMemberRole | null): NavItem {
  if (role === "agent") {
    return {
      title: "Assigned inbox",
      href: `${COMPANY_CANONICAL_PATHS.inbox}?section=outer_company&lane=assigned`,
    };
  }

  if (role === "manager" || role === "owner" || role === "admin") {
    return {
      title: role === "manager" ? "Queue inbox" : "Inbox routing",
      href: `${COMPANY_CANONICAL_PATHS.inbox}?section=outer_company&lane=queue`,
    };
  }

  return { title: "Messages", href: COMPANY_CANONICAL_PATHS.inbox };
}

function buildCompanyPrimaryNav(viewer: NavViewer): NavItem[] {
  const nav: NavItem[] = [];

  if (viewer.companyMembershipRole === "agent") {
    nav.push({
      title: "Listings",
      href: COMPANY_CANONICAL_PATHS.listingsInventory,
    });
  } else if (viewer.companyMembershipRole === "manager") {
    nav.push(
      { title: "Review", href: COMPANY_CANONICAL_PATHS.operationalHome },
      { title: "Listings", href: COMPANY_CANONICAL_PATHS.listingsInventory }
    );
  } else {
    nav.push(...PROVIDER_OPERATIONS_NAV);
  }

  nav.push(getCompanyInboxNavItem(viewer.companyMembershipRole));
  nav.push({ title: "Public site", href: COMPANY_CANONICAL_PATHS.publicCompanyHome });

  return nav;
}

function buildProviderCompanyNavigation(viewer: NavViewer, navigation: ViewerNavigation) {
  navigation.primary = buildCompanyPrimaryNav(viewer);

  if (viewer.companyMembershipRole === "agent") {
    navigation.secondary.push({
      title: "Operations",
      href: COMPANY_CANONICAL_PATHS.operationalHome,
    });
  }

  if (canAccessCompanyActivityInNav(viewer.companyMembershipRole)) {
    navigation.secondary.push({
      title: "Activity",
      href: COMPANY_CANONICAL_PATHS.activity,
    });
  }

  if (canAccessCompanyTeamInNav(viewer.companyMembershipRole)) {
    navigation.secondary.push({
      title: "Governance",
      href: COMPANY_CANONICAL_PATHS.governanceHome,
    });
    navigation.secondary.push({
      title: "Team",
      href: COMPANY_CANONICAL_PATHS.companyTeam,
    });
  }
}

function buildProviderNavigation(viewer: NavViewer, navigation: ViewerNavigation) {
  if (viewer.providerAccountType === "company") {
    buildProviderCompanyNavigation(viewer, navigation);
    return;
  }

  navigation.primary = [
    ...PROVIDER_OPERATIONS_NAV,
    ...AUTH_COMMUNICATION_PRIMARY_NAV,
    ...AUTH_DISCOVERY_PRIMARY_NAV,
  ];
  navigation.secondary.push({ title: "Company setup", href: "/profile/company/new" });
}

export function getNavigationForViewer(viewer: NavViewer): ViewerNavigation {
  if (!viewer.isAuthenticated) {
    return GUEST_NAVIGATION;
  }

  const navigation: ViewerNavigation = {
    primary: [...AUTH_DISCOVERY_PRIMARY_NAV, ...AUTH_COMMUNICATION_PRIMARY_NAV],
    secondary: [],
    account: [...AUTH_ACCOUNT_NAV],
  };

  if (isProviderRole(viewer.role)) {
    buildProviderNavigation(viewer, navigation);
  }

  if (isAdminRole(viewer.role)) {
    navigation.primary.unshift(...APP_ADMIN_NAV);
  }

  return {
    primary: [{ title: "Home", href: "/" }, ...navigation.primary],
    secondary: navigation.secondary,
    account: navigation.account,
  };
}

export function getPrimaryNavForViewer(viewer: NavViewer): NavItem[] {
  return getNavigationForViewer(viewer).primary;
}

const GUEST_CTA = {
  label: "Create account",
  href: "/auth/sign-up",
  detail: "Guest",
};

function getCompanyProviderCta(viewer: NavViewer) {
  if (viewer.companyMembershipRole === "agent") {
    return {
      label: "My listings",
      href: COMPANY_CANONICAL_PATHS.listingsInventory,
      detail: "Company agent",
    };
  }

  if (viewer.companyMembershipRole === "manager" || viewer.companyMembershipRole === "admin") {
    return {
      label: "Review queue",
      href: `${COMPANY_CANONICAL_PATHS.operationalHome}#pending-review-queue`,
      detail: ORGANIZATION_MEMBER_ROLE_LABELS[viewer.companyMembershipRole],
    };
  }

  if (viewer.companyMembershipRole === "owner") {
    return {
      label: "Operations",
      href: COMPANY_CANONICAL_PATHS.operationalHome,
      detail: "Company owner",
    };
  }

  return {
    label: "Governance",
    href: COMPANY_CANONICAL_PATHS.governanceHome,
    detail: getRoleLabel(viewer.role ?? "seeker"),
  };
}

export function getCtaForViewer(viewer: NavViewer) {
  if (!viewer.isAuthenticated) {
    return GUEST_CTA;
  }

  if (isAdminRole(viewer.role)) {
    return {
      label: "Moderation",
      href: "/admin/moderation",
      detail: getRoleLabel(viewer.role ?? "seeker"),
    };
  }

  if (isProviderRole(viewer.role)) {
    if (viewer.providerAccountType === "company") {
      return getCompanyProviderCta(viewer);
    }

    return {
      label: "Create listing",
      href: COMPANY_CANONICAL_PATHS.createListing,
      detail: getRoleLabel(viewer.role ?? "seeker"),
    };
  }

  return {
    label: "Saved homes",
    href: "/favorites",
    detail: getRoleLabel(viewer.role ?? "seeker"),
  };
}
