begin;

create table if not exists public.rate_limit_counters (
  bucket text not null,
  actor_key text not null,
  hit_count integer not null default 0,
  window_started_at timestamptz not null,
  window_ends_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rate_limit_counters_bucket_length check (char_length(bucket) between 1 and 120),
  constraint rate_limit_counters_actor_key_length check (char_length(actor_key) between 16 and 128),
  constraint rate_limit_counters_hit_count_non_negative check (hit_count >= 0),
  constraint rate_limit_counters_window_order check (window_ends_at > window_started_at),
  constraint rate_limit_counters_pkey primary key (bucket, actor_key)
);

comment on table public.rate_limit_counters is
  'Server-side rate-limit counters keyed by traffic bucket + actor fingerprint hash.';
comment on column public.rate_limit_counters.bucket is
  'Logical action bucket (auth.sign_in, messaging.send_message, etc.).';
comment on column public.rate_limit_counters.actor_key is
  'Hashed actor fingerprint derived from request identity parts (user, email, ip, scope).';

create index if not exists rate_limit_counters_window_ends_idx
  on public.rate_limit_counters (window_ends_at);

alter table public.rate_limit_counters enable row level security;

revoke all on table public.rate_limit_counters from anon, authenticated;

create or replace function public.consume_rate_limit_token(
  bucket_name text,
  actor_key_input text,
  window_seconds integer,
  max_attempts integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  now_utc timestamptz := timezone('utc', now());
  counter_row public.rate_limit_counters%rowtype;
  next_window_end timestamptz;
  next_hit_count integer;
begin
  if bucket_name is null or btrim(bucket_name) = '' then
    raise exception 'bucket_name is required';
  end if;

  if actor_key_input is null or btrim(actor_key_input) = '' then
    raise exception 'actor_key_input is required';
  end if;

  if window_seconds is null or window_seconds < 1 or window_seconds > 86400 then
    raise exception 'window_seconds must be between 1 and 86400';
  end if;

  if max_attempts is null or max_attempts < 1 or max_attempts > 5000 then
    raise exception 'max_attempts must be between 1 and 5000';
  end if;

  select *
  into counter_row
  from public.rate_limit_counters
  where bucket = bucket_name
    and actor_key = actor_key_input
  for update;

  if not found then
    next_window_end := now_utc + make_interval(secs => window_seconds);

    insert into public.rate_limit_counters (
      bucket,
      actor_key,
      hit_count,
      window_started_at,
      window_ends_at,
      updated_at
    )
    values (
      bucket_name,
      actor_key_input,
      1,
      now_utc,
      next_window_end,
      now_utc
    );

    allowed := true;
    remaining := greatest(max_attempts - 1, 0);
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  if counter_row.window_ends_at <= now_utc then
    next_window_end := now_utc + make_interval(secs => window_seconds);

    update public.rate_limit_counters
    set
      hit_count = 1,
      window_started_at = now_utc,
      window_ends_at = next_window_end,
      updated_at = now_utc
    where bucket = bucket_name
      and actor_key = actor_key_input;

    allowed := true;
    remaining := greatest(max_attempts - 1, 0);
    retry_after_seconds := 0;
    return next;
    return;
  end if;

  if counter_row.hit_count >= max_attempts then
    allowed := false;
    remaining := 0;
    retry_after_seconds :=
      greatest(1, ceil(extract(epoch from counter_row.window_ends_at - now_utc))::integer);
    return next;
    return;
  end if;

  next_hit_count := counter_row.hit_count + 1;

  update public.rate_limit_counters
  set
    hit_count = next_hit_count,
    updated_at = now_utc
  where bucket = bucket_name
    and actor_key = actor_key_input;

  allowed := true;
  remaining := greatest(max_attempts - next_hit_count, 0);
  retry_after_seconds := 0;
  return next;
end;
$$;

comment on function public.consume_rate_limit_token(text, text, integer, integer) is
  'Consumes one rate-limit token for a bucket + actor key and returns allow/remaining/retry-after state.';

revoke all on function public.consume_rate_limit_token(text, text, integer, integer) from public;
grant execute on function public.consume_rate_limit_token(text, text, integer, integer)
  to anon, authenticated;

commit;
