begin;

alter type public.listing_status add value if not exists 'hidden_by_admin';

commit;
