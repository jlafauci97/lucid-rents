-- ============================================================================
-- Dewey Data Integration: rent analytics tables
-- Migration: 20260401000000_dewey_rent_tables.sql
-- ============================================================================

-- 1. Building-level monthly rent aggregates
CREATE TABLE IF NOT EXISTS dewey_building_rents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  month date NOT NULL,
  beds smallint NOT NULL, -- 0=studio, 1,2,3,4,5+
  median_rent numeric(10,2),
  min_rent numeric(10,2),
  max_rent numeric(10,2),
  p25_rent numeric(10,2),
  p75_rent numeric(10,2),
  avg_sqft numeric(8,2),
  avg_price_per_sqft numeric(8,2),
  listing_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(building_id, month, beds)
);

CREATE INDEX IF NOT EXISTS idx_dewey_building_rents_building
  ON dewey_building_rents(building_id);
CREATE INDEX IF NOT EXISTS idx_dewey_building_rents_building_beds
  ON dewey_building_rents(building_id, beds);

ALTER TABLE dewey_building_rents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dewey_building_rents"
  ON dewey_building_rents FOR SELECT USING (true);

-- 2. Neighborhood-level monthly aggregates
CREATE TABLE IF NOT EXISTS dewey_neighborhood_rents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  neighborhood text,
  zip text NOT NULL,
  month date NOT NULL,
  beds smallint NOT NULL,
  median_rent numeric(10,2),
  p25_rent numeric(10,2),
  p75_rent numeric(10,2),
  avg_sqft numeric(8,2),
  listing_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(city, zip, month, beds)
);

CREATE INDEX IF NOT EXISTS idx_dewey_neighborhood_rents_city_zip
  ON dewey_neighborhood_rents(city, zip);
CREATE INDEX IF NOT EXISTS idx_dewey_neighborhood_rents_city_zip_beds
  ON dewey_neighborhood_rents(city, zip, beds);

ALTER TABLE dewey_neighborhood_rents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dewey_neighborhood_rents"
  ON dewey_neighborhood_rents FOR SELECT USING (true);

-- 3. Pre-computed amenity premiums
CREATE TABLE IF NOT EXISTS dewey_amenity_premiums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  zip text,
  amenity text NOT NULL, -- 'pool','gym','doorman','laundry','garage','furnished','clubhouse','granite','stainless'
  beds smallint NOT NULL,
  median_with numeric(10,2),
  median_without numeric(10,2),
  premium_pct numeric(6,2),
  premium_dollars numeric(10,2),
  sample_size integer NOT NULL DEFAULT 0,
  period text NOT NULL, -- 'all_time', '2024', '2025', etc.
  created_at timestamptz NOT NULL DEFAULT now(),
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dewey_amenity_premiums_unique
  ON dewey_amenity_premiums(city, COALESCE(zip,''), amenity, beds, period);

CREATE INDEX IF NOT EXISTS idx_dewey_amenity_premiums_city_zip
  ON dewey_amenity_premiums(city, zip);

ALTER TABLE dewey_amenity_premiums ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dewey_amenity_premiums"
  ON dewey_amenity_premiums FOR SELECT USING (true);

-- 4. Landlord/company pricing history
CREATE TABLE IF NOT EXISTS dewey_company_rents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  city text NOT NULL,
  month date NOT NULL,
  beds smallint NOT NULL,
  median_rent numeric(10,2),
  building_count integer NOT NULL DEFAULT 0,
  listing_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_name, city, month, beds)
);

CREATE INDEX IF NOT EXISTS idx_dewey_company_rents_company_city
  ON dewey_company_rents(company_name, city);

ALTER TABLE dewey_company_rents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dewey_company_rents"
  ON dewey_company_rents FOR SELECT USING (true);

-- 5. Seasonal index for "when to move" tool
CREATE TABLE IF NOT EXISTS dewey_seasonal_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  neighborhood text,
  zip text,
  month_of_year smallint NOT NULL CHECK (month_of_year BETWEEN 1 AND 12),
  beds smallint NOT NULL,
  rent_index numeric(6,4) NOT NULL, -- 1.0 = annual average
  sample_years integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_dewey_seasonal_index_unique
  ON dewey_seasonal_index(city, COALESCE(zip,''), month_of_year, beds);

CREATE INDEX IF NOT EXISTS idx_dewey_seasonal_index_city_zip
  ON dewey_seasonal_index(city, zip);

ALTER TABLE dewey_seasonal_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dewey_seasonal_index"
  ON dewey_seasonal_index FOR SELECT USING (true);
