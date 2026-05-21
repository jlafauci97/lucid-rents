-- Round 3 performance: address-search trigram + spatial transit lookups.
--
-- (1) buildings full_address ILIKE — 45K calls × 13,134ms = 165 hours/month.
-- The global idx_buildings_full_address_trgm (288 MB) scans matches across
-- ALL metros before filtering on metro = $2, doing wasted heap-fetch work.
-- Per-metro partial trgm indexes let the planner skip straight to the
-- target metro's matches.
--
-- Verified via EXPLAIN ANALYZE for "broadway" + metro=nyc:
--   Planning  830ms → 14ms   (59× faster)
--   Execution 2,665ms → 21ms (127× faster)
--   Total     ~3,500ms → ~36ms  (97× faster)
--
-- (2) transit_stops bounding-box queries — 3.3M calls × 82ms = 74 hours/month.
-- Existing btree(type, lat, lng) only range-scans on latitude. A GIST index
-- on a geography point enables true 2D bbox + ST_DWithin lookups. Note: the
-- application code must use ST_Within / && / ST_DWithin operators to leverage
-- this — pure `lat BETWEEN ... AND lng BETWEEN ...` queries won't pick it up.

SET LOCAL statement_timeout = 0;

-- Per-metro partial trigram indexes on buildings.full_address
CREATE INDEX IF NOT EXISTS idx_buildings_nyc_addr_trgm
  ON public.buildings USING gin (full_address gin_trgm_ops)
  WHERE metro = 'nyc';

CREATE INDEX IF NOT EXISTS idx_buildings_la_addr_trgm
  ON public.buildings USING gin (full_address gin_trgm_ops)
  WHERE metro = 'los-angeles';

CREATE INDEX IF NOT EXISTS idx_buildings_chicago_addr_trgm
  ON public.buildings USING gin (full_address gin_trgm_ops)
  WHERE metro = 'chicago';

CREATE INDEX IF NOT EXISTS idx_buildings_miami_addr_trgm
  ON public.buildings USING gin (full_address gin_trgm_ops)
  WHERE metro = 'miami';

CREATE INDEX IF NOT EXISTS idx_buildings_houston_addr_trgm
  ON public.buildings USING gin (full_address gin_trgm_ops)
  WHERE metro = 'houston';

-- PostGIS GIST on transit_stops for spatial queries
CREATE INDEX IF NOT EXISTS idx_transit_stops_geog
  ON public.transit_stops
  USING gist ((ST_MakePoint(longitude, latitude)::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
