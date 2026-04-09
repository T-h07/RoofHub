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
  title: "NestMap | Map-first real estate marketplace",
  description:
    "Map-first real estate marketplace for rentals and homes for sale, with provider-ready onboarding paths and scalable Vercel + Supabase foundations.",
  repositoryUrl: "https://github.com/T-h07/nestmap",
  ctaLabel: "List a property",
  ctaHref: "/dashboard/listings/new",
  primaryNav: primaryNavItems,
  futureNav: futureNavItems,
  footerLinks: footerLinkGroups,
};
