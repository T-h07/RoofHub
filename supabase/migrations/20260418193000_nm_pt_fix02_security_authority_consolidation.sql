begin;

-- PT-FIX02: keep the rate limiter as a server-only primitive.
revoke all on function public.consume_rate_limit_token(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit_token(text, text, integer, integer)
  to service_role;

-- PT-FIX02: audit writes now go through the trusted server helper, not a broadly callable RPC.
revoke all on function public.log_security_audit_event(
  text,
  text,
  text,
  uuid,
  uuid,
  uuid,
  public.listing_status,
  public.listing_status,
  public.app_role,
  jsonb,
  uuid
) from public;

-- PT-FIX02: company bootstrap and membership mutations no longer expose alternate authenticated RPC APIs.
revoke all on function public.create_organization_workspace(text, text) from public;
revoke all on function public.create_organization_member_invite(uuid, public.organization_member_role, text, uuid, integer) from public;
revoke all on function public.accept_organization_member_invite(uuid) from public;
revoke all on function public.revoke_organization_member_invite(uuid) from public;
revoke all on function public.update_organization_member_role(uuid, public.organization_member_role) from public;
revoke all on function public.update_organization_member_status(uuid, public.organization_member_status) from public;
revoke all on function public.remove_organization_member(uuid) from public;

-- PT-FIX02: company internal read-model RPCs remain available only to server-only service-role callers.
revoke all on function public.get_company_dashboard_overview(uuid, uuid) from public;
grant execute on function public.get_company_dashboard_overview(uuid, uuid)
  to service_role;

revoke all on function public.get_company_dashboard_pending_queue(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_pending_queue(uuid, uuid, integer)
  to service_role;

revoke all on function public.get_company_dashboard_activity_feed(uuid, uuid, integer) from public;
grant execute on function public.get_company_dashboard_activity_feed(uuid, uuid, integer)
  to service_role;

revoke all on function public.get_company_listing_workflow_listing(uuid, uuid) from public;
grant execute on function public.get_company_listing_workflow_listing(uuid, uuid)
  to service_role;

-- PT-FIX02: workflow mutations/events now run through trusted server actions.
revoke all on function public.transition_company_listing_workflow(uuid, text, text) from public;
revoke all on function public.log_listing_workflow_event(uuid, public.listing_workflow_event_type, public.listing_status, public.listing_status, text, jsonb, uuid) from public;

-- PT-FIX02: enforce owner continuity at the table layer so service-role paths cannot bypass it.
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
  'Blocks update/delete paths that would remove the last active owner from an organization, including service-role initiated mutations.';

drop trigger if exists organization_members_prevent_last_active_owner_loss on public.organization_members;

create trigger organization_members_prevent_last_active_owner_loss
before update of role, member_status, organization_id or delete
on public.organization_members
for each row
execute function public.prevent_last_active_owner_loss();

commit;
