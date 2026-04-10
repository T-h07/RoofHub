begin;

create table if not exists public.security_audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_role public.app_role,
  target_type text,
  target_id text,
  listing_id uuid references public.listings (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  report_id uuid references public.listing_reports (id) on delete set null,
  from_status public.listing_status,
  to_status public.listing_status,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint security_audit_events_event_type_length check (char_length(event_type) between 3 and 120),
  constraint security_audit_events_target_type_length check (
    target_type is null
    or char_length(target_type) between 2 and 80
  ),
  constraint security_audit_events_target_id_length check (
    target_id is null
    or char_length(target_id) between 1 and 140
  ),
  constraint security_audit_events_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint security_audit_events_metadata_size check (pg_column_size(metadata) <= 8192)
);

comment on table public.security_audit_events is
  'Security-relevant audit trail for auth, provider, moderation, reporting, and messaging-critical actions.';
comment on column public.security_audit_events.event_type is
  'Structured audit event identifier (auth.sign_in.failed, provider.listing_status.changed, etc.).';
comment on column public.security_audit_events.metadata is
  'Sanitized metadata payload. Must never include secrets, tokens, credentials, or raw message bodies.';

create index if not exists security_audit_events_created_at_idx
  on public.security_audit_events (created_at desc);

create index if not exists security_audit_events_event_type_created_at_idx
  on public.security_audit_events (event_type, created_at desc);

create index if not exists security_audit_events_actor_created_at_idx
  on public.security_audit_events (actor_user_id, created_at desc);

create index if not exists security_audit_events_listing_created_at_idx
  on public.security_audit_events (listing_id, created_at desc);

create index if not exists security_audit_events_conversation_created_at_idx
  on public.security_audit_events (conversation_id, created_at desc);

create index if not exists security_audit_events_report_created_at_idx
  on public.security_audit_events (report_id, created_at desc);

alter table public.security_audit_events enable row level security;

revoke all on table public.security_audit_events from anon, authenticated;

drop policy if exists security_audit_events_select_admin on public.security_audit_events;

create policy security_audit_events_select_admin
on public.security_audit_events
for select
to authenticated
using (public.is_admin());

create or replace function public.log_security_audit_event(
  p_event_type text,
  p_target_type text default null,
  p_target_id text default null,
  p_listing_id uuid default null,
  p_conversation_id uuid default null,
  p_report_id uuid default null,
  p_from_status public.listing_status default null,
  p_to_status public.listing_status default null,
  p_actor_role public.app_role default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_user_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  current_uid uuid := auth.uid();
  effective_actor_user_id uuid := coalesce(current_uid, p_actor_user_id);
  normalized_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  inserted_id uuid;
begin
  if p_event_type is null or char_length(btrim(p_event_type)) < 3 then
    raise exception 'p_event_type is required';
  end if;

  if p_target_type is not null and char_length(btrim(p_target_type)) < 2 then
    raise exception 'p_target_type must be null or length >= 2';
  end if;

  if p_target_id is not null and char_length(btrim(p_target_id)) < 1 then
    raise exception 'p_target_id must be null or non-empty';
  end if;

  if jsonb_typeof(normalized_metadata) <> 'object' then
    raise exception 'p_metadata must be a JSON object';
  end if;

  if pg_column_size(normalized_metadata) > 8192 then
    raise exception 'p_metadata exceeds 8KB limit';
  end if;

  if current_uid is not null and p_actor_user_id is not null and p_actor_user_id <> current_uid then
    raise exception 'p_actor_user_id must match auth.uid() when authenticated';
  end if;

  insert into public.security_audit_events (
    event_type,
    actor_user_id,
    actor_role,
    target_type,
    target_id,
    listing_id,
    conversation_id,
    report_id,
    from_status,
    to_status,
    metadata,
    created_at
  )
  values (
    lower(btrim(p_event_type)),
    effective_actor_user_id,
    p_actor_role,
    case when p_target_type is null then null else lower(btrim(p_target_type)) end,
    case when p_target_id is null then null else btrim(p_target_id) end,
    p_listing_id,
    p_conversation_id,
    p_report_id,
    p_from_status,
    p_to_status,
    normalized_metadata,
    now_utc
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

comment on function public.log_security_audit_event(
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
) is
  'Writes one sanitized security audit event row and returns the inserted id.';

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

grant execute on function public.log_security_audit_event(
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
) to anon, authenticated, service_role;

commit;
