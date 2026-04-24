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
  menu: NavItem[];
};

const GUEST_NAVIGATION: ViewerNavigation = {
  primary: [
    { title: "Home", href: "/" },
    { title: "Explore", href: "/explore" },
    { title: "Map", href: "/map" },
  ],
  menu: [],
};

const AUTH_BASE_PRIMARY_NAV: NavItem[] = [
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
  { title: "Messages", href: COMPANY_CANONICAL_PATHS.inbox },
  { title: "Notifications", href: COMPANY_CANONICAL_PATHS.notifications },
];

const AUTH_BASE_MENU_NAV: NavItem[] = [
  { title: "Favorites", href: "/favorites" },
  { title: "Profile", href: "/profile" },
];

const PROVIDER_OPERATIONS_NAV: NavItem[] = [
  { title: "Dashboard", href: COMPANY_CANONICAL_PATHS.operationalHome },
  { title: "Listings", href: COMPANY_CANONICAL_PATHS.listingsInventory },
];

const APP_ADMIN_NAV: NavItem[] = [{ title: "Moderation", href: "/admin/moderation" }];

function buildProviderCompanyNavigation(
  viewer: NavViewer,
  navigation: ViewerNavigation
) {
  const roleScopedMenuItems: NavItem[] = [];

  if (
    viewer.companyMembershipRole === "owner" ||
    viewer.companyMembershipRole === "admin" ||
    viewer.companyMembershipRole === "manager" ||
    viewer.companyMembershipRole === null
  ) {
    navigation.primary.unshift(...PROVIDER_OPERATIONS_NAV);
  } else {
    navigation.primary.unshift({
      title: "Listings",
      href: COMPANY_CANONICAL_PATHS.listingsInventory,
    });
    roleScopedMenuItems.push({
      title: "Operations dashboard",
      href: COMPANY_CANONICAL_PATHS.operationalHome,
    });
  }

  if (canAccessCompanyTeamInNav(viewer.companyMembershipRole)) {
    roleScopedMenuItems.push({ title: "Team", href: COMPANY_CANONICAL_PATHS.companyTeam });
  }

  if (canAccessCompanyActivityInNav(viewer.companyMembershipRole)) {
    roleScopedMenuItems.push({ title: "Activity log", href: COMPANY_CANONICAL_PATHS.activity });
  }

  roleScopedMenuItems.push({
    title: "Company governance",
    href: COMPANY_CANONICAL_PATHS.governanceHome,
  });

  navigation.menu.unshift(...roleScopedMenuItems);
}

export function getNavigationForViewer(viewer: NavViewer): ViewerNavigation {
  if (!viewer.isAuthenticated) {
    return GUEST_NAVIGATION;
  }

  const navigation: ViewerNavigation = {
    primary: [...AUTH_BASE_PRIMARY_NAV],
    menu: [...AUTH_BASE_MENU_NAV],
  };

  if (isProviderRole(viewer.role)) {
    if (viewer.providerAccountType === "company") {
      buildProviderCompanyNavigation(viewer, navigation);
    } else {
      navigation.primary.unshift(...PROVIDER_OPERATIONS_NAV);
      navigation.menu.unshift({ title: "Company setup", href: "/profile/company/new" });
    }
  }

  if (isAdminRole(viewer.role)) {
    navigation.primary.unshift(...APP_ADMIN_NAV);
  }

  return {
    primary: [{ title: "Home", href: "/" }, ...navigation.primary],
    menu: navigation.menu,
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
    label: "Company governance",
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
