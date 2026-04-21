import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

import { MainContainer } from "./main-container";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/70 bg-surface-soft mt-14 border-t">
      <MainContainer className="py-8">
        <div className="border-border/60 grid gap-8 border-b pb-7 md:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <div className="space-y-2">
            <p className="text-base font-semibold tracking-tight">{siteConfig.name}</p>
            <p className="type-body-muted max-w-sm">
              Map-first marketplace for rentals and homes for sale, built for clear discovery,
              provider publishing, and company-aware inquiry handling.
            </p>
          </div>

          {siteConfig.footerLinks.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="type-label">{group.title}</h3>
              <ul className="space-y-1.5">
                {group.links.map((link) => (
                  <li key={link.title}>
                    <Link
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                    >
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-muted-foreground flex flex-col gap-2 pt-4 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>{`© ${year} ${siteConfig.name}. All rights reserved.`}</p>
          <p>Map-first real estate operations for seekers, providers, and company teams.</p>
        </div>
      </MainContainer>
    </footer>
  );
}
