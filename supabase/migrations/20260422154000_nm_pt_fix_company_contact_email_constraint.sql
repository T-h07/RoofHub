begin;

alter table public.organizations
  drop constraint if exists organizations_contact_email_format;

alter table public.organizations
  add constraint organizations_contact_email_format check (
    contact_email is null
    or (
      char_length(contact_email) <= 254
      and contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}$'
    )
  );

commit;
