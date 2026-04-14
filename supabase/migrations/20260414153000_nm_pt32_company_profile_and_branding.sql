begin;

alter table public.organizations
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists website_url text,
  add column if not exists coverage_area text;

alter table public.organizations
  drop constraint if exists organizations_contact_email_not_blank,
  drop constraint if exists organizations_contact_email_format,
  drop constraint if exists organizations_contact_phone_not_blank,
  drop constraint if exists organizations_contact_phone_format,
  drop constraint if exists organizations_website_url_not_blank,
  drop constraint if exists organizations_website_url_format,
  drop constraint if exists organizations_coverage_area_not_blank,
  drop constraint if exists organizations_coverage_area_length;

alter table public.organizations
  add constraint organizations_contact_email_not_blank check (
    contact_email is null
    or char_length(btrim(contact_email)) > 0
  ),
  add constraint organizations_contact_email_format check (
    contact_email is null
    or (
      char_length(contact_email) <= 254
      and contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
    )
  ),
  add constraint organizations_contact_phone_not_blank check (
    contact_phone is null
    or char_length(btrim(contact_phone)) > 0
  ),
  add constraint organizations_contact_phone_format check (
    contact_phone is null
    or contact_phone ~ '^[0-9+()\-\s]{7,32}$'
  ),
  add constraint organizations_website_url_not_blank check (
    website_url is null
    or char_length(btrim(website_url)) > 0
  ),
  add constraint organizations_website_url_format check (
    website_url is null
    or (
      char_length(website_url) <= 255
      and website_url ~* '^https?://'
    )
  ),
  add constraint organizations_coverage_area_not_blank check (
    coverage_area is null
    or char_length(btrim(coverage_area)) > 0
  ),
  add constraint organizations_coverage_area_length check (
    coverage_area is null
    or char_length(coverage_area) <= 220
  );

drop policy if exists organizations_select_public_active on public.organizations;

create policy organizations_select_public_active
on public.organizations
for select
to anon, authenticated
using (status = 'active');

create or replace function public.is_valid_company_logo_path(object_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  segments text[];
  organization_segment text;
  file_segment text;
begin
  if object_name is null then
    return false;
  end if;

  if char_length(object_name) > 200 then
    return false;
  end if;

  if object_name ~ '\\s' then
    return false;
  end if;

  segments := string_to_array(object_name, '/');

  if coalesce(array_length(segments, 1), 0) <> 3 then
    return false;
  end if;

  if segments[1] <> 'organization' then
    return false;
  end if;

  organization_segment := segments[2];
  file_segment := segments[3];

  if organization_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if file_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.company_logo_organization_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.is_valid_company_logo_path(object_name) then
    return null;
  end if;

  return split_part(object_name, '/', 2)::uuid;
end;
$$;

comment on function public.is_valid_company_logo_path(text) is
  'Validates strict company logo path format: organization/{organization_id}/{uuid}.{jpg|jpeg|png|webp}.';
comment on function public.company_logo_organization_id(text) is
  'Extracts organization UUID from company logo object path or returns null when invalid.';

grant execute on function public.is_valid_company_logo_path(text) to anon, authenticated, service_role;
grant execute on function public.company_logo_organization_id(text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'company-logos',
  'company-logos',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists company_logos_bucket_select on storage.buckets;
drop policy if exists company_logos_object_select on storage.objects;
drop policy if exists company_logos_object_insert on storage.objects;
drop policy if exists company_logos_object_update on storage.objects;
drop policy if exists company_logos_object_delete on storage.objects;

create policy company_logos_bucket_select
on storage.buckets
for select
to anon, authenticated
using (id = 'company-logos');

create policy company_logos_object_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'company-logos'
  and public.is_valid_company_logo_path(name)
);

create policy company_logos_object_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'company-logos'
  and public.is_valid_company_logo_path(name)
  and (
    public.is_admin()
    or exists (
      select 1
      from public.organization_members owner_membership
      where owner_membership.organization_id = public.company_logo_organization_id(name)
        and owner_membership.user_id = auth.uid()
        and owner_membership.role = 'owner'
        and owner_membership.member_status = 'active'
    )
  )
);

create policy company_logos_object_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'company-logos'
  and public.is_valid_company_logo_path(name)
  and (
    public.is_admin()
    or exists (
      select 1
      from public.organization_members owner_membership
      where owner_membership.organization_id = public.company_logo_organization_id(name)
        and owner_membership.user_id = auth.uid()
        and owner_membership.role = 'owner'
        and owner_membership.member_status = 'active'
    )
  )
);

commit;
