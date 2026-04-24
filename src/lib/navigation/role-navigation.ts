import {
  getRoleLabel,
  isAdminRole,
  isProviderRole,
  type AppRole,
  type ProviderAccountType,
} from "@/lib/auth/roles";
import { ORGANIZATION_MEMBER_ROLE_LABELS, type OrganizationMemberRole } from "@/lib/company/team-types";
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
    { title: "Explore", href: "/explore" },
    { title: "Map", href: "/map" },
  ],
  secondary: [],
  account: [],
};

const AUTH_COMMUNICATION_PRIMARY_NAV: NavItem[] = [
  { title: "Messages", href: COMPANY_CANONICAL_PATHS.inbox },
  { title: "Notifications", href: COMPANY_CANONICAL_PATHS.notifications },
];

const AUTH_DISCOVERY_PRIMARY_NAV: NavItem[] = [
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
];

const AUTH_ACCOUNT_NAV: NavItem[] = [
  { title: "Profile", href: "/profile" },
  { title: "Favorites", href: "/favorites" },
];

const PROVIDER_OPERATIONS_NAV: NavItem[] = [
  { title: "Dashboard", href: COMPANY_CANONICAL_PATHS.operationalHome },
  { title: "Listings", href: COMPANY_CANONICAL_PATHS.listingsInventory },
];

const APP_ADMIN_NAV: NavItem[] = [{ title: "Moderation", href: "/admin/moderation" }];

function buildCompanyPrimaryNav(viewer: NavViewer): NavItem[] {
  const nav: NavItem[] = [];

  if (
    viewer.companyMembershipRole === "owner" ||
    viewer.companyMembershipRole === "admin" ||
    viewer.companyMembershipRole === "manager" ||
    viewer.companyMembershipRole === null
  ) {
    nav.push(...PROVIDER_OPERATIONS_NAV);
  } else {
    nav.push({
      title: "Listings",
      href: COMPANY_CANONICAL_PATHS.listingsInventory,
    });
  }

  nav.push(...AUTH_COMMUNICATION_PRIMARY_NAV);
  nav.push({
    title: "Company",
    href: COMPANY_CANONICAL_PATHS.governanceHome,
  });
  nav.push(...AUTH_DISCOVERY_PRIMARY_NAV);

  return nav;
}

function buildProviderCompanyNavigation(
  viewer: NavViewer,
  navigation: ViewerNavigation
) {
  navigation.primary = buildCompanyPrimaryNav(viewer);

  if (viewer.companyMembershipRole === "agent") {
    navigation.secondary.push({
      title: "Operations dashboard",
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

  if (
    viewer.companyMembershipRole === "manager" ||
    viewer.companyMembershipRole === "admin"
  ) {
    return {
      label: "Review queue",
      href: `${COMPANY_CANONICAL_PATHS.operationalHome}#pending-review-queue`,
      detail: ORGANIZATION_MEMBER_ROLE_LABELS[viewer.companyMembershipRole],
    };
  }

  if (viewer.companyMembershipRole === "owner") {
    return {
      label: "Operations dashboard",
      href: COMPANY_CANONICAL_PATHS.operationalHome,
      detail: "Company owner",
    };
  }

  return {
    label: "Company",
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
    label: "Become provider",
    href: "/profile",
    detail: getRoleLabel(viewer.role ?? "seeker"),
  };
}
