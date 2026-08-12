-- Building-level rent data scraped from StreetEasy/Zillow
create table if not exists building_rents (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  source text not null check (source in ('streeteasy', 'zillow')),
  bedrooms int not null, -- 0 = studio
  min_rent int,
  max_rent int,
  median_rent int,
  listing_count int default 0,
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per building + source + bedroom count
create unique index if not exists building_rents_uniq
  on building_rents (building_id, source, bedrooms);

create index if not exists building_rents_building_id_idx
  on building_rents (building_id);

-- Allow anon reads
alter table building_rents enable row level security;
create policy "Allow anon read" on building_rents
  for select using (true);
