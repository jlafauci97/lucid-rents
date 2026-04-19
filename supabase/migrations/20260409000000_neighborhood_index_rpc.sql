-- Neighborhood index RPC: reads from pre-computed cache table
CREATE TABLE IF NOT EXISTS neighborhood_stats_cache (
  metro text NOT NULL,
  zip_code text NOT NULL,
  building_count integer NOT NULL DEFAULT 0,
  avg_score numeric(4,2),
  total_violations integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (metro, zip_code)
);

ALTER TABLE neighborhood_stats_cache ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_nsc' AND tablename = 'neighborhood_stats_cache') THEN
    CREATE POLICY anon_read_nsc ON neighborhood_stats_cache FOR SELECT TO anon USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION neighborhood_index(target_city text)
RETURNS TABLE(zip_code text, building_count bigint, avg_score numeric, total_violations bigint)
LANGUAGE sql STABLE AS $$
  SELECT zip_code, building_count::bigint, avg_score, total_violations::bigint
  FROM neighborhood_stats_cache WHERE metro = target_city ORDER BY zip_code;
$$;

-- Census demographics table
CREATE TABLE IF NOT EXISTS census_demographics (
  zip_code text PRIMARY KEY,
  population integer,
  median_household_income integer,
  renter_occupied_pct numeric(5,2),
  median_age real,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE census_demographics ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'anon_read_census' AND tablename = 'census_demographics') THEN
    CREATE POLICY anon_read_census ON census_demographics FOR SELECT TO anon USING (true);
  END IF;
END $$;
