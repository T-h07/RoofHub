begin;

alter table public.profiles
  add column if not exists contact_methods public.preferred_contact_method[] not null
  default array['in_app']::public.preferred_contact_method[];

update public.profiles
set contact_methods = array[preferred_contact_method]::public.preferred_contact_method[]
where preferred_contact_method is not null
  and (
    contact_methods is null
    or array_length(contact_methods, 1) is null
    or contact_methods = array['in_app']::public.preferred_contact_method[]
  );

commit;
