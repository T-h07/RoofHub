begin;

create or replace function public.organization_active_member_count(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_user_id;
begin
  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for organization member count.' using errcode = '42501';
  end if;

  if not public.is_admin() and public.organization_active_member_role(p_organization_id, v_actor_id) is null then
    raise exception 'Active company membership is required.' using errcode = '42501';
  end if;

  return (
    select count(*)::integer
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.member_status = 'active'
  );
end;
$$;

comment on function public.organization_active_member_count(uuid, uuid) is
  'Returns active organization member count for an active member or admin.';

revoke all on function public.organization_active_member_count(uuid, uuid) from public;
grant execute on function public.organization_active_member_count(uuid, uuid)
  to authenticated, service_role;

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
    if not public.is_admin()
      and public.organization_active_member_role(v_listing.organization_id, v_actor_id) is null then
      raise exception 'Active company membership is required to access listing workflow.' using errcode = '42501';
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
  'Returns one listing workflow summary row for the authorized viewer.';

revoke all on function public.get_company_listing_workflow_listing(uuid, uuid) from public;
grant execute on function public.get_company_listing_workflow_listing(uuid, uuid)
  to authenticated, service_role;

create or replace function public.get_company_dashboard_overview(
  p_organization_id uuid,
  p_viewer_user_id uuid default auth.uid()
)
returns table (
  organization_id uuid,
  viewer_role public.organization_member_role,
  draft_count integer,
  pending_review_count integer,
  needs_changes_count integer,
  published_count integer,
  active_member_count integer,
  pending_invite_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_viewer_user_id;
  v_viewer_role public.organization_member_role;
begin
  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for dashboard access.' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_viewer_role := 'owner';
  else
    v_viewer_role := public.organization_active_member_role(p_organization_id, v_actor_id);
  end if;

  if v_viewer_role is null then
    raise exception 'Active company membership is required for dashboard access.' using errcode = '42501';
  end if;

  organization_id := p_organization_id;
  viewer_role := v_viewer_role;

  select count(*)::integer
  into draft_count
  from public.listings l
  where l.organization_id = p_organization_id
    and l.listing_status = 'draft';

  select count(*)::integer
  into pending_review_count
  from public.listings l
  where l.organization_id = p_organization_id
    and l.listing_status = 'submitted_for_review';

  select count(*)::integer
  into needs_changes_count
  from public.listings l
  where l.organization_id = p_organization_id
    and l.listing_status = 'needs_changes';

  select count(*)::integer
  into published_count
  from public.listings l
  where l.organization_id = p_organization_id
    and l.listing_status = 'published';

  active_member_count := public.organization_active_member_count(p_organization_id, v_actor_id);

  if public.is_admin() or v_viewer_role in ('owner', 'admin') then
    select count(*)::integer
    into pending_invite_count
    from public.organization_member_invites omi
    where omi.organization_id = p_organization_id
      and omi.invite_status = 'pending'
      and omi.expires_at > timezone('utc', now());
  else
    pending_invite_count := 0;
  end if;

  return next;
end;
$$;

comment on function public.get_company_dashboard_overview(uuid, uuid) is
  'Returns trusted company dashboard counts for an active member or admin.';

revoke all on function public.get_company_dashboard_overview(uuid, uuid) from public;
grant execute on function public.get_company_dashboard_overview(uuid, uuid)
  to authenticated, service_role;

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

  if public.is_admin() then
    v_viewer_role := 'owner';
  else
    v_viewer_role := public.organization_active_member_role(p_organization_id, v_actor_id);
  end if;

  if v_viewer_role is null then
    raise exception 'Active company membership is required for queue access.' using errcode = '42501';
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
  'Returns submitted-for-review queue rows for a company workspace.';

revoke all on function public.get_company_dashboard_pending_queue(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_pending_queue(uuid, uuid, integer)
  to authenticated, service_role;

create or replace function public.get_company_dashboard_activity_feed(
  p_organization_id uuid,
  p_viewer_user_id uuid default auth.uid(),
  p_limit integer default 24
)
returns table (
  event_id text,
  event_source text,
  event_type text,
  occurred_at timestamptz,
  actor_user_id uuid,
  actor_display_name text,
  target_id text,
  target_label text,
  metadata jsonb
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := p_viewer_user_id;
  v_viewer_role public.organization_member_role;
  v_can_view_invites boolean := false;
  v_limit integer := greatest(1, least(coalesce(p_limit, 24), 80));
begin
  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if v_actor_id is null then
    raise exception 'Authentication is required for activity feed access.' using errcode = '42501';
  end if;

  if public.is_admin() then
    v_viewer_role := 'owner';
  else
    v_viewer_role := public.organization_active_member_role(p_organization_id, v_actor_id);
  end if;

  if v_viewer_role is null then
    raise exception 'Active company membership is required for activity feed access.' using errcode = '42501';
  end if;

  v_can_view_invites := public.is_admin() or v_viewer_role in ('owner', 'admin');

  return query
  with listing_events as (
    select
      lwe.id::text as event_id,
      'listing_workflow'::text as event_source,
      lwe.event_type::text as event_type,
      lwe.created_at as occurred_at,
      lwe.actor_user_id,
      actor_profile.display_name as actor_display_name,
      lwe.listing_id::text as target_id,
      coalesce(nullif(btrim(coalesce(l.title, '')), ''), 'Listing') as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'from_status', lwe.from_status,
          'to_status', lwe.to_status,
          'note', nullif(btrim(coalesce(lwe.note, '')), '')
        )
      ) as metadata
    from public.listing_workflow_events lwe
    join public.listings l
      on l.id = lwe.listing_id
    left join public.profiles actor_profile
      on actor_profile.id = lwe.actor_user_id
    where lwe.organization_id = p_organization_id
  ),
  invite_events as (
    select
      concat(omi.id::text, ':created') as event_id,
      'organization_invite'::text as event_source,
      'invite.created'::text as event_type,
      omi.created_at as occurred_at,
      omi.invited_by_user_id as actor_user_id,
      invited_by_profile.display_name as actor_display_name,
      omi.id::text as target_id,
      coalesce(
        target_profile.display_name,
        nullif(btrim(coalesce(omi.invite_email, '')), ''),
        'Team invite'
      ) as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'role', omi.role,
          'status', omi.invite_status
        )
      ) as metadata
    from public.organization_member_invites omi
    left join public.profiles invited_by_profile
      on invited_by_profile.id = omi.invited_by_user_id
    left join public.profiles target_profile
      on target_profile.id = omi.target_user_id
    where v_can_view_invites
      and omi.organization_id = p_organization_id

    union all

    select
      concat(omi.id::text, ':accepted') as event_id,
      'organization_invite'::text as event_source,
      'invite.accepted'::text as event_type,
      omi.accepted_at as occurred_at,
      omi.accepted_by_user_id as actor_user_id,
      accepted_by_profile.display_name as actor_display_name,
      omi.id::text as target_id,
      coalesce(
        target_profile.display_name,
        nullif(btrim(coalesce(omi.invite_email, '')), ''),
        'Team invite'
      ) as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'role', omi.role,
          'status', omi.invite_status,
          'acceptance_outcome', 'accepted'
        )
      ) as metadata
    from public.organization_member_invites omi
    left join public.profiles accepted_by_profile
      on accepted_by_profile.id = omi.accepted_by_user_id
    left join public.profiles target_profile
      on target_profile.id = omi.target_user_id
    where v_can_view_invites
      and omi.organization_id = p_organization_id
      and omi.accepted_at is not null

    union all

    select
      concat(omi.id::text, ':revoked') as event_id,
      'organization_invite'::text as event_source,
      'invite.revoked'::text as event_type,
      coalesce(omi.updated_at, omi.created_at) as occurred_at,
      omi.invited_by_user_id as actor_user_id,
      invited_by_profile.display_name as actor_display_name,
      omi.id::text as target_id,
      coalesce(
        target_profile.display_name,
        nullif(btrim(coalesce(omi.invite_email, '')), ''),
        'Team invite'
      ) as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'role', omi.role,
          'status', omi.invite_status
        )
      ) as metadata
    from public.organization_member_invites omi
    left join public.profiles invited_by_profile
      on invited_by_profile.id = omi.invited_by_user_id
    left join public.profiles target_profile
      on target_profile.id = omi.target_user_id
    where v_can_view_invites
      and omi.organization_id = p_organization_id
      and omi.invite_status = 'revoked'

    union all

    select
      concat(omi.id::text, ':expired') as event_id,
      'organization_invite'::text as event_source,
      'invite.expired'::text as event_type,
      coalesce(omi.updated_at, omi.expires_at, omi.created_at) as occurred_at,
      omi.invited_by_user_id as actor_user_id,
      invited_by_profile.display_name as actor_display_name,
      omi.id::text as target_id,
      coalesce(
        target_profile.display_name,
        nullif(btrim(coalesce(omi.invite_email, '')), ''),
        'Team invite'
      ) as target_label,
      jsonb_strip_nulls(
        jsonb_build_object(
          'role', omi.role,
          'status', omi.invite_status
        )
      ) as metadata
    from public.organization_member_invites omi
    left join public.profiles invited_by_profile
      on invited_by_profile.id = omi.invited_by_user_id
    left join public.profiles target_profile
      on target_profile.id = omi.target_user_id
    where v_can_view_invites
      and omi.organization_id = p_organization_id
      and omi.invite_status = 'expired'
  )
  select
    combined.event_id,
    combined.event_source,
    combined.event_type,
    combined.occurred_at,
    combined.actor_user_id,
    combined.actor_display_name,
    combined.target_id,
    combined.target_label,
    combined.metadata
  from (
    select * from listing_events
    union all
    select * from invite_events
  ) as combined
  order by combined.occurred_at desc
  limit v_limit;
end;
$$;

comment on function public.get_company_dashboard_activity_feed(uuid, uuid, integer) is
  'Returns trusted company activity feed rows from workflow and invite events.';

revoke all on function public.get_company_dashboard_activity_feed(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_activity_feed(uuid, uuid, integer)
  to authenticated, service_role;

commit;
