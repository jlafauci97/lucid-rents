-- =============================================================================
-- LANDLORD PAGE PERFORMANCE
--
-- 1. city_avg_score RPC — uses landlord_stats (fast) instead of buildings table
-- 2. Partial index on buildings(metro, overall_score) for future use
-- =============================================================================

-- Partial index for any future direct AVG queries on buildings
CREATE INDEX IF NOT EXISTS idx_buildings_metro_score
  ON buildings (metro, overall_score)
  WHERE overall_score IS NOT NULL;

-- Fast city average from the small landlord_stats table
CREATE OR REPLACE FUNCTION city_avg_score(p_metro text DEFAULT 'nyc')
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT round(avg(avg_score)::numeric, 2)
  FROM landlord_stats
  WHERE metro = p_metro;
$$;
