begin;

-- Only seekers can initiate listing conversations; provider is always listing owner.
drop policy if exists conversations_insert_participant_or_admin on public.conversations;
drop policy if exists conversations_insert_seeker_or_admin on public.conversations;

create policy conversations_insert_seeker_or_admin
on public.conversations
for insert
to authenticated
with check (
  public.is_admin()
  or (
    auth.uid() is not null
    and seeker_id = auth.uid()
    and provider_id <> auth.uid()
    and exists (
      select 1
      from public.profiles seeker_profile
      where seeker_profile.id = auth.uid()
        and seeker_profile.role = 'seeker'
    )
    and exists (
      select 1
      from public.listings l
      where l.id = conversations.listing_id
        and l.owner_id = conversations.provider_id
        and l.listing_status = 'published'
    )
  )
);

-- Participants can update only message read state; trigger below enforces immutable fields.
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
      )
  )
);

create or replace function public.touch_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations c
  set last_message_at = greatest(c.last_message_at, new.created_at)
  where c.id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation_last_message_at on public.messages;

create trigger messages_touch_conversation_last_message_at
after insert on public.messages
for each row
execute function public.touch_conversation_last_message_at();

create or replace function public.guard_conversation_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.listing_id is distinct from old.listing_id
    or new.provider_id is distinct from old.provider_id
    or new.seeker_id is distinct from old.seeker_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Conversation participants and listing context are immutable.';
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

  return new;
end;
$$;

drop trigger if exists guard_conversation_participant_update on public.conversations;

create trigger guard_conversation_participant_update
before update on public.conversations
for each row
execute function public.guard_conversation_participant_update();

create or replace function public.guard_message_participant_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.conversation_id is distinct from old.conversation_id
    or new.sender_id is distinct from old.sender_id
    or new.body is distinct from old.body
    or new.created_at is distinct from old.created_at then
    raise exception 'Only message read state can be updated by participants.';
  end if;

  if old.sender_id = auth.uid() then
    raise exception 'Senders cannot mark their own messages as read.';
  end if;

  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Message read state cannot be reset.';
  end if;

  if new.read_at is null then
    raise exception 'Message read state cannot be cleared.';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_message_participant_update on public.messages;

create trigger guard_message_participant_update
before update on public.messages
for each row
execute function public.guard_message_participant_update();

commit;
