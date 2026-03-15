-- Full market listing data scraped from rent.com
-- Stores per-building listing info including floor plans, availability, price drops
create table if not exists building_listings (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  source text not null check (source in ('rent_com', 'streeteasy', 'zillow')),

  -- Listing identity
  listing_name text,                    -- e.g. "Waterline Square"
  listing_url text,                     -- relative URL on source site
  property_type text,                   -- APARTMENTS, CONDOS, etc.

  -- Price summary
  price_min int,
  price_max int,
  price_text text,                      -- e.g. "$5,873+"

  -- Unit summary
  bed_min int,
  bed_max int,
  bath_min int,
  bath_max int,
  sqft_min int,
  sqft_max int,
  bed_text text,                        -- e.g. "Studio–3 Beds"
  bath_text text,                       -- e.g. "1–3 Baths"
  sqft_text text,                       -- e.g. "597–1870 Sqft"

  -- Availability
  units_available int default 0,
  units_available_text text,            -- e.g. "10+ Units Available"
  availability_status text,             -- TODAY, SOON, etc.

  -- Management
  management_company text,
  verified boolean default false,

  -- Engagement
  has_price_drops boolean default false,
  listing_views int,
  updated_at_source timestamptz,        -- when listing was last updated on source

  -- Floor plans stored as JSONB array
  -- Each: {bedCount, bathCount, availableCount, priceMin, priceMax, sqftMin, sqftMax}
  floor_plans jsonb default '[]'::jsonb,

  -- Per-bedroom price breakdown as JSONB array
  -- Each: {beds, priceMin, priceMax, sqftMin, sqftMax}
  bed_price_data jsonb default '[]'::jsonb,

  -- Office hours as JSONB array
  -- Each: {day, open, close}
  office_hours jsonb default '[]'::jsonb,

  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One listing per building + source
create unique index if not exists building_listings_uniq
  on building_listings (building_id, source);

create index if not exists building_listings_building_id_idx
  on building_listings (building_id);

-- Allow anon reads
alter table building_listings enable row level security;
create policy "Allow anon read" on building_listings
  for select using (true);
