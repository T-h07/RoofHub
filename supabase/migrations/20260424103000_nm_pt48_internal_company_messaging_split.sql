begin;

do $$
begin
  create type public.company_internal_conversation_kind as enum ('direct', 'group');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.company_internal_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.company_internal_conversation_kind not null default 'direct',
  title text,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_internal_conversations_title_rules check (
    (
      kind = 'direct'
      and (
        title is null
        or char_length(btrim(title)) = 0
      )
    )
    or (
      kind = 'group'
      and char_length(btrim(coalesce(title, ''))) between 2 and 120
    )
  )
);

create table if not exists public.company_internal_conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.company_internal_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  added_by_user_id uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_internal_conversation_participants_unique unique (conversation_id, user_id)
);

create table if not exists public.company_internal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.company_internal_conversations (id) on delete cascade,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint company_internal_messages_body_not_blank check (char_length(btrim(body)) > 0)
);

create index if not exists company_internal_conversations_org_last_message_idx
  on public.company_internal_conversations (organization_id, last_message_at desc);

create index if not exists company_internal_conversations_org_kind_last_message_idx
  on public.company_internal_conversations (organization_id, kind, last_message_at desc);

create index if not exists company_internal_conversation_participants_user_idx
  on public.company_internal_conversation_participants (user_id, conversation_id);

create index if not exists company_internal_conversation_participants_conversation_idx
  on public.company_internal_conversation_participants (conversation_id, joined_at);

create index if not exists company_internal_messages_conversation_created_at_idx
  on public.company_internal_messages (conversation_id, created_at);

create index if not exists company_internal_messages_conversation_sender_created_at_idx
  on public.company_internal_messages (conversation_id, sender_user_id, created_at desc);

create trigger set_company_internal_conversations_updated_at
before update on public.company_internal_conversations
for each row
execute function public.set_updated_at();

create trigger set_company_internal_conversation_participants_updated_at
before update on public.company_internal_conversation_participants
for each row
execute function public.set_updated_at();

create or replace function public.guard_internal_company_conversation_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation public.company_internal_conversations%rowtype;
  v_other_participant_count bigint;
begin
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
      and p.id is distinct from coalesce(old.id, new.id)
      and p.user_id <> new.user_id;

    if v_other_participant_count >= 2 then
      raise exception 'Direct internal conversations support exactly two participants.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.guard_internal_company_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.body := btrim(new.body);

  if char_length(new.body) = 0 then
    raise exception 'Message body cannot be blank.';
  end if;

  if not exists (
    select 1
    from public.company_internal_conversation_participants p
    where p.conversation_id = new.conversation_id
      and p.user_id = new.sender_user_id
  ) then
    raise exception 'Sender must be an active participant in this internal conversation.';
  end if;

  return new;
end;
$$;

create or replace function public.touch_internal_company_conversation_last_message_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.company_internal_conversations c
  set
    last_message_at = greatest(c.last_message_at, new.created_at),
    updated_at = now()
  where c.id = new.conversation_id;

  update public.company_internal_conversation_participants p
  set
    last_read_at = greatest(coalesce(p.last_read_at, to_timestamp(0)), new.created_at),
    updated_at = now()
  where p.conversation_id = new.conversation_id
    and p.user_id = new.sender_user_id;

  return new;
end;
$$;

drop trigger if exists guard_company_internal_conversation_participant on public.company_internal_conversation_participants;
create trigger guard_company_internal_conversation_participant
before insert or update on public.company_internal_conversation_participants
for each row
execute function public.guard_internal_company_conversation_participant();

drop trigger if exists guard_company_internal_message_insert on public.company_internal_messages;
create trigger guard_company_internal_message_insert
before insert on public.company_internal_messages
for each row
execute function public.guard_internal_company_message_insert();

drop trigger if exists touch_company_internal_conversation_last_message_at on public.company_internal_messages;
create trigger touch_company_internal_conversation_last_message_at
after insert on public.company_internal_messages
for each row
execute function public.touch_internal_company_conversation_last_message_at();

create or replace function public.can_access_active_internal_company_conversation(
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
  v_conversation public.company_internal_conversations%rowtype;
begin
  if public.is_admin() then
    return true;
  end if;

  if p_conversation_id is null or v_actor_id is null then
    return false;
  end if;

  select c.*
  into v_conversation
  from public.company_internal_conversations c
  where c.id = p_conversation_id
  limit 1;

  if not found then
    return false;
  end if;

  if public.current_active_organization_id(v_actor_id) is distinct from v_conversation.organization_id then
    return false;
  end if;

  if not public.is_active_organization_member(v_conversation.organization_id, v_actor_id) then
    return false;
  end if;

  return exists (
    select 1
    from public.company_internal_conversation_participants p
    where p.conversation_id = v_conversation.id
      and p.user_id = v_actor_id
  );
end;
$$;

comment on function public.can_access_active_internal_company_conversation(uuid, uuid) is
  'Returns true when the actor can access an internal company conversation via active workspace membership and participant scope.';

revoke all on function public.can_access_active_internal_company_conversation(uuid, uuid) from public;
grant execute on function public.can_access_active_internal_company_conversation(uuid, uuid)
  to authenticated, service_role;

alter table public.company_internal_conversations enable row level security;
alter table public.company_internal_conversation_participants enable row level security;
alter table public.company_internal_messages enable row level security;

drop policy if exists company_internal_conversations_select_participant on public.company_internal_conversations;
create policy company_internal_conversations_select_participant
on public.company_internal_conversations
for select
to authenticated
using (public.can_access_active_internal_company_conversation(id));

drop policy if exists company_internal_conversations_insert_member on public.company_internal_conversations;
create policy company_internal_conversations_insert_member
on public.company_internal_conversations
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and organization_id = public.current_active_organization_id(auth.uid())
  and public.is_active_organization_member(organization_id)
);

drop policy if exists company_internal_conversation_participants_select_participant on public.company_internal_conversation_participants;
create policy company_internal_conversation_participants_select_participant
on public.company_internal_conversation_participants
for select
to authenticated
using (public.can_access_active_internal_company_conversation(conversation_id));

drop policy if exists company_internal_messages_select_participant on public.company_internal_messages;
create policy company_internal_messages_select_participant
on public.company_internal_messages
for select
to authenticated
using (public.can_access_active_internal_company_conversation(conversation_id));

drop policy if exists company_internal_messages_insert_participant_sender on public.company_internal_messages;
create policy company_internal_messages_insert_participant_sender
on public.company_internal_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and public.can_access_active_internal_company_conversation(conversation_id)
);

commit;
