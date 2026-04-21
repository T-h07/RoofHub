import type { FooterLinkGroup } from "@/types/navigation";

export const footerLinkGroups: FooterLinkGroup[] = [
  {
    title: "Browse",
    links: [
      { title: "Explore listings", href: "/explore" },
      { title: "Map search", href: "/map" },
      { title: "Saved listings", href: "/favorites" },
    ],
  },
  {
    title: "Account",
    links: [
      { title: "Messages", href: "/messages" },
      { title: "Notifications", href: "/notifications" },
      { title: "Profile", href: "/profile" },
      { title: "Create account", href: "/auth/sign-up" },
    ],
  },
  {
    title: "Providers",
    links: [
      { title: "Dashboard", href: "/dashboard" },
      { title: "Manage listings", href: "/dashboard/listings" },
      { title: "Company workspace", href: "/profile/company" },
    ],
  },
];

export const siteConfig = {
  name: "RoofHub",
  title: "RoofHub | Map-first real estate marketplace",
  description:
    "Map-first real estate marketplace for rentals and homes for sale, with provider, company, and messaging workflows that already run on Vercel and Supabase.",
  ctaLabel: "List a property",
  ctaHref: "/dashboard/listings/new",
  footerLinks: footerLinkGroups,
} as const;
