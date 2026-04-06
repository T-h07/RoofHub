begin;

create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum ('seeker', 'provider', 'admin');
create type public.preferred_contact_method as enum ('in_app', 'phone', 'email');
create type public.listing_type as enum ('rent', 'sale');
create type public.property_type as enum ('apartment', 'house', 'studio', 'land', 'commercial');
create type public.listing_status as enum ('draft', 'published', 'paused', 'archived');
create type public.heating_type as enum ('central', 'electric', 'gas', 'district', 'other');
create type public.public_location_mode as enum ('exact', 'approximate', 'hidden');
create type public.report_reason as enum (
  'spam',
  'fraud',
  'duplicate',
  'inappropriate',
  'incorrect_information',
  'other'
);
create type public.report_status as enum ('open', 'under_review', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'seeker',
  display_name text not null,
  avatar_url text,
  phone text,
  bio text,
  preferred_contact_method public.preferred_contact_method,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_not_blank check (char_length(btrim(display_name)) >= 2),
  constraint profiles_phone_not_blank check (phone is null or char_length(btrim(phone)) > 0),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 600)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  title text not null,
  description text not null,
  listing_type public.listing_type not null,
  property_type public.property_type not null,
  listing_status public.listing_status not null default 'draft',
  price_amount numeric(12, 2) not null,
  currency_code char(3) not null default 'EUR',
  deposit_amount numeric(12, 2),
  area_m2 numeric(10, 2) not null,
  bedrooms integer,
  bathrooms numeric(3, 1),
  floor_number integer,
  total_floors integer,
  furnished boolean not null default false,
  parking boolean not null default false,
  pets_allowed boolean not null default false,
  elevator boolean not null default false,
  balcony boolean not null default false,
  heating_type public.heating_type,
  internet_included boolean not null default false,
  utilities_included boolean not null default false,
  available_from date,
  city text not null,
  neighborhood text,
  address_text text,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  public_location_mode public.public_location_mode not null default 'approximate',
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_slug_not_blank check (char_length(btrim(slug)) > 0),
  constraint listings_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint listings_title_not_blank check (char_length(btrim(title)) > 0),
  constraint listings_description_not_blank check (char_length(btrim(description)) > 0),
  constraint listings_city_not_blank check (char_length(btrim(city)) > 0),
  constraint listings_neighborhood_not_blank check (
    neighborhood is null
    or char_length(btrim(neighborhood)) > 0
  ),
  constraint listings_price_nonnegative check (price_amount >= 0),
  constraint listings_deposit_nonnegative check (
    deposit_amount is null
    or deposit_amount >= 0
  ),
  constraint listings_area_positive check (area_m2 > 0),
  constraint listings_bedrooms_nonnegative check (bedrooms is null or bedrooms >= 0),
  constraint listings_bathrooms_nonnegative check (bathrooms is null or bathrooms >= 0),
  constraint listings_floor_number_range check (
    floor_number is null
    or floor_number between -10 and 300
  ),
  constraint listings_total_floors_positive check (
    total_floors is null
    or total_floors > 0
  ),
  constraint listings_floor_lte_total check (
    floor_number is null
    or total_floors is null
    or floor_number <= total_floors
  ),
  constraint listings_currency_code_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint listings_latitude_range check (latitude between -90 and 90),
  constraint listings_longitude_range check (longitude between -180 and 180),
  constraint listings_published_requires_timestamp check (
    listing_status <> 'published'
    or published_at is not null
  ),
  constraint listings_archived_requires_timestamp check (
    listing_status <> 'archived'
    or archived_at is not null
  ),
  constraint listings_id_owner_unique unique (id, owner_id)
);

create table public.listing_images (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  storage_path text not null,
  public_url text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint listing_images_storage_path_not_blank check (
    char_length(btrim(storage_path)) > 0
  ),
  constraint listing_images_public_url_not_blank check (
    public_url is null
    or char_length(btrim(public_url)) > 0
  ),
  constraint listing_images_sort_order_nonnegative check (sort_order >= 0),
  constraint listing_images_listing_sort_unique unique (listing_id, sort_order)
);

create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  provider_id uuid not null references public.profiles (id) on delete cascade,
  seeker_id uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_listing_provider_fk foreign key (listing_id, provider_id) references public.listings (id, owner_id) on delete cascade,
  constraint conversations_distinct_participants check (provider_id <> seeker_id),
  constraint conversations_listing_participants_unique unique (
    listing_id,
    provider_id,
    seeker_id
  )
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint messages_body_not_blank check (char_length(btrim(body)) > 0)
);

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason_code public.report_reason not null,
  details text,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint listing_reports_details_not_blank check (
    details is null
    or char_length(btrim(details)) > 0
  ),
  constraint listing_reports_listing_reporter_unique unique (listing_id, reporter_id),
  constraint listing_reports_reviewed_state check (
    (
      status in ('resolved', 'dismissed')
      and reviewed_at is not null
    )
    or (
      status in ('open', 'under_review')
      and reviewed_at is null
    )
  )
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_listings_updated_at
before update on public.listings
for each row
execute function public.set_updated_at();

create trigger set_conversations_updated_at
before update on public.conversations
for each row
execute function public.set_updated_at();

create trigger set_listing_reports_updated_at
before update on public.listing_reports
for each row
execute function public.set_updated_at();

create unique index listings_slug_unique_idx on public.listings (lower(slug));
create index listings_owner_idx on public.listings (owner_id);
create index listings_status_idx on public.listings (listing_status);
create index listings_type_idx on public.listings (listing_type);
create index listings_property_type_idx on public.listings (property_type);
create index listings_city_idx on public.listings (city);
create index listings_city_neighborhood_idx on public.listings (city, neighborhood);
create index listings_created_at_idx on public.listings (created_at desc);
create index listings_price_idx on public.listings (price_amount);
create index listings_status_published_at_idx on public.listings (listing_status, published_at desc);
create index listings_lat_lng_idx on public.listings (latitude, longitude);

create unique index listing_images_one_cover_per_listing_idx on public.listing_images (listing_id)
where is_cover;
create index listing_images_listing_created_idx on public.listing_images (listing_id, created_at desc);

create index favorites_listing_idx on public.favorites (listing_id);
create index favorites_user_created_idx on public.favorites (user_id, created_at desc);

create index conversations_provider_last_message_idx on public.conversations (provider_id, last_message_at desc);
create index conversations_seeker_last_message_idx on public.conversations (seeker_id, last_message_at desc);
create index conversations_listing_idx on public.conversations (listing_id);

create index messages_conversation_created_at_idx on public.messages (conversation_id, created_at);
create index messages_sender_created_at_idx on public.messages (sender_id, created_at desc);

create index listing_reports_status_created_at_idx on public.listing_reports (status, created_at desc);
create index listing_reports_listing_idx on public.listing_reports (listing_id);
create index listing_reports_reporter_idx on public.listing_reports (reporter_id);

commit;
