-- Building amenities scraped from StreetEasy/Zillow
create table if not exists building_amenities (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  source text not null check (source in ('streeteasy', 'zillow')),
  amenity text not null,
  category text not null check (category in (
    'building', 'outdoor', 'fitness', 'parking', 'laundry',
    'security', 'pet', 'storage', 'luxury', 'other'
  )),
  scraped_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- One amenity per building+source
create unique index if not exists building_amenities_uniq
  on building_amenities (building_id, source, amenity);

create index if not exists building_amenities_building_id_idx
  on building_amenities (building_id);

-- Allow anon reads
alter table building_amenities enable row level security;
create policy "Allow anon read" on building_amenities
  for select using (true);
