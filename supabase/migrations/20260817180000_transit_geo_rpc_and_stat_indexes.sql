-- Site-wide crawl-latency audit follow-ups (2026-08-17). Applied to prod via
-- MCP (indexes with CREATE INDEX CONCURRENTLY via one-shot pg_cron); IF NOT
-- EXISTS / OR REPLACE make this file a no-op there.

-- ── 1. Transit pages (/[city]/apartments-near/[line]) ───────────────────────
--
-- The page built an OR of ~0.005° lat/lng bounding boxes per chunk of 10
-- stops and fired one buildings query per chunk. Each lat-band bitmap scan
-- reads far more index entries than it returns, and a 40–70-stop bus route
-- meant thousands of cold heap fetches across several queries: 4–12s cold
-- TTFB and statement-timeout 500s under crawl load.
--
-- Replacement: one RPC doing stops-lookup + ST_DWithin against a geography
-- gist index, with nearest-stop dedup in SQL. The existing geog gist index
-- is partial on metro='nyc'; this one covers every metro so LA/Chicago/
-- Houston/Miami transit pages get the same plan.
CREATE INDEX IF NOT EXISTS idx_buildings_geog_gist_all
  ON public.buildings USING gist (((st_makepoint((longitude)::double precision, (latitude)::double precision))::geography))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE OR REPLACE FUNCTION public.buildings_near_transit(
  p_metro text,
  p_type text,
  p_routes text[],
  p_radius_m double precision DEFAULT 563.27,  -- 0.35 mi
  p_per_stop integer DEFAULT 120
)
RETURNS TABLE (
  id uuid, full_address text, borough text, zip_code text, slug text,
  year_built integer, total_units integer, owner_name text, overall_score numeric,
  review_count integer, violation_count integer, complaint_count integer,
  is_rent_stabilized boolean, latitude numeric, longitude numeric,
  nearest_station text, station_distance_mi numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  -- Top-K nearest buildings per stop (KNN `<->` walks the gist index in
  -- distance order and stops at p_per_stop), deduped to the nearest stop per
  -- building. Bounds both DB work and page payload: an unbounded ST_DWithin
  -- join on a full subway line touches 30K+ buildings and blows the anon 8s
  -- statement_timeout cold; this shape is ~2.5s cold / ~0.5s warm for the
  -- 44-stop A train.
  WITH stops AS (
    SELECT DISTINCT ON (ts.latitude, ts.longitude)
      ts.name,
      (ts.latitude)::double precision AS lat,
      (ts.longitude)::double precision AS lng
    FROM transit_stops ts
    WHERE ts.metro = p_metro
      AND ts.type = p_type
      AND ts.routes && p_routes
      AND ts.latitude IS NOT NULL
      AND ts.longitude IS NOT NULL
  )
  SELECT DISTINCT ON (t.id)
    t.id, t.full_address, t.borough, t.zip_code, t.slug,
    t.year_built, t.total_units, t.owner_name, t.overall_score,
    t.review_count, t.violation_count, t.complaint_count,
    t.is_rent_stabilized, t.latitude, t.longitude,
    t.nearest_station,
    round((t.dist_m / 1609.344)::numeric, 2) AS station_distance_mi
  FROM stops s
  CROSS JOIN LATERAL (
    SELECT b.id, b.full_address, (b.borough)::text AS borough, (b.zip_code)::text AS zip_code, b.slug,
      b.year_built, b.total_units, (b.owner_name)::text AS owner_name, b.overall_score,
      b.review_count, b.violation_count, b.complaint_count,
      b.is_rent_stabilized, b.latitude, b.longitude,
      s.name AS nearest_station,
      st_distance(
        (st_makepoint((b.longitude)::double precision, (b.latitude)::double precision))::geography,
        (st_makepoint(s.lng, s.lat))::geography
      ) AS dist_m
    FROM buildings b
    WHERE b.metro = p_metro
      AND b.latitude IS NOT NULL
      AND b.longitude IS NOT NULL
      AND st_dwithin(
            (st_makepoint((b.longitude)::double precision, (b.latitude)::double precision))::geography,
            (st_makepoint(s.lng, s.lat))::geography,
            p_radius_m
          )
    ORDER BY (st_makepoint((b.longitude)::double precision, (b.latitude)::double precision))::geography
             <-> (st_makepoint(s.lng, s.lat))::geography
    LIMIT p_per_stop
  ) t
  ORDER BY t.id, t.dist_m;
$$;

-- ── 2. fire-safety / air-quality stat counts ────────────────────────────────
--
-- These columns only exist for CA buildings, so for every other metro the
-- counts scan the entire metro slice to find zero rows — 8s statement
-- timeout on EVERY cold render (the stat tiles always showed 0/blank while
-- still costing the full 8s; /nyc/fire-safety cold TTFB was 9.2s from two of
-- them back to back). Tiny partial indexes make all metros instant.
CREATE INDEX IF NOT EXISTS idx_buildings_metro_vhfhsz
  ON public.buildings (metro)
  WHERE fire_hazard_zone = 'VHFHSZ';

CREATE INDEX IF NOT EXISTS idx_buildings_metro_fair_plan
  ON public.buildings (metro)
  WHERE fair_plan_risk = true;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_ces
  ON public.buildings (metro, calenviroscreen_percentile)
  WHERE calenviroscreen_percentile IS NOT NULL;
