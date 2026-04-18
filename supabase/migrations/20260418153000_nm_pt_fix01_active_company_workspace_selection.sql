begin;

alter table public.profiles
  add column if not exists active_organization_id uuid references public.organizations (id) on delete set null;

create index if not exists profiles_active_organization_idx
  on public.profiles (active_organization_id);

comment on column public.profiles.active_organization_id is
  'Explicitly selected active company workspace for the profile. Null means no active workspace has been chosen.';

with single_active_membership as (
  select
    om.user_id,
    min(om.organization_id) as organization_id
  from public.organization_members om
  join public.organizations org
    on org.id = om.organization_id
  where om.member_status = 'active'
    and org.status = 'active'
  group by om.user_id
  having count(*) = 1
)
update public.profiles profile_row
set active_organization_id = single_active_membership.organization_id
from single_active_membership
where profile_row.id = single_active_membership.user_id
  and profile_row.active_organization_id is null;

update public.profiles profile_row
set active_organization_id = null
where profile_row.active_organization_id is not null
  and not exists (
    select 1
    from public.organization_members om
    join public.organizations org
      on org.id = om.organization_id
    where om.user_id = profile_row.id
      and om.organization_id = profile_row.active_organization_id
      and om.member_status = 'active'
      and org.status = 'active'
  );

create or replace function public.create_organization_workspace(
  p_name text,
  p_description text default null
)
returns table (
  organization_id uuid,
  organization_slug text,
  owner_member_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_role public.app_role;
  v_name text;
  v_description text;
  v_slug_base text;
  v_slug_candidate text;
  v_slug_suffix integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required to create a company workspace.' using errcode = '42501';
  end if;

  select p.role
  into v_profile_role
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_role is null then
    raise exception 'A profile record is required before creating a company workspace.' using errcode = 'P0001';
  end if;

  if v_profile_role not in ('seeker', 'provider') then
    raise exception 'This account role cannot create a company workspace from the current flow.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.user_id = v_user_id
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  ) then
    raise exception 'You already own a company workspace.' using errcode = 'P0001';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Company name must be between 2 and 120 characters.' using errcode = 'P0001';
  end if;

  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if v_description is not null and char_length(v_description) > 600 then
    raise exception 'Company description must be 600 characters or fewer.' using errcode = 'P0001';
  end if;

  v_slug_base := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');

  if char_length(v_slug_base) = 0 then
    v_slug_base := 'company';
  end if;

  v_slug_base := left(v_slug_base, 48);
  v_slug_candidate := v_slug_base;

  loop
    begin
      insert into public.organizations (
        name,
        slug,
        description,
        created_by_user_id,
        status
      )
      values (
        v_name,
        v_slug_candidate,
        v_description,
        v_user_id,
        'active'
      )
      returning id, slug
      into organization_id, organization_slug;

      exit;
    exception
      when unique_violation then
        v_slug_suffix := v_slug_suffix + 1;

        if v_slug_suffix > 25 then
          raise exception 'Unable to generate a unique organization identifier. Please retry.' using errcode = 'P0001';
        end if;

        v_slug_candidate :=
          left(v_slug_base, greatest(1, 48 - char_length(v_slug_suffix::text) - 1))
          || '-'
          || v_slug_suffix::text;
    end;
  end loop;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    member_status,
    invited_by_user_id,
    joined_at
  )
  values (
    organization_id,
    v_user_id,
    'owner',
    'active',
    null,
    now()
  )
  returning id
  into owner_member_id;

  update public.profiles
  set
    role = 'provider',
    provider_account_type = 'company',
    active_organization_id = organization_id
  where id = v_user_id;

  return next;
end;
$$;

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

      update public.profiles
      set active_organization_id = v_invite.organization_id
      where id = v_actor_id;

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
  set
    provider_account_type = 'company',
    active_organization_id = v_invite.organization_id
  where id = v_actor_id
    and role = 'provider';

  invite_id := v_invite.id;
  organization_id := v_invite.organization_id;
  invite_status := 'accepted';
  acceptance_outcome := v_outcome;

  return next;
end;
$$;

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

  if p_new_status <> 'active' then
    update public.profiles
    set active_organization_id = null
    where id = v_target.user_id
      and active_organization_id = v_target.organization_id;
  end if;

  membership_id := v_target.id;
  organization_id := v_target.organization_id;
  user_id := v_target.user_id;
  previous_status := v_target.member_status;
  new_status := p_new_status;
  role := v_target.role;
  return next;
end;
$$;

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

  update public.profiles
  set active_organization_id = null
  where id = v_target.user_id
    and active_organization_id = v_target.organization_id;

  membership_id := v_target.id;
  organization_id := v_target.organization_id;
  user_id := v_target.user_id;
  removed_role := v_target.role;
  removed_status := v_target.member_status;
  return next;
end;
$$;

commit;
