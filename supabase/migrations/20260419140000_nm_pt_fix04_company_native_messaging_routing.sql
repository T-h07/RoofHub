begin;

do $$
begin
  create type public.conversation_owner_mode as enum ('individual_provider', 'company_workspace');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.conversation_routing_status as enum ('direct_provider', 'shared_queue', 'assigned_member');
exception
  when duplicate_object then null;
end
$$;

alter table public.conversations
  add column if not exists owner_mode public.conversation_owner_mode,
  add column if not exists organization_id uuid,
  add column if not exists assigned_member_user_id uuid,
  add column if not exists routing_status public.conversation_routing_status,
  add column if not exists assigned_at timestamptz;

alter table public.conversations
  drop constraint if exists conversations_organization_id_fkey,
  drop constraint if exists conversations_assigned_member_user_id_fkey;

alter table public.conversations
  add constraint conversations_organization_id_fkey
    foreign key (organization_id) references public.organizations (id) on delete set null,
  add constraint conversations_assigned_member_user_id_fkey
    foreign key (assigned_member_user_id) references public.profiles (id) on delete set null;

with listing_context as (
  select
    c.id,
    l.organization_id,
    case
      when l.organization_id is null then null
      when l.assigned_agent_user_id is not null
        and exists (
          select 1
          from public.organization_members om
          where om.organization_id = l.organization_id
            and om.user_id = l.assigned_agent_user_id
            and om.member_status = 'active'
        ) then l.assigned_agent_user_id
      else null
    end as initial_assigned_member_user_id
  from public.conversations c
  join public.listings l
    on l.id = c.listing_id
   and l.owner_id = c.provider_id
)
update public.conversations c
set
  owner_mode = case
    when listing_context.organization_id is null then 'individual_provider'::public.conversation_owner_mode
    else 'company_workspace'::public.conversation_owner_mode
  end,
  organization_id = listing_context.organization_id,
  assigned_member_user_id = listing_context.initial_assigned_member_user_id,
  routing_status = case
    when listing_context.organization_id is null then 'direct_provider'::public.conversation_routing_status
    when listing_context.initial_assigned_member_user_id is null then 'shared_queue'::public.conversation_routing_status
    else 'assigned_member'::public.conversation_routing_status
  end,
  assigned_at = case
    when listing_context.initial_assigned_member_user_id is null then null
    else coalesce(c.assigned_at, c.created_at)
  end
from listing_context
where listing_context.id = c.id;

update public.conversations
set
  owner_mode = coalesce(owner_mode, 'individual_provider'::public.conversation_owner_mode),
  routing_status = coalesce(routing_status, 'direct_provider'::public.conversation_routing_status),
  assigned_member_user_id = case
    when coalesce(owner_mode, 'individual_provider'::public.conversation_owner_mode) = 'individual_provider'::public.conversation_owner_mode
      then null
    else assigned_member_user_id
  end,
  assigned_at = case
    when coalesce(owner_mode, 'individual_provider'::public.conversation_owner_mode) = 'individual_provider'::public.conversation_owner_mode
      then null
    when assigned_member_user_id is null then null
    else coalesce(assigned_at, created_at)
  end;

alter table public.conversations
  alter column owner_mode set default 'individual_provider'::public.conversation_owner_mode,
  alter column owner_mode set not null,
  alter column routing_status set default 'direct_provider'::public.conversation_routing_status,
  alter column routing_status set not null;

alter table public.conversations
  drop constraint if exists conversations_owner_routing_consistency;

alter table public.conversations
  add constraint conversations_owner_routing_consistency check (
    (
      owner_mode = 'individual_provider'
      and organization_id is null
      and assigned_member_user_id is null
      and assigned_at is null
      and routing_status = 'direct_provider'
    )
    or
    (
      owner_mode = 'company_workspace'
      and organization_id is not null
      and (
        (routing_status = 'shared_queue' and assigned_member_user_id is null and assigned_at is null)
        or (routing_status = 'assigned_member' and assigned_member_user_id is not null and assigned_at is not null)
      )
    )
  );

create index if not exists conversations_company_workspace_last_message_idx
  on public.conversations (organization_id, last_message_at desc)
  where owner_mode = 'company_workspace';

create index if not exists conversations_company_assignee_last_message_idx
  on public.conversations (assigned_member_user_id, last_message_at desc)
  where owner_mode = 'company_workspace';

create index if not exists conversations_company_routing_status_idx
  on public.conversations (organization_id, routing_status, last_message_at desc)
  where owner_mode = 'company_workspace';

create or replace function public.sync_conversation_routing_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_organization_id uuid;
begin
  select l.organization_id
  into v_listing_organization_id
  from public.listings l
  where l.id = new.listing_id
    and l.owner_id = new.provider_id
  limit 1;

  if not found then
    raise exception 'Conversation listing context is invalid.';
  end if;

  if v_listing_organization_id is null then
    new.owner_mode := 'individual_provider';
    new.organization_id := null;
    new.assigned_member_user_id := null;
    new.routing_status := 'direct_provider';
    new.assigned_at := null;
    return new;
  end if;

  new.owner_mode := 'company_workspace';
  new.organization_id := v_listing_organization_id;

  if new.assigned_member_user_id is null then
    new.routing_status := 'shared_queue';
    new.assigned_at := null;
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.organization_id = new.organization_id
      and om.user_id = new.assigned_member_user_id
      and om.member_status = 'active'
  ) then
    raise exception 'Conversation assignee must be an active member of the owning organization.';
  end if;

  new.routing_status := 'assigned_member';
  new.assigned_at := coalesce(new.assigned_at, now());

  return new;
