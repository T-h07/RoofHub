import type { FooterLinkGroup, NavItem } from "@/types/navigation";

export const primaryNavItems: NavItem[] = [
  { title: "Home", href: "/" },
  { title: "Explore", href: "/explore" },
  { title: "Map", href: "/map" },
  { title: "Dashboard", href: "/dashboard" },
];

export const futureNavItems: NavItem[] = [
  { title: "Favorites", href: "/favorites", disabled: true },
  { title: "Messages", href: "/messages", disabled: true },
  { title: "Profile", href: "/profile", disabled: true },
];

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Product",
    links: [
      { title: "Explore", href: "/explore" },
      { title: "Map Workspace", href: "/map" },
      { title: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    title: "Roadmap",
    links: [
      { title: "Favorites", href: "/favorites", disabled: true },
      { title: "Messages", href: "/messages", disabled: true },
      { title: "Profile", href: "/profile", disabled: true },
    ],
  },
];

export const siteConfig = {
  name: "NestMap",
  title: "NestMap | Profile and Role Foundation",
  description:
    "Map-first real estate platform scaffold with a reusable dark shell, Supabase-first foundation, and trusted profile/role bootstrapping.",
  repositoryUrl: "https://github.com/T-h07/nestmap",
  ctaLabel: "List a property",
  ctaHref: "/dashboard",
  primaryNav: primaryNavItems,
  futureNav: futureNavItems,
  footerLinks: footerLinkGroups,
};
