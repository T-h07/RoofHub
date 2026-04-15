begin;

alter type public.listing_status add value if not exists 'submitted_for_review';
alter type public.listing_status add value if not exists 'needs_changes';
alter type public.listing_status add value if not exists 'approved';
alter type public.listing_status add value if not exists 'unpublished';

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'listing_workflow_event_type'
  ) then
    create type public.listing_workflow_event_type as enum (
      'created',
      'submitted_for_review',
      'needs_changes',
      'approved',
      'published',
      'unpublished'
    );
  end if;
end
$$;

create table if not exists public.listing_workflow_events (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  event_type public.listing_workflow_event_type not null,
  from_status public.listing_status,
  to_status public.listing_status,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint listing_workflow_events_note_length check (note is null or char_length(note) <= 2000),
  constraint listing_workflow_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint listing_workflow_events_metadata_size check (pg_column_size(metadata) <= 8192)
);

comment on table public.listing_workflow_events is
  'Company listing workflow timeline events for review/publish lifecycle changes.';

create index if not exists listing_workflow_events_listing_created_idx
  on public.listing_workflow_events (listing_id, created_at desc);

create index if not exists listing_workflow_events_organization_created_idx
  on public.listing_workflow_events (organization_id, created_at desc);

alter table public.listing_workflow_events enable row level security;

drop policy if exists listing_workflow_events_select_relevant on public.listing_workflow_events;

create policy listing_workflow_events_select_relevant
on public.listing_workflow_events
for select
to authenticated
using (
  public.is_admin()
  or public.is_active_organization_member(organization_id)
);

