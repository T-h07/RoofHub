begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_invite_status'
  ) then
    create type public.organization_invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
  end if;
end
$$;

create table if not exists public.organization_member_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  invited_by_user_id uuid references public.profiles (id) on delete set null,
  invite_email text,
  target_user_id uuid references public.profiles (id) on delete set null,
  invite_token uuid not null default gen_random_uuid(),
  role public.organization_member_role not null default 'agent',
  invite_status public.organization_invite_status not null default 'pending',
  expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days'),
  accepted_at timestamptz,
  accepted_by_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.organization_member_invites
  drop constraint if exists organization_member_invites_target_required,
  drop constraint if exists organization_member_invites_email_not_blank,
  drop constraint if exists organization_member_invites_email_format,
  drop constraint if exists organization_member_invites_acceptance_state,
  drop constraint if exists organization_member_invites_expires_order;

alter table public.organization_member_invites
  add constraint organization_member_invites_target_required check (
    target_user_id is not null
    or invite_email is not null
  ),
  add constraint organization_member_invites_email_not_blank check (
    invite_email is null
    or char_length(btrim(invite_email)) > 0
  ),
  add constraint organization_member_invites_email_format check (
    invite_email is null
    or (
      char_length(invite_email) <= 254
      and invite_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
    )
  ),
  add constraint organization_member_invites_acceptance_state check (
    (
      invite_status = 'accepted'
      and accepted_at is not null
      and accepted_by_user_id is not null
    )
    or (
      invite_status <> 'accepted'
      and accepted_at is null
      and accepted_by_user_id is null
    )
  ),
  add constraint organization_member_invites_expires_order check (expires_at > created_at);

create unique index if not exists organization_member_invites_invite_token_uidx
  on public.organization_member_invites (invite_token);

create index if not exists organization_member_invites_org_status_idx
  on public.organization_member_invites (organization_id, invite_status, created_at desc);

create index if not exists organization_member_invites_target_status_idx
  on public.organization_member_invites (target_user_id, invite_status, created_at desc)
  where target_user_id is not null;

create index if not exists organization_member_invites_email_status_idx
  on public.organization_member_invites (lower(invite_email), invite_status, created_at desc)
  where invite_email is not null;

create unique index if not exists organization_member_invites_pending_user_unique_idx
  on public.organization_member_invites (organization_id, target_user_id)
  where invite_status = 'pending'
    and target_user_id is not null;

create unique index if not exists organization_member_invites_pending_email_unique_idx
  on public.organization_member_invites (organization_id, lower(invite_email))
  where invite_status = 'pending'
    and target_user_id is null
    and invite_email is not null;

drop trigger if exists set_organization_member_invites_updated_at on public.organization_member_invites;
create trigger set_organization_member_invites_updated_at
before update on public.organization_member_invites
for each row
execute function public.set_updated_at();

alter table public.organization_member_invites enable row level security;

drop policy if exists organization_members_select_self_owner_or_admin on public.organization_members;

create policy organization_members_select_self_owner_or_admin
on public.organization_members
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.organization_members manager_membership
    where manager_membership.organization_id = organization_members.organization_id
      and manager_membership.user_id = auth.uid()
      and manager_membership.role in ('owner', 'admin')
      and manager_membership.member_status = 'active'
  )
);

create or replace function public.current_user_primary_email()
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
begin
  if v_user_id is null then
    return null;
  end if;

  select lower(nullif(btrim(u.email), ''))
  into v_email
  from auth.users u
  where u.id = v_user_id
  limit 1;

  return v_email;
end;
$$;

