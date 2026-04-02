-- ============================================================================
-- Dwellsy Enrichment: building metadata, company profiles, neighborhood stats
-- + management_company column on buildings for entity distinction
-- Migration: 20260402000000_dwellsy_enrichment.sql
-- ============================================================================

-- 1. Add management_company to buildings (distinct from owner_name which is property owner)
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS management_company text;

CREATE INDEX IF NOT EXISTS idx_buildings_management_company
  ON buildings(management_company) WHERE management_company IS NOT NULL;

-- 2. Dwellsy building-level metadata (photos, amenities, deposits, vacancy)
CREATE TABLE IF NOT EXISTS dwellsy_building_meta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  photos text[],
  amenities text[],
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  active_listing_count integer DEFAULT 0,
  last_company_name text,
  last_updated timestamptz DEFAULT now(),
  UNIQUE(building_id)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_building_meta_building
  ON dwellsy_building_meta(building_id);

ALTER TABLE dwellsy_building_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_building_meta"
  ON dwellsy_building_meta FOR SELECT USING (true);

-- 3. Dwellsy company profiles (aggregated from listings)
CREATE TABLE IF NOT EXISTS dwellsy_company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  metro text NOT NULL,
  total_listings integer DEFAULT 0,
  active_listings integer DEFAULT 0,
  avg_rent numeric(10,2),
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  building_count integer DEFAULT 0,
  top_amenities text[],
  last_updated timestamptz DEFAULT now(),
  UNIQUE(company_name, metro)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_company_profiles_metro
  ON dwellsy_company_profiles(metro);

ALTER TABLE dwellsy_company_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_company_profiles"
  ON dwellsy_company_profiles FOR SELECT USING (true);

-- 4. Dwellsy neighborhood vacancy and deposit stats
CREATE TABLE IF NOT EXISTS dwellsy_neighborhood_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metro text NOT NULL,
  zip text NOT NULL,
  month date NOT NULL,
  avg_deposit numeric(10,2),
  avg_days_on_market numeric(8,2),
  active_listings integer DEFAULT 0,
  deactivated_listings integer DEFAULT 0,
  vacancy_rate numeric(6,4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(metro, zip, month)
);

CREATE INDEX IF NOT EXISTS idx_dwellsy_neighborhood_stats_metro_zip
  ON dwellsy_neighborhood_stats(metro, zip);

ALTER TABLE dwellsy_neighborhood_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read dwellsy_neighborhood_stats"
  ON dwellsy_neighborhood_stats FOR SELECT USING (true);
