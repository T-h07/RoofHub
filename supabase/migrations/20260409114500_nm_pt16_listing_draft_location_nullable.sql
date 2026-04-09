begin;

alter table public.listings
  alter column latitude drop not null,
  alter column longitude drop not null;

alter table public.listings
  drop constraint if exists listings_published_requires_coordinates;

alter table public.listings
  add constraint listings_published_requires_coordinates check (
    listing_status <> 'published'
    or (
      latitude is not null
      and longitude is not null
    )
  );

commit;
