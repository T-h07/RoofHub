import type { FooterLinkGroup } from "@/types/navigation";

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Public website",
    links: [
      { title: "Listings", href: "/explore" },
      { title: "Map search", href: "/map" },
      { title: "Company", href: "/company" },
    ],
  },
  {
    title: "Internal workspace",
    links: [
      { title: "Operations", href: "/dashboard" },
      { title: "Listing work", href: "/dashboard/listings" },
      { title: "Messages", href: "/messages" },
      { title: "Notifications", href: "/notifications" },
    ],
  },
  {
    title: "Governance",
    links: [
      { title: "Company settings", href: "/profile/company" },
      { title: "Team and invites", href: "/profile/company/team" },
      { title: "Profile", href: "/profile" },
    ],
  },
];

export const siteConfig = {
  name: "RoofHub",
  title: "RoofHub | Company real estate website and workspace",
  description:
    "RoofHub is a single-company real estate platform with a public listings website, map search, inquiries, and an internal operations workspace.",
  ctaLabel: "View listings",
  ctaHref: "/explore",
  footerLinks: footerLinkGroups,
} as const;
