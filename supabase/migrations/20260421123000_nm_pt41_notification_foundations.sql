begin;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete set null,
  type text not null,
  title text not null,
  body text not null default '',
  entity_type text,
  entity_id text,
  action_url text,
  priority smallint not null default 2,
  is_read boolean not null default false,
  read_at timestamptz,
  actor_user_id uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notifications_type_not_blank check (
    char_length(btrim(type)) between 1 and 80
  ),
  constraint notifications_title_not_blank check (
    char_length(btrim(title)) between 1 and 160
  ),
  constraint notifications_body_length check (
    char_length(body) <= 2000
  ),
  constraint notifications_entity_type_length check (
    entity_type is null
    or char_length(btrim(entity_type)) between 1 and 80
  ),
  constraint notifications_action_url_relative check (
    action_url is null
    or (
      char_length(action_url) <= 512
      and action_url ~ '^/[^\s]*$'
    )
  ),
  constraint notifications_priority_range check (
    priority between 1 and 3
  ),
  constraint notifications_metadata_object check (
    jsonb_typeof(metadata) = 'object'
  ),
  constraint notifications_read_state check (
    (is_read = false and read_at is null)
    or (is_read = true and read_at is not null)
  )
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, is_read, created_at desc);

create index if not exists notifications_organization_created_idx
  on public.notifications (organization_id, created_at desc)
  where organization_id is not null;

drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at
before update on public.notifications
for each row
execute function public.set_updated_at();

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

commit;
