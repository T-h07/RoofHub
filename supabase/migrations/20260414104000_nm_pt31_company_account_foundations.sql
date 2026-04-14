begin;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'provider_account_type'
  ) then
    create type public.provider_account_type as enum ('individual', 'company');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_status'
  ) then
    create type public.organization_status as enum ('active', 'inactive');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_member_role'
  ) then
    create type public.organization_member_role as enum ('owner', 'admin', 'manager', 'agent');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'organization_member_status'
  ) then
    create type public.organization_member_status as enum ('active', 'invited', 'inactive');
  end if;
end
$$;

alter table public.profiles
  add column if not exists provider_account_type public.provider_account_type not null
  default 'individual';

alter table public.profiles
  drop constraint if exists profiles_provider_account_type_consistency;

alter table public.profiles
  add constraint profiles_provider_account_type_consistency check (
    role = 'provider'
    or provider_account_type = 'individual'
  );

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  logo_path text,
  created_by_user_id uuid not null references public.profiles (id) on delete cascade,
  status public.organization_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (
    char_length(btrim(name)) between 2 and 120
  ),
  constraint organizations_slug_not_blank check (
    char_length(btrim(slug)) between 2 and 80
  ),
  constraint organizations_slug_format check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint organizations_description_length check (
    description is null
    or char_length(description) <= 600
  ),
  constraint organizations_logo_path_not_blank check (
    logo_path is null
    or char_length(btrim(logo_path)) > 0
  )
);

create unique index if not exists organizations_slug_unique_idx
on public.organizations (lower(slug));

create index if not exists organizations_created_by_idx
on public.organizations (created_by_user_id);

create index if not exists organizations_status_idx
on public.organizations (status);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_member_role not null default 'owner',
  member_status public.organization_member_status not null default 'active',
  invited_by_user_id uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique_org_user unique (organization_id, user_id)
);

create index if not exists organization_members_org_status_idx
on public.organization_members (organization_id, member_status);

create index if not exists organization_members_user_status_idx
on public.organization_members (user_id, member_status);

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row
execute function public.set_updated_at();

drop trigger if exists set_organization_members_updated_at on public.organization_members;
create trigger set_organization_members_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

drop policy if exists organizations_select_member_or_admin on public.organizations;
drop policy if exists organizations_update_owner_or_admin on public.organizations;
drop policy if exists organizations_delete_owner_or_admin on public.organizations;

create policy organizations_select_member_or_admin
on public.organizations
for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members om
    where om.organization_id = organizations.id
      and om.user_id = auth.uid()
      and om.member_status = 'active'
  )
);

create policy organizations_update_owner_or_admin
on public.organizations
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organizations.id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organizations.id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

create policy organizations_delete_owner_or_admin
on public.organizations
for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organizations.id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

drop policy if exists organization_members_select_self_owner_or_admin on public.organization_members;
drop policy if exists organization_members_insert_owner_or_admin on public.organization_members;
drop policy if exists organization_members_update_owner_or_admin on public.organization_members;
drop policy if exists organization_members_delete_owner_or_admin on public.organization_members;

create policy organization_members_select_self_owner_or_admin
on public.organization_members
for select
to authenticated
using (
  public.is_admin()
  or user_id = auth.uid()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organization_members.organization_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

create policy organization_members_insert_owner_or_admin
on public.organization_members
for insert
to authenticated
with check (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organization_members.organization_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

create policy organization_members_update_owner_or_admin
on public.organization_members
for update
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organization_members.organization_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
)
with check (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organization_members.organization_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

create policy organization_members_delete_owner_or_admin
on public.organization_members
for delete
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.organization_id = organization_members.organization_id
      and owner_membership.user_id = auth.uid()
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  )
);

create or replace function public.create_organization_workspace(
  p_name text,
  p_description text default null
)
returns table (
  organization_id uuid,
  organization_slug text,
  owner_member_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile_role public.app_role;
  v_name text;
  v_description text;
  v_slug_base text;
  v_slug_candidate text;
  v_slug_suffix integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required to create a company workspace.' using errcode = '42501';
  end if;

  select p.role
  into v_profile_role
  from public.profiles p
  where p.id = v_user_id;

  if v_profile_role is null then
    raise exception 'A profile record is required before creating a company workspace.' using errcode = 'P0001';
  end if;

  if v_profile_role not in ('seeker', 'provider') then
    raise exception 'This account role cannot create a company workspace from the current flow.' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.organization_members owner_membership
    where owner_membership.user_id = v_user_id
      and owner_membership.role = 'owner'
      and owner_membership.member_status = 'active'
  ) then
    raise exception 'You already own a company workspace.' using errcode = 'P0001';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'Company name must be between 2 and 120 characters.' using errcode = 'P0001';
  end if;

  v_description := nullif(btrim(coalesce(p_description, '')), '');
  if v_description is not null and char_length(v_description) > 600 then
    raise exception 'Company description must be 600 characters or fewer.' using errcode = 'P0001';
  end if;

  v_slug_base := regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g');
  v_slug_base := regexp_replace(v_slug_base, '(^-+|-+$)', '', 'g');

  if char_length(v_slug_base) = 0 then
    v_slug_base := 'company';
  end if;

  v_slug_base := left(v_slug_base, 48);
  v_slug_candidate := v_slug_base;

  loop
    begin
      insert into public.organizations (
        name,
        slug,
        description,
        created_by_user_id,
        status
      )
      values (
        v_name,
        v_slug_candidate,
        v_description,
        v_user_id,
        'active'
      )
      returning id, slug
      into organization_id, organization_slug;

      exit;
    exception
      when unique_violation then
        v_slug_suffix := v_slug_suffix + 1;

        if v_slug_suffix > 25 then
          raise exception 'Unable to generate a unique organization identifier. Please retry.' using errcode = 'P0001';
        end if;

        v_slug_candidate :=
          left(v_slug_base, greatest(1, 48 - char_length(v_slug_suffix::text) - 1))
          || '-'
          || v_slug_suffix::text;
    end;
  end loop;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    member_status,
    invited_by_user_id,
    joined_at
  )
  values (
    organization_id,
    v_user_id,
    'owner',
    'active',
    null,
    now()
  )
  returning id
  into owner_member_id;

  update public.profiles
  set
    role = 'provider',
    provider_account_type = 'company'
  where id = v_user_id;

  return next;
end;
$$;

comment on function public.create_organization_workspace(text, text) is
  'Creates an organization workspace for the authenticated user and atomically bootstraps owner membership.';

revoke all on function public.create_organization_workspace(text, text) from public;
grant execute on function public.create_organization_workspace(text, text) to authenticated;

grant execute on function public.create_organization_workspace(text, text) to service_role;

commit;
