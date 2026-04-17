begin;

-- PT40: Enforce company-boundary membership on private listing reads.
drop policy if exists listings_select_owner on public.listings;

create policy listings_select_owner
on public.listings
for select
to authenticated
using (
  owner_id = auth.uid()
  and (
    organization_id is null
    or public.is_active_organization_member(organization_id)
  )
);

-- PT40: Keep owner updates possible after reviewer publish while blocking actor-attribution tampering.
drop policy if exists listings_update_owner_or_admin on public.listings;

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
    and exists (
      select 1
      from public.listings existing
      where existing.id = listings.id
        and existing.owner_id = listings.owner_id
        and existing.organization_id is not distinct from listings.organization_id
        and existing.created_by_user_id = listings.created_by_user_id
        and existing.published_by_user_id is not distinct from listings.published_by_user_id
    )
  )
);

-- PT40: Restrict workflow timeline visibility to reviewers or directly responsible actors.
drop policy if exists listing_workflow_events_select_relevant on public.listing_workflow_events;

create policy listing_workflow_events_select_relevant
on public.listing_workflow_events
for select
to authenticated
using (
  public.is_admin()
  or public.is_company_listing_reviewer(organization_id)
  or exists (
    select 1
    from public.listings l
    where l.id = listing_workflow_events.listing_id
      and l.organization_id = listing_workflow_events.organization_id
      and public.is_active_organization_member(l.organization_id)
      and (
        l.created_by_user_id = auth.uid()
        or l.assigned_agent_user_id = auth.uid()
      )
  )
);

