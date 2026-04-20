-- ============================================================================
-- Submarket rent history: long-horizon quarterly rent trends by submarket
-- ============================================================================
-- Submarkets are neighborhood-sized regions (typically larger than a single
-- zip). A submarket is the lookup key for quarterly asking/effective rent
-- history broken out by bedroom count. Buildings resolve their submarket via
-- zip_submarkets, and then pull the full history for display.
--
-- Design notes:
--  * `quarter` stores the first day of each quarter (e.g. 2024-01-01)
--  * `beds` is a text enum-like column: 'all' | 'studio' | '1br' | '2br' | '3br'
--    ('all' is only present for rent_type='asking' in the current data set)
--  * `rent_type` is 'asking' or 'effective' — effective = net of concessions
-- ============================================================================

CREATE TABLE IF NOT EXISTS submarkets (
  id serial PRIMARY KEY,
  city text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  UNIQUE (city, slug)
);

CREATE INDEX IF NOT EXISTS idx_submarkets_city ON submarkets(city);

ALTER TABLE submarkets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read submarkets"
  ON submarkets FOR SELECT USING (true);


CREATE TABLE IF NOT EXISTS zip_submarkets (
  zip text PRIMARY KEY,
  city text NOT NULL,
  submarket_id integer NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_zip_submarkets_city ON zip_submarkets(city);
CREATE INDEX IF NOT EXISTS idx_zip_submarkets_submarket ON zip_submarkets(submarket_id);

ALTER TABLE zip_submarkets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read zip_submarkets"
  ON zip_submarkets FOR SELECT USING (true);


CREATE TABLE IF NOT EXISTS submarket_rent_history (
  id bigserial PRIMARY KEY,
  submarket_id integer NOT NULL REFERENCES submarkets(id) ON DELETE CASCADE,
  quarter date NOT NULL,
  beds text NOT NULL CHECK (beds IN ('all','studio','1br','2br','3br')),
  rent_type text NOT NULL CHECK (rent_type IN ('asking','effective')),
  rent_per_unit numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submarket_id, quarter, beds, rent_type)
);

CREATE INDEX IF NOT EXISTS idx_submarket_rent_history_submarket_quarter
  ON submarket_rent_history(submarket_id, quarter DESC);

ALTER TABLE submarket_rent_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read submarket_rent_history"
  ON submarket_rent_history FOR SELECT USING (true);