create or replace function public.organization_active_member_role(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns public.organization_member_role
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.user_id = p_user_id
    and om.member_status = 'active'
  order by case om.role
    when 'owner' then 1
    when 'admin' then 2
    when 'manager' then 3
    else 4
  end
  limit 1;
$$;

create or replace function public.is_organization_owner_or_admin(
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
    or public.organization_active_member_role(p_organization_id, p_user_id) in ('owner', 'admin');
$$;

create or replace function public.organization_active_owner_count(
  p_organization_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.organization_members om
  where om.organization_id = p_organization_id
    and om.member_status = 'active'
    and om.role = 'owner';
$$;

grant execute on function public.current_user_primary_email() to authenticated, service_role;
grant execute on function public.organization_active_member_role(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_organization_owner_or_admin(uuid, uuid) to authenticated, service_role;
grant execute on function public.organization_active_owner_count(uuid) to authenticated, service_role;

drop policy if exists organization_member_invites_select_relevant on public.organization_member_invites;
drop policy if exists organization_member_invites_insert_owner_or_admin on public.organization_member_invites;
drop policy if exists organization_member_invites_update_owner_or_admin on public.organization_member_invites;
drop policy if exists organization_member_invites_delete_owner_or_admin on public.organization_member_invites;

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
        and lower(coalesce(auth.jwt() ->> 'email', '')) = lower(organization_member_invites.invite_email)
      )
    )
  )
);

create policy organization_member_invites_insert_owner_or_admin
on public.organization_member_invites
for insert
to authenticated
with check (
  public.is_organization_owner_or_admin(organization_member_invites.organization_id)
  and organization_member_invites.invite_status = 'pending'
);

create policy organization_member_invites_update_owner_or_admin
on public.organization_member_invites
for update
to authenticated
using (public.is_organization_owner_or_admin(organization_member_invites.organization_id))
with check (public.is_organization_owner_or_admin(organization_member_invites.organization_id));

create policy organization_member_invites_delete_owner_or_admin
on public.organization_member_invites
for delete
to authenticated
using (public.is_organization_owner_or_admin(organization_member_invites.organization_id));

create or replace function public.create_organization_member_invite(
  p_organization_id uuid,
  p_role public.organization_member_role default 'agent',
  p_invite_email text default null,
  p_target_user_id uuid default null,
  p_expires_in_days integer default 14
)
returns table (
  invite_id uuid,
  invite_token uuid,
  organization_id uuid,
  target_user_id uuid,
  invite_email text,
  invite_role public.organization_member_role,
  invite_status public.organization_invite_status,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_invite_role public.organization_member_role := coalesce(p_role, 'agent');
  v_resolved_target_user_id uuid := p_target_user_id;
  v_normalized_email text := nullif(lower(btrim(coalesce(p_invite_email, ''))), '');
  v_expires_days integer := greatest(1, least(coalesce(p_expires_in_days, 14), 30));
  v_membership_status public.organization_member_status;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to invite team members.' using errcode = '42501';
  end if;

  if p_organization_id is null then
    raise exception 'Organization reference is required.' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.organizations org
    where org.id = p_organization_id
      and org.status = 'active'
  ) then
    raise exception 'Organization is unavailable for invites.' using errcode = 'P0001';
  end if;

  if not public.is_admin() then
    v_actor_role := public.organization_active_member_role(p_organization_id, v_actor_id);
    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only owner or admin members can invite staff.' using errcode = '42501';
    end if;

    if v_actor_role = 'admin' and v_invite_role in ('owner', 'admin') then
      raise exception 'Admin members cannot invite owner or admin roles.' using errcode = '42501';
    end if;
  end if;

  if v_invite_role = 'owner' and not public.is_admin() and v_actor_role <> 'owner' then
    raise exception 'Only owner members can invite owner role.' using errcode = '42501';
  end if;

  if v_normalized_email is not null and (
    char_length(v_normalized_email) > 254
    or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$'
  ) then
    raise exception 'Invite email is invalid.' using errcode = 'P0001';
  end if;

  if v_resolved_target_user_id is null and v_normalized_email is null then
    raise exception 'Invite target requires email or RoofHub user id.' using errcode = 'P0001';
  end if;

  if v_resolved_target_user_id is null and v_normalized_email is not null then
    select u.id
    into v_resolved_target_user_id
    from auth.users u
    where lower(u.email) = v_normalized_email
    limit 1;
  end if;

  if v_resolved_target_user_id is not null then
    if not exists (
      select 1
      from public.profiles p
      where p.id = v_resolved_target_user_id
    ) then
      raise exception 'RoofHub user id is invalid.' using errcode = 'P0001';
    end if;

    if v_normalized_email is null then
      select lower(nullif(btrim(u.email), ''))
      into v_normalized_email
      from auth.users u
      where u.id = v_resolved_target_user_id
      limit 1;
    end if;

    select om.member_status
    into v_membership_status
    from public.organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = v_resolved_target_user_id
    limit 1;

    if v_membership_status = 'active' then
      raise exception 'Target user is already an active company member.' using errcode = 'P0001';
    end if;
  end if;

  update public.organization_member_invites existing_invite
  set
    invite_status = 'expired',
    updated_at = timezone('utc', now())
  where existing_invite.organization_id = p_organization_id
    and existing_invite.invite_status = 'pending'
    and existing_invite.expires_at <= timezone('utc', now())
    and (
      (v_resolved_target_user_id is not null and existing_invite.target_user_id = v_resolved_target_user_id)
      or (
        v_resolved_target_user_id is null
        and existing_invite.target_user_id is null
        and existing_invite.invite_email is not distinct from v_normalized_email
      )
    );

  begin
    insert into public.organization_member_invites (
      organization_id,
      invited_by_user_id,
      invite_email,
      target_user_id,
      role,
      invite_status,
      expires_at
    )
    values (
      p_organization_id,
      v_actor_id,
      v_normalized_email,
      v_resolved_target_user_id,
      v_invite_role,
      'pending',
      timezone('utc', now()) + make_interval(days => v_expires_days)
    )
    returning
      id,
      invite_token,
      organization_id,
      target_user_id,
      invite_email,
      role,
      invite_status,
      expires_at
    into
      invite_id,
      invite_token,
      organization_id,
      target_user_id,
      invite_email,
      invite_role,
      invite_status,
      expires_at;
  exception
    when unique_violation then
      raise exception 'An active invite already exists for this user.' using errcode = 'P0001';
  end;

  return next;
