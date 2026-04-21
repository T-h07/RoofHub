begin;

alter table public.notifications
  add column if not exists dismissed_at timestamptz,
  add column if not exists archived_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_retention_state;

alter table public.notifications
  add constraint notifications_retention_state check (
    not (dismissed_at is not null and archived_at is not null)
  );

create index if not exists notifications_user_active_priority_created_idx
  on public.notifications (user_id, priority desc, created_at desc)
  where dismissed_at is null
    and archived_at is null;

create index if not exists notifications_user_archived_created_idx
  on public.notifications (user_id, archived_at desc)
  where archived_at is not null;

create index if not exists notifications_user_dismissed_created_idx
  on public.notifications (user_id, dismissed_at desc)
  where dismissed_at is not null;

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  messages_mode text not null default 'all',
  listings_mode text not null default 'all',
  company_mode text not null default 'all',
  account_mode text not null default 'important_only',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint notification_preferences_messages_mode check (
    messages_mode in ('all', 'important_only', 'mute')
  ),
  constraint notification_preferences_listings_mode check (
    listings_mode in ('all', 'important_only', 'mute')
  ),
  constraint notification_preferences_company_mode check (
    company_mode in ('all', 'important_only', 'mute')
  ),
  constraint notification_preferences_account_mode check (
    account_mode in ('all', 'important_only', 'mute')
  )
);

drop trigger if exists set_notification_preferences_updated_at on public.notification_preferences;
create trigger set_notification_preferences_updated_at
before update on public.notification_preferences
for each row
execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
drop policy if exists notification_preferences_insert_own on public.notification_preferences;
drop policy if exists notification_preferences_update_own on public.notification_preferences;

create policy notification_preferences_select_own
on public.notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
);

create policy notification_preferences_insert_own
on public.notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
);

create policy notification_preferences_update_own
on public.notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

commit;