-- PT40: Harden listing workflow context reads against broad same-org access.
create or replace function public.get_company_listing_workflow_listing(
  p_listing_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns table (
  id uuid,
  owner_id uuid,
  organization_id uuid,
  created_by_user_id uuid,
  assigned_agent_user_id uuid,
  published_by_user_id uuid,
  listing_status public.listing_status,
  title text,
  slug text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_viewer_user_id;
  v_listing public.listings%rowtype;
  v_viewer_role public.organization_member_role;
begin
  if p_listing_id is null then
    raise exception 'Listing reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for listing workflow access.' using errcode = '42501';
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
  limit 1;

  if not found then
    return;
  end if;

  if v_listing.organization_id is not null then
    if public.is_admin() then
      v_viewer_role := 'owner';
    else
      v_viewer_role := public.organization_active_member_role(v_listing.organization_id, v_actor_id);
    end if;

    if v_viewer_role is null then
      raise exception 'Active company membership is required to access listing workflow.' using errcode = '42501';
    end if;

    if v_viewer_role not in ('owner', 'admin', 'manager')
      and v_actor_id <> v_listing.created_by_user_id
      and v_actor_id <> v_listing.assigned_agent_user_id then
      raise exception 'Listing workflow access is limited to reviewers, creator, or assigned agent.' using errcode = '42501';
    end if;
  elsif not public.is_admin() and v_listing.owner_id <> v_actor_id then
    raise exception 'Listing access is restricted to owner context.' using errcode = '42501';
  end if;

  id := v_listing.id;
  owner_id := v_listing.owner_id;
  organization_id := v_listing.organization_id;
  created_by_user_id := v_listing.created_by_user_id;
  assigned_agent_user_id := v_listing.assigned_agent_user_id;
  published_by_user_id := v_listing.published_by_user_id;
  listing_status := v_listing.listing_status;
  title := v_listing.title;
  slug := v_listing.slug;
  updated_at := v_listing.updated_at;
  return next;
end;
$$;

comment on function public.get_company_listing_workflow_listing(uuid, uuid) is
  'Returns one listing workflow summary row for authorized reviewer/creator/assigned-agent viewers.';

revoke all on function public.get_company_listing_workflow_listing(uuid, uuid) from public;
grant execute on function public.get_company_listing_workflow_listing(uuid, uuid)
  to authenticated, service_role;

-- PT40: Ensure pending queue visibility is reviewer-scoped.
create or replace function public.get_company_dashboard_pending_queue(
  p_organization_id uuid,
  p_viewer_user_id uuid default auth.uid(),
  p_limit integer default 12
)
returns table (
  listing_id uuid,
  title text,
  listing_status public.listing_status,
  listing_type public.listing_type,
  property_type public.property_type,
  city text,
  neighborhood text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_user_id uuid,
  created_by_display_name text,
  assigned_agent_user_id uuid,
  assigned_agent_display_name text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_viewer_user_id;
  v_viewer_role public.organization_member_role;
  v_limit integer := greatest(1, least(coalesce(p_limit, 12), 40));
begin
  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for queue access.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.organizations org
    where org.id = p_organization_id
      and org.status = 'active'
  ) then
    raise exception 'Organization is unavailable.' using errcode = 'P0001';
  end if;

  if public.is_admin() then
    v_viewer_role := 'owner';
  else
    v_viewer_role := public.organization_active_member_role(p_organization_id, v_actor_id);
  end if;

  if v_viewer_role is null then
    raise exception 'Active company membership is required for queue access.' using errcode = '42501';
  end if;

  if v_viewer_role not in ('owner', 'admin', 'manager') then
    raise exception 'Owner, admin, or manager membership is required for pending queue access.' using errcode = '42501';
  end if;

  return query
  with pending as (
    select
      l.id,
      l.title,
      l.listing_status,
      l.listing_type,
      l.property_type,
      l.city,
      l.neighborhood,
      l.created_at,
      l.updated_at,
      l.created_by_user_id,
      l.assigned_agent_user_id
    from public.listings l
    where l.organization_id = p_organization_id
      and l.listing_status = 'submitted_for_review'
  )
  select
    pending.id as listing_id,
    pending.title,
    pending.listing_status,
    pending.listing_type,
    pending.property_type,
    pending.city,
    pending.neighborhood,
    pending.created_at,
    pending.updated_at,
    pending.created_by_user_id,
    creator.display_name as created_by_display_name,
    pending.assigned_agent_user_id,
    assigned.display_name as assigned_agent_display_name,
    submitted_event.created_at as submitted_at
  from pending
  left join lateral (
    select lwe.created_at
    from public.listing_workflow_events lwe
    where lwe.listing_id = pending.id
      and lwe.event_type = 'submitted_for_review'
    order by lwe.created_at desc
    limit 1
  ) submitted_event on true
  left join public.profiles creator on creator.id = pending.created_by_user_id
  left join public.profiles assigned on assigned.id = pending.assigned_agent_user_id
  order by coalesce(submitted_event.created_at, pending.updated_at) asc, pending.updated_at asc
  limit v_limit;
end;
$$;

comment on function public.get_company_dashboard_pending_queue(uuid, uuid, integer) is
  'Returns submitted-for-review queue rows for reviewer-capable company members.';

revoke all on function public.get_company_dashboard_pending_queue(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_pending_queue(uuid, uuid, integer)
  to authenticated, service_role;

-- PT40: Bind invite-email visibility checks to server-trusted primary email lookup.
drop policy if exists organization_member_invites_select_relevant on public.organization_member_invites;

create policy organization_member_invites_select_relevant
on public.organization_member_invites
for select
to authenticated
using (
  public.is_admin()
  or public.is_organization_owner_or_admin(organization_member_invites.organization_id)
  or (
    organization_member_invites.invite_status = 'pending'
    and (
      organization_member_invites.target_user_id = auth.uid()
      or (
        organization_member_invites.target_user_id is null
        and organization_member_invites.invite_email is not null
        and coalesce(public.current_user_primary_email(), '') = lower(organization_member_invites.invite_email)
      )
    )
  )
);

-- PT40: Preserve company storage boundary for listing media when owner membership is suspended/removed.
drop policy if exists listing_images_object_select on storage.objects;
drop policy if exists listing_images_object_insert on storage.objects;
drop policy if exists listing_images_object_delete on storage.objects;

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
        or public.is_admin()
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
