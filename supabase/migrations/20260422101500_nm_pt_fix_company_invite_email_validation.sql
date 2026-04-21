begin;

-- Fix invite email validation so valid addresses are accepted in server-trusted invite RPC paths.
alter table public.organization_member_invites
  drop constraint if exists organization_member_invites_email_format;

alter table public.organization_member_invites
  add constraint organization_member_invites_email_format check (
    invite_email is null
    or (
      char_length(invite_email) <= 254
      and invite_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    )
  );

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
    or v_normalized_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
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
      public.organization_member_invites.id,
      public.organization_member_invites.invite_token,
      public.organization_member_invites.organization_id,
      public.organization_member_invites.target_user_id,
      public.organization_member_invites.invite_email,
      public.organization_member_invites.role,
      public.organization_member_invites.invite_status,
      public.organization_member_invites.expires_at
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

comment on function public.create_organization_member_invite(
  uuid,
  public.organization_member_role,
  text,
  uuid,
  integer
) is 'Creates one pending organization invite for email and/or target user with owner/admin permission checks.';

commit;
