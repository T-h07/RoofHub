begin;

create or replace function public.is_valid_profile_avatar_path(object_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  segments text[];
  user_segment text;
  file_segment text;
begin
  if object_name is null then
    return false;
  end if;

  if char_length(object_name) > 180 then
    return false;
  end if;

  if object_name ~ '\s' then
    return false;
  end if;

  segments := string_to_array(object_name, '/');

  if coalesce(array_length(segments, 1), 0) <> 3 then
    return false;
  end if;

  if segments[1] <> 'user' then
    return false;
  end if;

  user_segment := segments[2];
  file_segment := segments[3];

  if user_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;

  if file_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  return true;
end;
$$;

create or replace function public.profile_avatar_owner_id(object_name text)
returns uuid
language plpgsql
immutable
as $$
begin
  if not public.is_valid_profile_avatar_path(object_name) then
    return null;
  end if;

  return split_part(object_name, '/', 2)::uuid;
end;
$$;

comment on function public.is_valid_profile_avatar_path(text) is
  'Validates strict profile avatar path format: user/{user_id}/{uuid}.{jpg|jpeg|png|webp}.';
comment on function public.profile_avatar_owner_id(text) is
  'Extracts user UUID from profile avatar object path or returns null when invalid.';

grant execute on function public.is_valid_profile_avatar_path(text) to anon, authenticated, service_role;
grant execute on function public.profile_avatar_owner_id(text) to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_bucket_select on storage.buckets;
drop policy if exists profile_avatars_object_select on storage.objects;
drop policy if exists profile_avatars_object_insert on storage.objects;
drop policy if exists profile_avatars_object_update on storage.objects;
drop policy if exists profile_avatars_object_delete on storage.objects;

create policy profile_avatars_bucket_select
on storage.buckets
for select
to anon, authenticated
using (id = 'profile-avatars');

create policy profile_avatars_object_select
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'profile-avatars'
  and public.is_valid_profile_avatar_path(name)
);

create policy profile_avatars_object_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and public.is_valid_profile_avatar_path(name)
  and public.profile_avatar_owner_id(name) = auth.uid()
);

create policy profile_avatars_object_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.is_valid_profile_avatar_path(name)
  and (
    public.profile_avatar_owner_id(name) = auth.uid()
    or public.is_admin()
  )
);

commit;
