import type { ReactNode } from "react";

import { PageSection } from "@/components/layout/page-shell";

type ProfileSectionShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
};

export function ProfileSectionShell({
  eyebrow,
  title,
  description,
  children,
  className,
}: ProfileSectionShellProps) {
  return (
    <PageSection eyebrow={<p className="type-label">{eyebrow}</p>} title={title} description={description} className={className}>
      {children}
    </PageSection>
  );
}
