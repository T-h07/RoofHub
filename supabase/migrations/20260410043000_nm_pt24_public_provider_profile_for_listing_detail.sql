begin;

drop policy if exists profiles_select_public_listing_owner on public.profiles;

create policy profiles_select_public_listing_owner
on public.profiles
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.owner_id = profiles.id
      and l.listing_status = 'published'
  )
);

commit;
