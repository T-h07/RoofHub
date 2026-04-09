begin;

alter type public.listing_status add value if not exists 'sold';
alter type public.listing_status add value if not exists 'rented';

commit;