create or replace function public.is_company_listing_reviewer(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or public.organization_active_member_role(p_organization_id, p_user_id) in ('owner', 'admin', 'manager');
$$;

comment on function public.is_company_listing_reviewer(uuid, uuid) is
  'Returns true when user can review/approve/publish company listings for an organization.';

revoke all on function public.is_company_listing_reviewer(uuid, uuid) from public;
grant execute on function public.is_company_listing_reviewer(uuid, uuid)
  to authenticated, service_role;

create or replace function public.log_listing_workflow_event(
  p_listing_id uuid,
  p_event_type public.listing_workflow_event_type,
  p_from_status public.listing_status default null,
  p_to_status public.listing_status default null,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_uid uuid := auth.uid();
  v_effective_actor_user_id uuid := coalesce(p_actor_user_id, v_current_uid);
  v_listing_organization_id uuid;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_event_id uuid;
begin
  if p_listing_id is null then
    raise exception 'Listing reference is required.' using errcode = 'P0001';
  end if;

  if p_event_type is null then
    raise exception 'Workflow event type is required.' using errcode = 'P0001';
  end if;

  if v_note is not null and char_length(v_note) > 2000 then
    raise exception 'Workflow note exceeds 2000 characters.' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'Workflow metadata must be a JSON object.' using errcode = 'P0001';
  end if;

  if pg_column_size(v_metadata) > 8192 then
    raise exception 'Workflow metadata exceeds 8KB limit.' using errcode = 'P0001';
  end if;

  if v_current_uid is not null and p_actor_user_id is not null and p_actor_user_id <> v_current_uid then
    raise exception 'Workflow actor mismatch for authenticated context.' using errcode = '42501';
  end if;

  if v_effective_actor_user_id is null then
    raise exception 'Workflow actor context is required.' using errcode = '42501';
  end if;

  select l.organization_id
  into v_listing_organization_id
  from public.listings l
  where l.id = p_listing_id
  limit 1;

  if v_listing_organization_id is null then
    raise exception 'Workflow events require a company-owned listing.' using errcode = 'P0001';
  end if;

  insert into public.listing_workflow_events (
    listing_id,
    organization_id,
    actor_user_id,
    event_type,
    from_status,
    to_status,
    note,
    metadata,
    created_at
  )
  values (
    p_listing_id,
    v_listing_organization_id,
    v_effective_actor_user_id,
    p_event_type,
    p_from_status,
    p_to_status,
    v_note,
    v_metadata,
    timezone('utc', now())
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

comment on function public.log_listing_workflow_event(uuid, public.listing_workflow_event_type, public.listing_status, public.listing_status, text, jsonb, uuid) is
  'Writes one persisted company listing workflow timeline event row.';

revoke all on function public.log_listing_workflow_event(uuid, public.listing_workflow_event_type, public.listing_status, public.listing_status, text, jsonb, uuid) from public;
grant execute on function public.log_listing_workflow_event(uuid, public.listing_workflow_event_type, public.listing_status, public.listing_status, text, jsonb, uuid)
  to authenticated, service_role;

create or replace function public.transition_company_listing_workflow(
  p_listing_id uuid,
  p_action text,
  p_note text default null
)
returns table (
  listing_id uuid,
  organization_id uuid,
  previous_status public.listing_status,
  next_status public.listing_status,
  event_type public.listing_workflow_event_type,
  published_at timestamptz,
  published_by_user_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_action text := lower(btrim(coalesce(p_action, '')));
  v_listing public.listings%rowtype;
  v_from_status public.listing_status;
  v_to_status public.listing_status;
  v_event_type public.listing_workflow_event_type;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_publish_at timestamptz;
  v_publish_actor_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required for listing workflow actions.' using errcode = '42501';
  end if;

  if p_listing_id is null then
    raise exception 'Listing reference is required.' using errcode = 'P0001';
  end if;

  if v_action = '' then
    raise exception 'Workflow action is required.' using errcode = 'P0001';
  end if;

  select *
  into v_listing
  from public.listings l
  where l.id = p_listing_id
  limit 1
  for update;

  if not found then
    raise exception 'Listing not found or unavailable.' using errcode = 'P0001';
  end if;

  if v_listing.organization_id is null then
    raise exception 'Workflow action requires a company-owned listing.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.organizations org
    where org.id = v_listing.organization_id
      and org.status = 'active'
  ) then
    raise exception 'Listing organization is inactive.' using errcode = 'P0001';
  end if;

  if public.is_admin() then
    v_actor_role := 'owner';
  else
    v_actor_role := public.organization_active_member_role(v_listing.organization_id, v_actor_id);
  end if;

  if v_actor_role is null then
    raise exception 'Active company membership is required for this listing action.' using errcode = '42501';
  end if;

  v_from_status := v_listing.listing_status;

  case v_action
    when 'submit_for_review' then
      if v_from_status not in ('draft', 'needs_changes') then
        raise exception 'Only draft or needs-changes listings can be submitted for review.' using errcode = 'P0001';
      end if;

      if not (
        v_actor_id = v_listing.created_by_user_id
        or v_actor_id = v_listing.assigned_agent_user_id
        or v_actor_role in ('owner', 'admin', 'manager')
      ) then
        raise exception 'Only listing creator or assigned agent can submit for review.' using errcode = '42501';
      end if;

      v_to_status := 'submitted_for_review';
      v_event_type := 'submitted_for_review';
      v_publish_at := null;
      v_publish_actor_id := v_listing.published_by_user_id;

    when 'needs_changes' then
      if v_from_status <> 'submitted_for_review' then
        raise exception 'Only submitted listings can be marked needs changes.' using errcode = 'P0001';
      end if;

      if v_actor_role not in ('owner', 'admin', 'manager') then
        raise exception 'Only owner, admin, or manager members can request changes.' using errcode = '42501';
      end if;

      if v_note is null then
        raise exception 'Review note is required when requesting changes.' using errcode = 'P0001';
      end if;

      v_to_status := 'needs_changes';
      v_event_type := 'needs_changes';
      v_publish_at := null;
      v_publish_actor_id := v_listing.published_by_user_id;

    when 'approve' then
      if v_from_status <> 'submitted_for_review' then
        raise exception 'Only submitted listings can be approved.' using errcode = 'P0001';
      end if;

      if v_actor_role not in ('owner', 'admin', 'manager') then
        raise exception 'Only owner, admin, or manager members can approve listings.' using errcode = '42501';
      end if;

      v_to_status := 'approved';
      v_event_type := 'approved';
      v_publish_at := null;
      v_publish_actor_id := v_listing.published_by_user_id;

    when 'publish' then
      if v_from_status not in ('approved', 'unpublished') then
        raise exception 'Only approved or unpublished listings can be published.' using errcode = 'P0001';
      end if;

      if v_actor_role not in ('owner', 'admin', 'manager') then
        raise exception 'Only owner, admin, or manager members can publish listings.' using errcode = '42501';
      end if;

      v_to_status := 'published';
      v_event_type := 'published';
      v_publish_at := timezone('utc', now());
      v_publish_actor_id := v_actor_id;

    when 'unpublish' then
      if v_from_status <> 'published' then
        raise exception 'Only published listings can be unpublished.' using errcode = 'P0001';
      end if;

      if v_actor_role not in ('owner', 'admin', 'manager') then
        raise exception 'Only owner, admin, or manager members can unpublish listings.' using errcode = '42501';
      end if;

      v_to_status := 'unpublished';
      v_event_type := 'unpublished';
      v_publish_at := null;
      v_publish_actor_id := v_listing.published_by_user_id;

    else
      raise exception 'Workflow action is invalid.' using errcode = 'P0001';
  end case;

  if v_to_status = v_from_status then
    listing_id := v_listing.id;
    organization_id := v_listing.organization_id;
    previous_status := v_from_status;
    next_status := v_to_status;
    event_type := v_event_type;
    published_at := v_listing.published_at;
    published_by_user_id := v_listing.published_by_user_id;
    return next;
    return;
  end if;

  update public.listings
  set
    listing_status = v_to_status,
    published_at = case when v_action = 'publish' then v_publish_at when v_action = 'unpublish' then null else public.listings.published_at end,
    published_by_user_id = case when v_action = 'publish' then v_publish_actor_id else public.listings.published_by_user_id end,
    archived_at = null,
    updated_at = timezone('utc', now())
  where id = v_listing.id;

  perform public.log_listing_workflow_event(
    p_listing_id => v_listing.id,
    p_event_type => v_event_type,
    p_from_status => v_from_status,
    p_to_status => v_to_status,
    p_note => v_note,
    p_metadata => jsonb_build_object(
      'action', v_action,
      'actor_role', v_actor_role
    ),
    p_actor_user_id => v_actor_id
  );

  listing_id := v_listing.id;
  organization_id := v_listing.organization_id;
  previous_status := v_from_status;
  next_status := v_to_status;
  event_type := v_event_type;
  published_at := case when v_action = 'publish' then v_publish_at when v_action = 'unpublish' then null else v_listing.published_at end;
  published_by_user_id := case when v_action = 'publish' then v_publish_actor_id else v_listing.published_by_user_id end;
  return next;
end;
$$;

comment on function public.transition_company_listing_workflow(uuid, text, text) is
  'Executes trusted status transitions for company listings with role and transition validation.';

revoke all on function public.transition_company_listing_workflow(uuid, text, text) from public;
grant execute on function public.transition_company_listing_workflow(uuid, text, text)
  to authenticated, service_role;

create or replace function public.enforce_company_listing_workflow_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_is_reviewer boolean := false;
begin
  if new.organization_id is null then
    return new;
  end if;

  if v_actor_id is null and auth.role() <> 'service_role' then
    raise exception 'Authenticated actor is required for company listing workflow updates.' using errcode = '42501';
  end if;

  if auth.role() = 'service_role' then
    return new;
  end if;

  if public.is_admin() then
    v_actor_role := 'owner';
  else
    v_actor_role := public.organization_active_member_role(new.organization_id, v_actor_id);
  end if;

  if v_actor_role is null then
    raise exception 'Active company membership is required for company listing workflow updates.' using errcode = '42501';
  end if;

  v_is_reviewer := v_actor_role in ('owner', 'admin', 'manager');

  if tg_op = 'INSERT' then
    if new.listing_status = 'draft' then
      return new;
    end if;

    raise exception 'Company listing status % is invalid for workflow.', new.listing_status using errcode = 'P0001';
  end if;

  if old.listing_status = new.listing_status then
    return new;
  end if;

  if new.listing_status = 'hidden_by_admin' or old.listing_status = 'hidden_by_admin' then
    if not public.is_admin() then
      raise exception 'Hidden-by-admin status is controlled only by moderation flows.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'draft' and new.listing_status = 'submitted_for_review' then
    if not (
      v_actor_id = old.created_by_user_id
      or v_actor_id = old.assigned_agent_user_id
      or v_is_reviewer
    ) then
      raise exception 'Only listing creator or assigned agent can submit for review.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'needs_changes' and new.listing_status = 'submitted_for_review' then
    if not (
      v_actor_id = old.created_by_user_id
      or v_actor_id = old.assigned_agent_user_id
      or v_is_reviewer
    ) then
      raise exception 'Only listing creator or assigned agent can resubmit for review.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'submitted_for_review' and new.listing_status in ('needs_changes', 'approved') then
    if not v_is_reviewer then
      raise exception 'Only owner, admin, or manager members can review submitted listings.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'approved' and new.listing_status = 'published' then
    if not v_is_reviewer then
      raise exception 'Only owner, admin, or manager members can publish approved listings.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'published' and new.listing_status = 'unpublished' then
    if not v_is_reviewer then
      raise exception 'Only owner, admin, or manager members can unpublish listings.' using errcode = '42501';
    end if;

    return new;
  end if;

  if old.listing_status = 'unpublished' and new.listing_status = 'published' then
    if not v_is_reviewer then
      raise exception 'Only owner, admin, or manager members can republish listings.' using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Invalid company listing workflow transition from % to %.', old.listing_status, new.listing_status using errcode = 'P0001';
end;
$$;

comment on function public.enforce_company_listing_workflow_transition() is
  'Prevents direct invalid status transitions on company-owned listings.';

drop trigger if exists enforce_company_listing_workflow_transition_trigger on public.listings;

create trigger enforce_company_listing_workflow_transition_trigger
before insert or update of listing_status
on public.listings
for each row
execute function public.enforce_company_listing_workflow_transition();

commit;
