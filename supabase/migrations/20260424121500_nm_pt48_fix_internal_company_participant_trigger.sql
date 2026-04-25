begin;

create or replace function public.guard_internal_company_conversation_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.company_internal_conversations%rowtype;
  v_other_participant_count bigint;
  v_existing_participant_id uuid;
begin
  if tg_op = 'UPDATE' then
    v_existing_participant_id := old.id;
  else
    v_existing_participant_id := null;
  end if;

  select c.*
  into v_conversation
  from public.company_internal_conversations c
  where c.id = new.conversation_id
  limit 1;

  if not found then
    raise exception 'Internal company conversation not found.';
  end if;

  new.organization_id := v_conversation.organization_id;

  if not public.is_active_organization_member(v_conversation.organization_id, new.user_id) then
    raise exception 'Participant must be an active member of the owning organization.';
  end if;

  if new.added_by_user_id is not null
    and not public.is_active_organization_member(v_conversation.organization_id, new.added_by_user_id) then
    raise exception 'Participant inviter must be an active member of the owning organization.';
  end if;

  if v_conversation.kind = 'direct' then
    select count(*)
    into v_other_participant_count
    from public.company_internal_conversation_participants p
    where p.conversation_id = new.conversation_id
      and (
        v_existing_participant_id is null
        or p.id is distinct from v_existing_participant_id
      )
      and p.user_id <> new.user_id;

    if v_other_participant_count >= 2 then
      raise exception 'Direct internal conversations support exactly two participants.';
    end if;
  end if;

  return new;
end;
$$;

commit;
