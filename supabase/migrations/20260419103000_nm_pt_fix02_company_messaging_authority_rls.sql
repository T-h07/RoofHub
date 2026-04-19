begin;

create or replace function public.current_active_organization_id(
  p_user_id uuid default auth.uid()
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.active_organization_id
  from public.profiles p
  where p.id = coalesce(p_user_id, auth.uid())
  limit 1;
$$;

comment on function public.current_active_organization_id(uuid) is
  'Returns the persisted active RoofHub company workspace organization id for the target user.';

revoke all on function public.current_active_organization_id(uuid) from public;
grant execute on function public.current_active_organization_id(uuid)
  to authenticated, service_role;

create or replace function public.can_access_active_company_conversation_listing(
  p_listing_id uuid,
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
  v_listing public.listings%rowtype;
  v_active_organization_id uuid;
  v_viewer_role public.organization_member_role;
begin
  if public.is_admin() then
    return true;
  end if;

  if p_listing_id is null or v_actor_id is null then
    return false;
  end if;

  select l.*
  into v_listing
  from public.listings l
  where l.id = p_listing_id
  limit 1;

  if not found or v_listing.organization_id is null then
    return false;
  end if;

  v_active_organization_id := public.current_active_organization_id(v_actor_id);
  if v_active_organization_id is null or v_active_organization_id <> v_listing.organization_id then
    return false;
  end if;

  v_viewer_role := public.organization_active_member_role(v_listing.organization_id, v_actor_id);
  if v_viewer_role is null then
    return false;
  end if;

  if v_viewer_role in ('owner', 'admin', 'manager') then
    return true;
  end if;

  return v_listing.assigned_agent_user_id = v_actor_id;
end;
$$;

comment on function public.can_access_active_company_conversation_listing(uuid, uuid) is
  'Returns true when the actor can access a company conversation via the actor''s persisted active workspace and valid organization role.';

revoke all on function public.can_access_active_company_conversation_listing(uuid, uuid) from public;
grant execute on function public.can_access_active_company_conversation_listing(uuid, uuid)
  to authenticated, service_role;

drop policy if exists conversations_select_participant_or_admin on public.conversations;
create policy conversations_select_participant_or_admin
on public.conversations
for select
to authenticated
using (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
  or public.can_access_active_company_conversation_listing(conversations.listing_id)
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
  or public.can_access_active_company_conversation_listing(conversations.listing_id)
)
with check (
  provider_id = auth.uid()
  or seeker_id = auth.uid()
  or public.is_admin()
  or public.can_access_active_company_conversation_listing(conversations.listing_id)
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
        or public.can_access_active_company_conversation_listing(c.listing_id)
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
          or public.can_access_active_company_conversation_listing(c.listing_id)
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
        or public.can_access_active_company_conversation_listing(c.listing_id)
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
        or public.can_access_active_company_conversation_listing(c.listing_id)
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
      and public.can_access_active_company_conversation_listing(c.listing_id)
  )
);

commit;
