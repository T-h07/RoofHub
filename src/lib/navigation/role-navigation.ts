import {
  getRoleLabel,
  isAdminRole,
  isProviderRole,
  type AppRole,
  type ProviderAccountType,
} from "@/lib/auth/roles";
import type { NavItem } from "@/types/navigation";

type NavViewer = {
  isAuthenticated: boolean;
  role: AppRole | null;
  providerAccountType: ProviderAccountType | null;
};

const GUEST_PRIMARY_NAV: NavItem[] = [
  { title: "Home", href: "/" },
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
];

const AUTH_SHARED_NAV: NavItem[] = [
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
  { title: "Favorites", href: "/favorites" },
  { title: "Messages", href: "/messages" },
  { title: "Notifications", href: "/notifications" },
  { title: "Profile", href: "/profile" },
];

const PROVIDER_EXTRA_NAV: NavItem[] = [
  { title: "Dashboard", href: "/dashboard" },
  { title: "Listings", href: "/dashboard/listings" },
];

const ADMIN_EXTRA_NAV: NavItem[] = [{ title: "Moderation", href: "/admin/moderation" }];

export function getPrimaryNavForViewer(viewer: NavViewer): NavItem[] {
  if (!viewer.isAuthenticated) {
    return GUEST_PRIMARY_NAV;
  }

  const companyNavItem: NavItem =
    viewer.role === "provider" && viewer.providerAccountType === "company"
      ? { title: "Company Workspace", href: "/profile/company" }
      : { title: "Create Company Workspace", href: "/profile/company/new" };

  const nav = [...AUTH_SHARED_NAV];
  nav.splice(4, 0, companyNavItem);
  const workspaceNav: NavItem[] = [];

  if (isProviderRole(viewer.role)) {
    workspaceNav.push(...PROVIDER_EXTRA_NAV);
  }

  if (isAdminRole(viewer.role)) {
    workspaceNav.push(...ADMIN_EXTRA_NAV);
  }

  if (workspaceNav.length > 0) {
    nav.splice(2, 0, ...workspaceNav);
  }

  return [{ title: "Home", href: "/" }, ...nav];
}

export function getCtaForViewer(viewer: NavViewer) {
  if (!viewer.isAuthenticated) {
    return {
      label: "Create account",
      href: "/auth/sign-up",
      detail: "Guest",
    };
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
      return {
        label: "Company workspace",
        href: "/profile/company",
        detail: getRoleLabel(viewer.role ?? "seeker"),
      };
    }

    return {
      label: "List a property",
      href: "/dashboard/listings/new",
      detail: getRoleLabel(viewer.role ?? "seeker"),
    };
  }

  return {
    label: "Become provider",
    href: "/profile",
    detail: getRoleLabel(viewer.role ?? "seeker"),
  };
}