end;
$$;

create or replace function public.guard_conversation_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role public.organization_member_role;
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.listing_id is distinct from old.listing_id
    or new.provider_id is distinct from old.provider_id
    or new.seeker_id is distinct from old.seeker_id
    or new.created_at is distinct from old.created_at
    or new.owner_mode is distinct from old.owner_mode
    or new.organization_id is distinct from old.organization_id then
    raise exception 'Conversation ownership context is immutable.';
  end if;

  if new.last_message_at < old.last_message_at then
    raise exception 'Conversation last_message_at cannot move backwards.';
  end if;

  if new.last_message_at is distinct from old.last_message_at and not exists (
    select 1
    from public.messages m
    where m.conversation_id = old.id
      and m.created_at = new.last_message_at
  ) then
    raise exception 'Conversation last_message_at must match an existing message timestamp.';
  end if;

  if new.assigned_member_user_id is distinct from old.assigned_member_user_id
    or new.routing_status is distinct from old.routing_status
    or new.assigned_at is distinct from old.assigned_at then
    if old.owner_mode <> 'company_workspace' then
      raise exception 'Only company conversations support assignment changes.';
    end if;

    if v_actor_id is null then
      raise exception 'Only authenticated organization managers can update conversation routing.';
    end if;

    if public.current_active_organization_id(v_actor_id) is distinct from old.organization_id then
      raise exception 'Conversation routing requires the matching active workspace.';
    end if;

    v_actor_role := public.organization_active_member_role(old.organization_id, v_actor_id);
    if v_actor_role not in ('owner', 'admin', 'manager') then
      raise exception 'Only owner, admin, or manager members can update conversation routing.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_conversation_routing_fields on public.conversations;
create trigger sync_conversation_routing_fields
before insert or update on public.conversations
for each row
execute function public.sync_conversation_routing_fields();

drop trigger if exists guard_conversation_participant_update on public.conversations;
create trigger guard_conversation_participant_update
before update on public.conversations
for each row
execute function public.guard_conversation_participant_update();

create or replace function public.can_access_active_company_conversation(
  p_conversation_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := coalesce(p_user_id, auth.uid());
  v_conversation public.conversations%rowtype;
  v_active_organization_id uuid;
  v_viewer_role public.organization_member_role;
begin
  if public.is_admin() then
    return true;
  end if;

  if p_conversation_id is null or v_actor_id is null then
    return false;
  end if;

  select c.*
  into v_conversation
  from public.conversations c
  where c.id = p_conversation_id
  limit 1;

  if not found
    or v_conversation.owner_mode <> 'company_workspace'
    or v_conversation.organization_id is null then
    return false;
  end if;

  v_active_organization_id := public.current_active_organization_id(v_actor_id);
  if v_active_organization_id is null or v_active_organization_id <> v_conversation.organization_id then
    return false;
  end if;

  v_viewer_role := public.organization_active_member_role(v_conversation.organization_id, v_actor_id);
  if v_viewer_role is null then
    return false;
  end if;

  if v_viewer_role in ('owner', 'admin', 'manager') then
    return true;
  end if;

  return v_conversation.assigned_member_user_id = v_actor_id;
end;
$$;

comment on function public.can_access_active_company_conversation(uuid, uuid) is
  'Returns true when the actor can access a company-owned conversation via the actor''s persisted active workspace and valid organization role.';

revoke all on function public.can_access_active_company_conversation(uuid, uuid) from public;
grant execute on function public.can_access_active_company_conversation(uuid, uuid)
  to authenticated, service_role;

revoke execute on function public.can_access_active_company_conversation_listing(uuid, uuid)
  from authenticated, service_role;

drop policy if exists conversations_select_participant_or_admin on public.conversations;
create policy conversations_select_participant_or_admin
on public.conversations
for select
to authenticated
using (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
  or public.can_access_active_company_conversation(conversations.id)
);

drop policy if exists conversations_update_participant_or_admin on public.conversations;
create policy conversations_update_participant_or_admin
on public.conversations
for update
to authenticated
using (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
  or public.can_access_active_company_conversation(conversations.id)
)
with check (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
  or public.can_access_active_company_conversation(conversations.id)
);

drop policy if exists messages_select_participant_or_admin on public.messages;
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
        or public.can_access_active_company_conversation(c.id)
      )
  )
);

drop policy if exists messages_insert_participant_sender_or_admin on public.messages;
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
          or public.can_access_active_company_conversation(c.id)
        )
    )
  )
);

drop policy if exists messages_update_participant_read_state_or_admin on public.messages;
create policy messages_update_participant_read_state_or_admin
on public.messages
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.provider_id = auth.uid()
        or c.seeker_id = auth.uid()
        or public.can_access_active_company_conversation(c.id)
      )
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.conversations c
    where c.id = messages.conversation_id
      and (
        c.provider_id = auth.uid()
        or c.seeker_id = auth.uid()
        or public.can_access_active_company_conversation(c.id)
      )
  )
);

drop policy if exists profiles_select_conversation_participant on public.profiles;
create policy profiles_select_conversation_participant
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where (
      c.provider_id = auth.uid()
      and c.seeker_id = profiles.id
    ) or (
      c.seeker_id = auth.uid()
      and c.provider_id = profiles.id
    )
  )
  or exists (
    select 1
    from public.conversations c
    where c.seeker_id = profiles.id
      and public.can_access_active_company_conversation(c.id)
  )
);

commit;
