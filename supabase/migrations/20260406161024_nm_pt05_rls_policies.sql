begin;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
  );
$$;

comment on function public.is_admin() is
  'Returns true when the current authenticated user has admin role in public.profiles.';

grant execute on function public.is_admin() to anon, authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.listing_images enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.listing_reports enable row level security;

drop policy if exists profiles_select_self on public.profiles;
drop policy if exists profiles_select_admin on public.profiles;
drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
drop policy if exists profiles_delete_admin on public.profiles;

create policy profiles_select_self
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy profiles_select_admin
on public.profiles
for select
to authenticated
using (public.is_admin());

create policy profiles_insert_self
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy profiles_insert_admin
on public.profiles
for insert
to authenticated
with check (public.is_admin());

create policy profiles_update_self
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy profiles_delete_admin
on public.profiles
for delete
to authenticated
using (public.is_admin());

drop policy if exists listings_select_published on public.listings;
drop policy if exists listings_select_owner on public.listings;
drop policy if exists listings_select_admin on public.listings;
drop policy if exists listings_insert_owner_or_admin on public.listings;
drop policy if exists listings_update_owner_or_admin on public.listings;
drop policy if exists listings_delete_owner_or_admin on public.listings;

create policy listings_select_published
on public.listings
for select
to anon, authenticated
using (listing_status = 'published');

create policy listings_select_owner
on public.listings
for select
to authenticated
using (owner_id = auth.uid());

create policy listings_select_admin
on public.listings
for select
to authenticated
using (public.is_admin());

create policy listings_insert_owner_or_admin
on public.listings
for insert
to authenticated
with check (owner_id = auth.uid() or public.is_admin());

create policy listings_update_owner_or_admin
on public.listings
for update
to authenticated
using (owner_id = auth.uid() or public.is_admin())
with check (owner_id = auth.uid() or public.is_admin());

create policy listings_delete_owner_or_admin
on public.listings
for delete
to authenticated
using (owner_id = auth.uid() or public.is_admin());

drop policy if exists listing_images_select_visible_listing on public.listing_images;
drop policy if exists listing_images_insert_owner_or_admin on public.listing_images;
drop policy if exists listing_images_update_owner_or_admin on public.listing_images;
drop policy if exists listing_images_delete_owner_or_admin on public.listing_images;

create policy listing_images_select_visible_listing
on public.listing_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.listing_status = 'published'
        or l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy listing_images_insert_owner_or_admin
on public.listing_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy listing_images_update_owner_or_admin
on public.listing_images
for update
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy listing_images_delete_owner_or_admin
on public.listing_images
for delete
to authenticated
using (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists favorites_select_self on public.favorites;
drop policy if exists favorites_select_admin on public.favorites;
drop policy if exists favorites_insert_self on public.favorites;
drop policy if exists favorites_delete_self on public.favorites;
drop policy if exists favorites_delete_admin on public.favorites;

create policy favorites_select_self
on public.favorites
for select
to authenticated
using (user_id = auth.uid());

create policy favorites_select_admin
on public.favorites
for select
to authenticated
using (public.is_admin());

create policy favorites_insert_self
on public.favorites
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.listings l
    where l.id = favorites.listing_id
      and (
        l.listing_status = 'published'
        or l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy favorites_delete_self
on public.favorites
for delete
to authenticated
using (user_id = auth.uid());

create policy favorites_delete_admin
on public.favorites
for delete
to authenticated
using (public.is_admin());

drop policy if exists conversations_select_participant_or_admin on public.conversations;
drop policy if exists conversations_insert_participant_or_admin on public.conversations;
drop policy if exists conversations_update_participant_or_admin on public.conversations;
drop policy if exists conversations_delete_admin on public.conversations;

create policy conversations_select_participant_or_admin
on public.conversations
for select
to authenticated
using (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
);

create policy conversations_insert_participant_or_admin
on public.conversations
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid() is not null
    and (provider_id = auth.uid() or seeker_id = auth.uid())
    and exists (
      select 1
      from public.listings l
      where l.id = conversations.listing_id
        and l.owner_id = conversations.provider_id
        and (
          l.listing_status = 'published'
          or l.owner_id = auth.uid()
        )
    )
  )
);

create policy conversations_update_participant_or_admin
on public.conversations
for update
to authenticated
using (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
)
with check (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
);

create policy conversations_delete_admin
on public.conversations
for delete
to authenticated
using (public.is_admin());

drop policy if exists messages_select_participant_or_admin on public.messages;
drop policy if exists messages_insert_participant_sender_or_admin on public.messages;
drop policy if exists messages_update_admin on public.messages;
drop policy if exists messages_delete_admin on public.messages;

create policy messages_select_participant_or_admin
on public.messages
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.provider_id = auth.uid()
        or c.seeker_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy messages_insert_participant_sender_or_admin
on public.messages
for insert
to authenticated
with check (
  public.is_admin()
  or (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (
          c.provider_id = auth.uid()
          or c.seeker_id = auth.uid()
        )
    )
  )
);

create policy messages_update_admin
on public.messages
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy messages_delete_admin
on public.messages
for delete
to authenticated
using (public.is_admin());

drop policy if exists listing_reports_select_reporter_or_admin on public.listing_reports;
drop policy if exists listing_reports_insert_reporter on public.listing_reports;
drop policy if exists listing_reports_update_admin on public.listing_reports;
drop policy if exists listing_reports_delete_admin on public.listing_reports;

create policy listing_reports_select_reporter_or_admin
on public.listing_reports
for select
to authenticated
using (reporter_id = auth.uid() or public.is_admin());

create policy listing_reports_insert_reporter
on public.listing_reports
for insert
to authenticated
with check (
  reporter_id = auth.uid()
  and exists (
    select 1
    from public.listings l
    where l.id = listing_reports.listing_id
      and (
        l.listing_status = 'published'
        or l.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

create policy listing_reports_update_admin
on public.listing_reports
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy listing_reports_delete_admin
on public.listing_reports
for delete
to authenticated
using (public.is_admin());

commit;
