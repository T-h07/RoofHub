import type { NavItem } from "@/types/navigation";

export const primaryNavItems: NavItem[] = [
  { title: "Home", href: "/" },
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
  { title: "Dashboard", href: "/dashboard" },
];

export const siteConfig = {
  name: "NestMap",
  title: "NestMap | Map-first Real Estate Foundation",
  description:
    "Foundational Next.js shell for a map-first real estate marketplace focused on scalable product delivery.",
  repositoryUrl: "https://github.com/T-h07/nestmap",
  primaryNav: primaryNavItems,
};
