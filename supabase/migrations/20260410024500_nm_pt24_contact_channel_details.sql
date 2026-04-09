begin;

alter table public.profiles
  add column if not exists contact_email text;

alter table public.profiles
  add column if not exists whatsapp_phone text;

alter table public.profiles
  add column if not exists viber_phone text;

commit;
