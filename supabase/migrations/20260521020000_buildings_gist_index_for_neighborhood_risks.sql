-- supabase/migrations/20260521020000_buildings_gist_index_for_neighborhood_risks.sql
--
-- PostGIS GIST index on buildings (NYC only) for radius queries used by
-- the Neighborhood Risks tool. The existing idx_buildings_lat_lng is a
-- composite btree which can't do ST_DWithin natively — the planner falls
-- back to a heap scan with a recheck filter, taking 7-15s on dense areas.
--
-- This GIST index brings warm-cache noise/rats radius queries down to
-- 1-4s in most boroughs (Mott Haven, Astoria, Park Slope, Staten Island,
-- Brooklyn outer). Midtown / Williamsburg still flaky at the 8s anon
-- statement_timeout for cold reads — those clear after first query as
-- pages get cached by Supabase's pgbouncer.
--
-- Index is partial (metro = 'nyc' + non-null coords) to keep it small
-- relative to the full 930k-row buildings table.

CREATE INDEX IF NOT EXISTS idx_buildings_geog_gist
  ON buildings
  USING GIST ((ST_MakePoint(longitude::double precision, latitude::double precision)::geography))
  WHERE metro = 'nyc' AND latitude IS NOT NULL AND longitude IS NOT NULL;

COMMENT ON INDEX idx_buildings_geog_gist IS
  'PostGIS GIST index supporting Neighborhood Risks radius queries (nearby_concerns_within_radius and count_*_near RPCs).';
