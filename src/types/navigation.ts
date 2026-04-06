export type NavItem = {
  title: string;
  href: string;
  description?: string;
  disabled?: boolean;
};

export type FooterLinkGroup = {
  title: string;
  links: Array<Pick<NavItem, "title" | "href" | "disabled">>;
};
