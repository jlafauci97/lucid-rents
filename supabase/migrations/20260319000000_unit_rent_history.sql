-- Append-only log of per-unit rent observations scraped from listing sites.
-- Each scraper run inserts new rows so we accumulate price history over time.
create table if not exists unit_rent_history (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  unit_number text not null default '',  -- empty string = building-level aggregate
  bedrooms int,               -- 0 = studio
  bathrooms numeric,
  rent int not null,
  sqft int,
  source text not null,
  observed_at date not null default current_date,
  created_at timestamptz not null default now()
);

-- Fast lookups by building, ordered by date
create index if not exists unit_rent_history_building_idx
  on unit_rent_history (building_id, observed_at desc);

-- Prevent duplicate observations on the same day (same building+source+unit+beds+rent+date)
create unique index if not exists unit_rent_history_dedup
  on unit_rent_history (building_id, source, unit_number, bedrooms, rent, observed_at);

-- Allow anon reads
alter table unit_rent_history enable row level security;
create policy "Allow anon read" on unit_rent_history
  for select using (true);