end;
$$;

comment on function public.create_organization_member_invite(uuid, public.organization_member_role, text, uuid, integer) is
  'Creates one pending organization invite for email and/or target user with owner/admin permission checks.';

revoke all on function public.create_organization_member_invite(uuid, public.organization_member_role, text, uuid, integer) from public;
grant execute on function public.create_organization_member_invite(uuid, public.organization_member_role, text, uuid, integer)
  to authenticated, service_role;

create or replace function public.accept_organization_member_invite(
  p_invite_token uuid
)
returns table (
  invite_id uuid,
  organization_id uuid,
  member_id uuid,
  membership_role public.organization_member_role,
  invite_status public.organization_invite_status,
  acceptance_outcome text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_email text;
  v_invite public.organization_member_invites%rowtype;
  v_existing_member public.organization_members%rowtype;
  v_outcome text := 'joined';
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to accept an invite.' using errcode = '42501';
  end if;

  if p_invite_token is null then
    raise exception 'Invite token is required.' using errcode = 'P0001';
  end if;

  select *
  into v_invite
  from public.organization_member_invites invite_row
  where invite_row.invite_token = p_invite_token
  limit 1
  for update;

  if not found then
    raise exception 'Invite is invalid or unavailable.' using errcode = 'P0001';
  end if;

  if v_invite.invite_status = 'accepted' then
    if v_invite.accepted_by_user_id = v_actor_id then
      select om.*
      into v_existing_member
      from public.organization_members om
      where om.organization_id = v_invite.organization_id
        and om.user_id = v_actor_id
      limit 1;

      invite_id := v_invite.id;
      organization_id := v_invite.organization_id;
      member_id := v_existing_member.id;
      membership_role := v_existing_member.role;
      invite_status := v_invite.invite_status;
      acceptance_outcome := 'already_accepted';
      return next;
      return;
    end if;

    raise exception 'Invite has already been accepted.' using errcode = 'P0001';
  end if;

  if v_invite.invite_status = 'revoked' then
    raise exception 'Invite has been revoked.' using errcode = 'P0001';
  end if;

  if v_invite.invite_status = 'expired' then
    raise exception 'Invite has expired.' using errcode = 'P0001';
  end if;

  if v_invite.expires_at <= timezone('utc', now()) then
    update public.organization_member_invites
    set
      invite_status = 'expired',
      updated_at = timezone('utc', now())
    where id = v_invite.id;

    raise exception 'Invite has expired.' using errcode = 'P0001';
  end if;

  if v_invite.target_user_id is not null and v_invite.target_user_id <> v_actor_id then
    raise exception 'This invite was issued for a different RoofHub user account.' using errcode = '42501';
  end if;

  if v_invite.target_user_id is null then
    v_actor_email := public.current_user_primary_email();

    if v_invite.invite_email is null then
      raise exception 'Invite target is invalid.' using errcode = 'P0001';
    end if;

    if v_actor_email is null or lower(v_invite.invite_email) <> lower(v_actor_email) then
      raise exception 'This invite email does not match your signed-in account.' using errcode = '42501';
    end if;
  end if;

  select om.*
  into v_existing_member
  from public.organization_members om
  where om.organization_id = v_invite.organization_id
    and om.user_id = v_actor_id
  limit 1
  for update;

  if found then
    if v_existing_member.member_status = 'active' then
      v_outcome := 'already_active_member';
    else
      update public.organization_members
      set
        role = v_invite.role,
        member_status = 'active',
        invited_by_user_id = coalesce(v_invite.invited_by_user_id, public.organization_members.invited_by_user_id),
        joined_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
      where id = v_existing_member.id
      returning *
      into v_existing_member;

      v_outcome := 'reactivated_member';
    end if;

    member_id := v_existing_member.id;
    membership_role := v_existing_member.role;
  else
    insert into public.organization_members (
      organization_id,
      user_id,
      role,
      member_status,
      invited_by_user_id,
      joined_at
    )
    values (
      v_invite.organization_id,
      v_actor_id,
      v_invite.role,
      'active',
      v_invite.invited_by_user_id,
      timezone('utc', now())
    )
    returning id, role
    into member_id, membership_role;

    v_outcome := 'joined';
  end if;

  update public.organization_member_invites
  set
    target_user_id = coalesce(v_invite.target_user_id, v_actor_id),
    invite_status = 'accepted',
    accepted_at = timezone('utc', now()),
    accepted_by_user_id = v_actor_id,
    updated_at = timezone('utc', now())
  where id = v_invite.id;

  update public.profiles
  set provider_account_type = 'company'
  where id = v_actor_id
    and role = 'provider'
    and provider_account_type <> 'company';

  invite_id := v_invite.id;
  organization_id := v_invite.organization_id;
  invite_status := 'accepted';
  acceptance_outcome := v_outcome;

  return next;
end;
$$;

comment on function public.accept_organization_member_invite(uuid) is
  'Accepts one pending organization invite for auth.uid() and activates membership safely.';

revoke all on function public.accept_organization_member_invite(uuid) from public;
grant execute on function public.accept_organization_member_invite(uuid)
  to authenticated, service_role;

create or replace function public.revoke_organization_member_invite(
  p_invite_id uuid
)
returns table (
  invite_id uuid,
  organization_id uuid,
  invite_role public.organization_member_role,
  invite_status public.organization_invite_status
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_invite public.organization_member_invites%rowtype;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to revoke invites.' using errcode = '42501';
  end if;

  if p_invite_id is null then
    raise exception 'Invite reference is required.' using errcode = 'P0001';
  end if;

  select *
  into v_invite
  from public.organization_member_invites invite_row
  where invite_row.id = p_invite_id
  limit 1
  for update;

  if not found then
    raise exception 'Invite is invalid or unavailable.' using errcode = 'P0001';
  end if;

  if not public.is_admin() then
    v_actor_role := public.organization_active_member_role(v_invite.organization_id, v_actor_id);

    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only owner or admin members can revoke invites.' using errcode = '42501';
    end if;

    if v_actor_role = 'admin' and v_invite.role in ('owner', 'admin') then
      raise exception 'Admin members cannot revoke owner or admin invites.' using errcode = '42501';
    end if;
  end if;

  if v_invite.invite_status <> 'pending' then
    raise exception 'Only pending invites can be revoked.' using errcode = 'P0001';
  end if;

  update public.organization_member_invites
  set
    invite_status = 'revoked',
    updated_at = timezone('utc', now())
  where id = v_invite.id;

  invite_id := v_invite.id;
  organization_id := v_invite.organization_id;
  invite_role := v_invite.role;
  invite_status := 'revoked';

  return next;
end;
$$;

comment on function public.revoke_organization_member_invite(uuid) is
  'Revokes one pending organization invite with owner/admin permission checks.';

revoke all on function public.revoke_organization_member_invite(uuid) from public;
grant execute on function public.revoke_organization_member_invite(uuid)
  to authenticated, service_role;

create or replace function public.update_organization_member_role(
  p_membership_id uuid,
  p_new_role public.organization_member_role
)
returns table (
  membership_id uuid,
  organization_id uuid,
  user_id uuid,
  previous_role public.organization_member_role,
  new_role public.organization_member_role
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_target public.organization_members%rowtype;
  v_active_owner_count integer;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to update member roles.' using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'Membership reference is required.' using errcode = 'P0001';
  end if;

  select *
  into v_target
  from public.organization_members om
  where om.id = p_membership_id
  limit 1
  for update;

  if not found then
    raise exception 'Member record is unavailable.' using errcode = 'P0001';
  end if;

  if p_new_role is null then
    raise exception 'New role is required.' using errcode = 'P0001';
  end if;

  if not public.is_admin() then
    v_actor_role := public.organization_active_member_role(v_target.organization_id, v_actor_id);

    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only owner or admin members can change roles.' using errcode = '42501';
    end if;

    if v_actor_role = 'admin' then
      if v_target.role in ('owner', 'admin') then
        raise exception 'Admin members cannot modify owner or admin roles.' using errcode = '42501';
      end if;

      if p_new_role in ('owner', 'admin') then
        raise exception 'Admin members cannot assign owner or admin roles.' using errcode = '42501';
      end if;
    end if;
  end if;

  if v_target.role = p_new_role then
    membership_id := v_target.id;
    organization_id := v_target.organization_id;
    user_id := v_target.user_id;
    previous_role := v_target.role;
    new_role := v_target.role;
    return next;
    return;
  end if;

  if v_target.role = 'owner' and p_new_role <> 'owner' and v_target.member_status = 'active' then
    v_active_owner_count := public.organization_active_owner_count(v_target.organization_id);

    if v_active_owner_count <= 1 then
      raise exception 'At least one active owner must remain in the organization.' using errcode = 'P0001';
    end if;
  end if;

  update public.organization_members
  set
    role = p_new_role,
    updated_at = timezone('utc', now())
  where id = v_target.id;

  membership_id := v_target.id;
  organization_id := v_target.organization_id;
  user_id := v_target.user_id;
  previous_role := v_target.role;
  new_role := p_new_role;
  return next;
end;
$$;

comment on function public.update_organization_member_role(uuid, public.organization_member_role) is
  'Updates one organization member role with owner/admin permission and last-owner protections.';

revoke all on function public.update_organization_member_role(uuid, public.organization_member_role) from public;
grant execute on function public.update_organization_member_role(uuid, public.organization_member_role)
  to authenticated, service_role;

create or replace function public.update_organization_member_status(
  p_membership_id uuid,
  p_new_status public.organization_member_status
)
returns table (
  membership_id uuid,
  organization_id uuid,
  user_id uuid,
  previous_status public.organization_member_status,
  new_status public.organization_member_status,
  role public.organization_member_role
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_target public.organization_members%rowtype;
  v_active_owner_count integer;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to update member status.' using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'Membership reference is required.' using errcode = 'P0001';
  end if;

  if p_new_status not in ('active', 'inactive') then
    raise exception 'Member status can only be active or inactive.' using errcode = 'P0001';
  end if;

  select *
  into v_target
  from public.organization_members om
  where om.id = p_membership_id
  limit 1
  for update;

  if not found then
    raise exception 'Member record is unavailable.' using errcode = 'P0001';
  end if;

  if not public.is_admin() then
    v_actor_role := public.organization_active_member_role(v_target.organization_id, v_actor_id);

    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only owner or admin members can update member status.' using errcode = '42501';
    end if;

    if v_actor_role = 'admin' and v_target.role in ('owner', 'admin') then
      raise exception 'Admin members cannot suspend owner or admin members.' using errcode = '42501';
    end if;
  end if;

  if v_target.member_status = p_new_status then
    membership_id := v_target.id;
    organization_id := v_target.organization_id;
    user_id := v_target.user_id;
    previous_status := v_target.member_status;
    new_status := v_target.member_status;
    role := v_target.role;
    return next;
    return;
  end if;

  if v_target.role = 'owner' and p_new_status <> 'active' and v_target.member_status = 'active' then
    v_active_owner_count := public.organization_active_owner_count(v_target.organization_id);

    if v_active_owner_count <= 1 then
      raise exception 'At least one active owner must remain in the organization.' using errcode = 'P0001';
    end if;
  end if;

  update public.organization_members
  set
    member_status = p_new_status,
    updated_at = timezone('utc', now())
  where id = v_target.id;

  membership_id := v_target.id;
  organization_id := v_target.organization_id;
  user_id := v_target.user_id;
  previous_status := v_target.member_status;
  new_status := p_new_status;
  role := v_target.role;
  return next;
end;
$$;

comment on function public.update_organization_member_status(uuid, public.organization_member_status) is
  'Updates one organization member status (active/inactive) with owner/admin permission and owner protection.';

revoke all on function public.update_organization_member_status(uuid, public.organization_member_status) from public;
grant execute on function public.update_organization_member_status(uuid, public.organization_member_status)
  to authenticated, service_role;

create or replace function public.remove_organization_member(
  p_membership_id uuid
)
returns table (
  membership_id uuid,
  organization_id uuid,
  user_id uuid,
  removed_role public.organization_member_role,
  removed_status public.organization_member_status
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
  v_target public.organization_members%rowtype;
  v_active_owner_count integer;
begin
  if v_actor_id is null then
    raise exception 'Authentication is required to remove members.' using errcode = '42501';
  end if;

  if p_membership_id is null then
    raise exception 'Membership reference is required.' using errcode = 'P0001';
  end if;

  select *
  into v_target
  from public.organization_members om
  where om.id = p_membership_id
  limit 1
  for update;

  if not found then
    raise exception 'Member record is unavailable.' using errcode = 'P0001';
  end if;

  if not public.is_admin() then
    v_actor_role := public.organization_active_member_role(v_target.organization_id, v_actor_id);

    if v_actor_role not in ('owner', 'admin') then
      raise exception 'Only owner or admin members can remove members.' using errcode = '42501';
    end if;

    if v_actor_role = 'admin' and v_target.role in ('owner', 'admin') then
      raise exception 'Admin members cannot remove owner or admin members.' using errcode = '42501';
    end if;
  end if;

  if v_target.role = 'owner' and v_target.member_status = 'active' then
    v_active_owner_count := public.organization_active_owner_count(v_target.organization_id);

    if v_active_owner_count <= 1 then
      raise exception 'At least one active owner must remain in the organization.' using errcode = 'P0001';
    end if;
  end if;

  delete from public.organization_members
  where id = v_target.id;

  membership_id := v_target.id;
  organization_id := v_target.organization_id;
  user_id := v_target.user_id;
  removed_role := v_target.role;
  removed_status := v_target.member_status;
  return next;
end;
$$;

comment on function public.remove_organization_member(uuid) is
  'Removes one organization member with owner/admin permission and last-owner protections.';

revoke all on function public.remove_organization_member(uuid) from public;
grant execute on function public.remove_organization_member(uuid)
  to authenticated, service_role;

commit;
