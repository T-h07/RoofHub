begin;

create or replace function public.is_valid_listing_image_path(object_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  segments text[];
  owner_segment text;
  listing_segment text;
  file_segment text;
begin
  if object_name is null then
    return false;
  end if;

  segments := string_to_array(object_name, '/');

  if coalesce(array_length(segments, 1), 0) <> 5 then
    return false;
  end if;

  if segments[1] <> 'owner' or segments[3] <> 'listing' then
    return false;
  end if;

  owner_segment := segments[2];
  listing_segment := segments[4];
  file_segment := segments[5];

  if owner_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if listing_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if file_segment !~ '^[a-z0-9][a-z0-9._-]*$' then
    return false;
  end if;

  if file_segment !~* '\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.listing_image_owner_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.is_valid_listing_image_path(object_name) then
    return null;
  end if;

  return split_part(object_name, '/', 2)::uuid;
end;
$$;

create or replace function public.listing_image_listing_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.is_valid_listing_image_path(object_name) then
    return null;
  end if;

  return split_part(object_name, '/', 4)::uuid;
end;
$$;

comment on function public.is_valid_listing_image_path(text) is
  'Validates listing image object path format: owner/{owner_id}/listing/{listing_id}/{filename}.';
comment on function public.listing_image_owner_id(text) is
  'Extracts owner UUID from listing image object path or returns null when invalid.';
comment on function public.listing_image_listing_id(text) is
  'Extracts listing UUID from listing image object path or returns null when invalid.';

grant execute on function public.is_valid_listing_image_path(text) to anon, authenticated, service_role;
grant execute on function public.listing_image_owner_id(text) to anon, authenticated, service_role;
grant execute on function public.listing_image_listing_id(text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists listing_images_bucket_select on storage.buckets;
drop policy if exists listing_images_object_select on storage.objects;
drop policy if exists listing_images_object_insert on storage.objects;
drop policy if exists listing_images_object_update on storage.objects;
drop policy if exists listing_images_object_delete on storage.objects;

create policy listing_images_bucket_select
on storage.buckets
for select
to anon, authenticated
using (id = 'listing-images');

create policy listing_images_object_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'listing-images'
  and public.is_valid_listing_image_path(name)
  and exists (
    select 1
    from public.listings l
    where l.id = public.listing_image_listing_id(name)
      and l.owner_id = public.listing_image_owner_id(name)
      and (
        l.listing_status = 'published'
        or l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy listing_images_object_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and public.is_valid_listing_image_path(name)
  and exists (
    select 1
    from public.listings l
    where l.id = public.listing_image_listing_id(name)
      and l.owner_id = public.listing_image_owner_id(name)
      and (
        public.is_admin()
        or l.owner_id = auth.uid()
      )
  )
);

create policy listing_images_object_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'listing-images'
  and public.is_valid_listing_image_path(name)
  and exists (
    select 1
    from public.listings l
    where l.id = public.listing_image_listing_id(name)
      and l.owner_id = public.listing_image_owner_id(name)
      and (
        public.is_admin()
        or l.owner_id = auth.uid()
      )
  )
)
with check (
  bucket_id = 'listing-images'
  and public.is_valid_listing_image_path(name)
  and exists (
    select 1
    from public.listings l
    where l.id = public.listing_image_listing_id(name)
      and l.owner_id = public.listing_image_owner_id(name)
      and (
        public.is_admin()
        or l.owner_id = auth.uid()
      )
  )
);

create policy listing_images_object_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and public.is_valid_listing_image_path(name)
  and exists (
    select 1
    from public.listings l
    where l.id = public.listing_image_listing_id(name)
      and l.owner_id = public.listing_image_owner_id(name)
      and (
        public.is_admin()
        or l.owner_id = auth.uid()
      )
  )
);

commit;
