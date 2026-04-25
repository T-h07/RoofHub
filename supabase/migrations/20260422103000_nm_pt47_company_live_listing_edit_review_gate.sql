begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'listing_edit_submission_status'
  ) then
    create type public.listing_edit_submission_status as enum (
      'draft',
      'pending_review',
      'needs_changes',
      'approved',
      'rejected'
    );
  end if;
end
$$;

alter type public.listing_workflow_event_type add value if not exists 'edit_submission_submitted';
alter type public.listing_workflow_event_type add value if not exists 'edit_submission_needs_changes';
alter type public.listing_workflow_event_type add value if not exists 'edit_submission_approved';
alter type public.listing_workflow_event_type add value if not exists 'edit_submission_rejected';

create table if not exists public.listing_edit_submissions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  submitted_by_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewer_user_id uuid references public.profiles (id) on delete set null,
  status public.listing_edit_submission_status not null default 'draft',
  proposed_patch jsonb not null default '{}'::jsonb,
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  applied_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint listing_edit_submissions_patch_object check (jsonb_typeof(proposed_patch) = 'object'),
  constraint listing_edit_submissions_patch_size check (pg_column_size(proposed_patch) <= 16384),
  constraint listing_edit_submissions_review_note_length check (review_note is null or char_length(review_note) <= 2000)
);

comment on table public.listing_edit_submissions is
  'Persisted proposed edit submissions for already-published company listings. Live listing data changes only after reviewer approval.';

create index if not exists listing_edit_submissions_listing_status_updated_idx
  on public.listing_edit_submissions (listing_id, status, updated_at desc);

create index if not exists listing_edit_submissions_organization_status_updated_idx
  on public.listing_edit_submissions (organization_id, status, updated_at desc);

create index if not exists listing_edit_submissions_submitted_by_updated_idx
  on public.listing_edit_submissions (submitted_by_user_id, updated_at desc);

create unique index if not exists listing_edit_submissions_single_active_per_listing_idx
  on public.listing_edit_submissions (listing_id)
  where status in ('draft', 'pending_review', 'needs_changes');

create or replace function public.enforce_listing_edit_submission_scope()
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
  limit 1;

  if v_listing_organization_id is null then
    raise exception 'Edit submissions require a company-owned listing.' using errcode = 'P0001';
  end if;

  if v_listing_organization_id <> new.organization_id then
    raise exception 'Edit submission organization must match listing organization.' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_listing_edit_submission_scope_trigger on public.listing_edit_submissions;
create trigger enforce_listing_edit_submission_scope_trigger
before insert or update of listing_id, organization_id
on public.listing_edit_submissions
for each row
execute function public.enforce_listing_edit_submission_scope();

drop trigger if exists set_listing_edit_submissions_updated_at on public.listing_edit_submissions;
create trigger set_listing_edit_submissions_updated_at
before update on public.listing_edit_submissions
for each row
execute function public.set_updated_at();

alter table public.listing_edit_submissions enable row level security;

drop policy if exists listing_edit_submissions_select_relevant on public.listing_edit_submissions;
create policy listing_edit_submissions_select_relevant
on public.listing_edit_submissions
for select
to authenticated
using (
  public.is_admin()
  or public.is_active_organization_member(organization_id)
);

commit;
