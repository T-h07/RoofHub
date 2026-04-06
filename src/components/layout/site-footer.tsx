import Link from "next/link";

import { siteConfig } from "@/lib/config/site";

import { MainContainer } from "./main-container";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-border/70 mt-12 border-t">
      <MainContainer className="text-muted-foreground flex flex-col gap-3 py-6 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>{`© ${year} ${siteConfig.name}. Foundation scaffold in progress.`}</p>
        <Link
          href={siteConfig.repositoryUrl}
          className="hover:text-foreground underline-offset-4 transition-colors hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Repository
        </Link>
      </MainContainer>
    </footer>
  );
}
