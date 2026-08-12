-- Add a name column to buildings for branded building names (e.g., "The Max", "The Danby").
-- Populated from StreetEasy building pages and potentially other sources.
alter table buildings add column if not exists name text;

-- Index for searching by name
create index if not exists buildings_name_idx on buildings (name) where name is not null;
