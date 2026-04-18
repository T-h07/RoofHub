begin;

-- NM-PT40 stability patch: remove self-referential membership policy subqueries
-- that can fail workspace context resolution under RLS evaluation.
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
  or public.is_organization_owner_or_admin(organization_members.organization_id)
);

create policy organization_members_insert_owner_or_admin
on public.organization_members
for insert
to authenticated
with check (public.is_organization_owner_or_admin(organization_members.organization_id));

create policy organization_members_update_owner_or_admin
on public.organization_members
for update
to authenticated
using (public.is_organization_owner_or_admin(organization_members.organization_id))
with check (public.is_organization_owner_or_admin(organization_members.organization_id));

create policy organization_members_delete_owner_or_admin
on public.organization_members
for delete
to authenticated
using (public.is_organization_owner_or_admin(organization_members.organization_id));

commit;
