begin;

alter type public.preferred_contact_method add value if not exists 'whatsapp';
alter type public.preferred_contact_method add value if not exists 'viber';

drop policy if exists profiles_select_conversation_participant on public.profiles;

create policy profiles_select_conversation_participant
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.conversations c
    where (
      c.provider_id = auth.uid()
      and c.seeker_id = profiles.id
    ) or (
      c.seeker_id = auth.uid()
      and c.provider_id = profiles.id
    )
  )
);

commit;
