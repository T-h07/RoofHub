begin;

-- Ensure stale/invalid foreign-key values do not block relationship restoration.
update public.listings l
set organization_id = null
where l.organization_id is not null
  and not exists (
    select 1
    from public.organizations o
    where o.id = l.organization_id
  );

update public.listings l
set created_by_user_id = l.owner_id
where l.created_by_user_id is null
  or not exists (
    select 1
    from public.profiles p
    where p.id = l.created_by_user_id
  );

update public.listings l
set assigned_agent_user_id = null
where l.assigned_agent_user_id is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = l.assigned_agent_user_id
  );

update public.listings l
set published_by_user_id = null
where l.published_by_user_id is not null
  and not exists (
    select 1
    from public.profiles p
    where p.id = l.published_by_user_id
  );

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
      and kcu.constraint_schema = tc.constraint_schema
      and kcu.table_name = tc.table_name
      and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'listings'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'organization_id'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'organizations'
      and ccu.column_name = 'id'
  ) then
    alter table public.listings
      add constraint listings_organization_id_fkey
      foreign key (organization_id)
      references public.organizations(id)
      on delete set null
      not valid;

    alter table public.listings
      validate constraint listings_organization_id_fkey;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
      and kcu.constraint_schema = tc.constraint_schema
      and kcu.table_name = tc.table_name
      and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'listings'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'created_by_user_id'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'profiles'
      and ccu.column_name = 'id'
  ) then
    alter table public.listings
      add constraint listings_created_by_user_id_fkey
      foreign key (created_by_user_id)
      references public.profiles(id)
      not valid;

    alter table public.listings
      validate constraint listings_created_by_user_id_fkey;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
      and kcu.constraint_schema = tc.constraint_schema
      and kcu.table_name = tc.table_name
      and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'listings'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'assigned_agent_user_id'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'profiles'
      and ccu.column_name = 'id'
  ) then
    alter table public.listings
      add constraint listings_assigned_agent_user_id_fkey
      foreign key (assigned_agent_user_id)
      references public.profiles(id)
      on delete set null
      not valid;

    alter table public.listings
      validate constraint listings_assigned_agent_user_id_fkey;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
      and kcu.constraint_schema = tc.constraint_schema
      and kcu.table_name = tc.table_name
      and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
      and ccu.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'listings'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'published_by_user_id'
      and ccu.table_schema = 'public'
      and ccu.table_name = 'profiles'
      and ccu.column_name = 'id'
  ) then
    alter table public.listings
      add constraint listings_published_by_user_id_fkey
      foreign key (published_by_user_id)
      references public.profiles(id)
      on delete set null
      not valid;

    alter table public.listings
      validate constraint listings_published_by_user_id_fkey;
  end if;
end
$$;

commit;
