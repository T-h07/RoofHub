begin;

create or replace function public.prevent_last_active_owner_loss()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.organization_members%rowtype;
  v_remaining_owner_count integer;
begin
  v_membership := old;

  if tg_op = 'DELETE'
    and not exists (
      select 1
      from public.organizations org
      where org.id = v_membership.organization_id
    ) then
    return old;
  end if;

  if v_membership.role <> 'owner' or v_membership.member_status <> 'active' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'UPDATE'
    and new.role = 'owner'
    and new.member_status = 'active'
    and new.organization_id = old.organization_id then
    return new;
  end if;

  select count(*)::integer
  into v_remaining_owner_count
  from public.organization_members remaining_owner
  where remaining_owner.organization_id = v_membership.organization_id
    and remaining_owner.role = 'owner'
    and remaining_owner.member_status = 'active'
    and remaining_owner.id <> v_membership.id;

  if coalesce(v_remaining_owner_count, 0) < 1 then
    raise exception 'At least one active owner must remain in the organization.' using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

comment on function public.prevent_last_active_owner_loss() is
  'Blocks update/delete paths that would remove the last active owner from an organization, while allowing owner row removal during organization cascade deletion.';

commit;
