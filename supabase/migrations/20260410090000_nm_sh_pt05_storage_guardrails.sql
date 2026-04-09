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

  if char_length(object_name) > 220 then
    return false;
  end if;

  if object_name ~ '\s' then
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

  if file_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  return true;
end;
$$;

comment on function public.is_valid_listing_image_path(text) is
  'Validates strict listing image object path format: owner/{owner_id}/listing/{listing_id}/{uuid-filename}.{jpg|jpeg|png|webp}.';

-- Normal upload flow should use insert+delete only. Keep update disabled to reduce overwrite abuse.
drop policy if exists listing_images_object_update on storage.objects;

commit;
