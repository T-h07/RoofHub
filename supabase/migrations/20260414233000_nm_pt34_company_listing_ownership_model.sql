begin;

alter table public.listings
  add column if not exists organization_id uuid references public.organizations (id) on delete set null,
  add column if not exists created_by_user_id uuid references public.profiles (id),
  add column if not exists assigned_agent_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists published_by_user_id uuid references public.profiles (id) on delete set null;

update public.listings
set created_by_user_id = owner_id
where created_by_user_id is null;

update public.listings
set assigned_agent_user_id = owner_id
where assigned_agent_user_id is null
  and organization_id is not null;

update public.listings
set published_by_user_id = owner_id
where published_by_user_id is null
  and published_at is not null;

alter table public.listings
  alter column created_by_user_id set not null;

create index if not exists listings_organization_idx
  on public.listings (organization_id);

create index if not exists listings_created_by_user_idx
  on public.listings (created_by_user_id);

create index if not exists listings_assigned_agent_user_idx
  on public.listings (assigned_agent_user_id);

create index if not exists listings_published_by_user_idx
  on public.listings (published_by_user_id);

create index if not exists listings_organization_status_published_idx
  on public.listings (organization_id, listing_status, published_at desc);

create or replace function public.is_active_organization_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.organization_active_member_role(p_organization_id, p_user_id) is not null;
$$;

comment on function public.is_active_organization_member(uuid, uuid) is
  'Returns true when a user has an active membership in the provided organization.';

revoke all on function public.is_active_organization_member(uuid, uuid) from public;
grant execute on function public.is_active_organization_member(uuid, uuid)
  to authenticated, service_role;

drop policy if exists listings_insert_owner_or_admin on public.listings;
drop policy if exists listings_update_owner_or_admin on public.listings;
drop policy if exists listings_delete_owner_or_admin on public.listings;

create policy listings_insert_owner_or_admin
on public.listings
for insert
to authenticated
with check (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and created_by_user_id = auth.uid()
    and (
      published_by_user_id is null
      or published_by_user_id = auth.uid()
    )
    and (
      organization_id is null
      or public.is_active_organization_member(organization_id)
    )
    and (
      organization_id is null
      or assigned_agent_user_id is null
      or exists (
        select 1
        from public.organization_members assigned_membership
        where assigned_membership.organization_id = organization_id
          and assigned_membership.user_id = assigned_agent_user_id
          and assigned_membership.member_status = 'active'
      )
    )
  )
);

create policy listings_update_owner_or_admin
on public.listings
for update
to authenticated
using (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and (
      organization_id is null
      or public.is_active_organization_member(organization_id)
    )
  )
)
with check (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and created_by_user_id = auth.uid()
    and (
      published_by_user_id is null
      or published_by_user_id = auth.uid()
    )
    and (
      organization_id is null
      or public.is_active_organization_member(organization_id)
    )
    and (
      organization_id is null
      or assigned_agent_user_id is null
      or exists (
        select 1
        from public.organization_members assigned_membership
        where assigned_membership.organization_id = organization_id
          and assigned_membership.user_id = assigned_agent_user_id
          and assigned_membership.member_status = 'active'
      )
    )
  )
);

create policy listings_delete_owner_or_admin
on public.listings
for delete
to authenticated
using (
  public.is_admin()
  or (
    owner_id = auth.uid()
    and (
      organization_id is null
      or public.is_active_organization_member(organization_id)
    )
  )
);

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
        or (
          l.owner_id = auth.uid()
          and (
            l.organization_id is null
            or public.is_active_organization_member(l.organization_id)
          )
        )
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
        public.is_admin()
        or (
          l.owner_id = auth.uid()
          and (
            l.organization_id is null
            or public.is_active_organization_member(l.organization_id)
          )
        )
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
        public.is_admin()
        or (
          l.owner_id = auth.uid()
          and (
            l.organization_id is null
            or public.is_active_organization_member(l.organization_id)
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.listings l
    where l.id = listing_images.listing_id
      and (
        public.is_admin()
        or (
          l.owner_id = auth.uid()
          and (
            l.organization_id is null
            or public.is_active_organization_member(l.organization_id)
          )
        )
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
        public.is_admin()
        or (
          l.owner_id = auth.uid()
          and (
            l.organization_id is null
            or public.is_active_organization_member(l.organization_id)
          )
        )
      )
  )
);

commit;
