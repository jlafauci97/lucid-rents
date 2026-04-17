-- Miami crime aggregates (zip-level, annual)
-- Public incident-level Miami crime data is unavailable (MDPD only publishes
-- jail bookings; City of Miami webmap is firewalled). This table holds
-- aggregate annual stats apportioned from FDLE/FBI UCR agency-level reports.
CREATE TABLE IF NOT EXISTS miami_crime_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zip text NOT NULL,
  year int NOT NULL,
  total_incidents int NOT NULL DEFAULT 0,
  violent_count int NOT NULL DEFAULT 0,
  property_count int NOT NULL DEFAULT 0,
  qol_count int NOT NULL DEFAULT 0,
  source text,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(zip, year)
);

CREATE INDEX IF NOT EXISTS idx_miami_crime_aggregates_zip ON miami_crime_aggregates(zip);
CREATE INDEX IF NOT EXISTS idx_miami_crime_aggregates_year ON miami_crime_aggregates(year DESC);

ALTER TABLE miami_crime_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read miami_crime_aggregates" ON miami_crime_aggregates
  FOR SELECT USING (true);
