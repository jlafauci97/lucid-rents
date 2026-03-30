-- Houston-specific tables: dangerous buildings, flood risk, no-zoning land use, TDHCA affordable housing

-- Houston Dangerous Buildings (City of Houston "Dangerous Premises" program)
-- Houston is unique: no zoning means code enforcement is the primary regulatory tool
CREATE TABLE IF NOT EXISTS houston_dangerous_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  case_number text NOT NULL,
  address text,
  status text,
  case_type text,
  case_date date,
  closure_date date,
  violation_description text,
  super_neighborhood text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'houston',
  UNIQUE(case_number)
);

CREATE INDEX idx_houston_danger_building ON houston_dangerous_buildings(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_houston_danger_date ON houston_dangerous_buildings(case_date DESC);
CREATE INDEX idx_houston_danger_status ON houston_dangerous_buildings(status);
CREATE INDEX idx_houston_danger_metro ON houston_dangerous_buildings(metro);
CREATE INDEX idx_houston_danger_super_nbhd ON houston_dangerous_buildings(super_neighborhood);

ALTER TABLE houston_dangerous_buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houston_dangerous_buildings_select_public" ON houston_dangerous_buildings FOR SELECT TO public USING (true);

-- Houston Flood Risk (per-building flood claims and history — critical for Houston renters)
-- Houston experienced catastrophic flooding from Harvey (2017), Imelda (2019), etc.
CREATE TABLE IF NOT EXISTS houston_flood_risk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  address text,
  zip_code text,
  flood_zone text,
  repetitive_loss boolean DEFAULT false,
  total_claims integer DEFAULT 0,
  total_paid numeric(14,2) DEFAULT 0,
  last_claim_date date,
  in_500yr_floodplain boolean DEFAULT false,
  in_100yr_floodplain boolean DEFAULT false,
  harvey_damage boolean DEFAULT false,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'houston'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_houston_flood_addr_zip ON houston_flood_risk(address, COALESCE(zip_code, ''));
CREATE INDEX idx_houston_flood_building ON houston_flood_risk(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_houston_flood_zone ON houston_flood_risk(flood_zone);
CREATE INDEX idx_houston_flood_repetitive ON houston_flood_risk(repetitive_loss) WHERE repetitive_loss = true;
CREATE INDEX idx_houston_flood_harvey ON houston_flood_risk(harvey_damage) WHERE harvey_damage = true;
CREATE INDEX idx_houston_flood_metro ON houston_flood_risk(metro);

ALTER TABLE houston_flood_risk ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houston_flood_risk_select_public" ON houston_flood_risk FOR SELECT TO public USING (true);

-- Houston TDHCA Affordable Housing (Texas-specific low-income housing tax credit properties)
CREATE TABLE IF NOT EXISTS houston_affordable_housing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  project_name text NOT NULL,
  address text,
  zip_code text,
  total_units integer,
  affordable_units integer,
  income_requirement text,
  program_type text,
  placed_in_service_date date,
  developer text,
  owner text,
  status text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'houston'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_houston_afford_name_addr ON houston_affordable_housing(project_name, COALESCE(address, ''));
CREATE INDEX idx_houston_afford_building ON houston_affordable_housing(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_houston_afford_zip ON houston_affordable_housing(zip_code);
CREATE INDEX idx_houston_afford_metro ON houston_affordable_housing(metro);

ALTER TABLE houston_affordable_housing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houston_affordable_housing_select_public" ON houston_affordable_housing FOR SELECT TO public USING (true);

-- Houston Super Neighborhood mapping (official City of Houston planning divisions)
-- Houston has 88 super neighborhoods — unique geographic concept for the city
CREATE TABLE IF NOT EXISTS houston_super_neighborhoods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snbr_id integer NOT NULL,
  name text NOT NULL,
  number text,
  council_district text,
  total_population integer,
  median_income integer,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'houston',
  UNIQUE(snbr_id)
);

CREATE INDEX idx_houston_snbr_name ON houston_super_neighborhoods(name);
CREATE INDEX idx_houston_snbr_metro ON houston_super_neighborhoods(metro);

ALTER TABLE houston_super_neighborhoods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houston_super_neighborhoods_select_public" ON houston_super_neighborhoods FOR SELECT TO public USING (true);

-- Houston No-Zoning Land Use (Houston is the only major US city without zoning)
-- Track what's nearby: industrial facilities, bars, adult businesses near residential
CREATE TABLE IF NOT EXISTS houston_land_use_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  address text,
  nearby_facility_type text,
  nearby_facility_name text,
  distance_ft numeric,
  facility_address text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'houston'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_houston_landuse_unique ON houston_land_use_conflicts(COALESCE(address,''), COALESCE(nearby_facility_name,''), COALESCE(nearby_facility_type,''));
CREATE INDEX idx_houston_landuse_building ON houston_land_use_conflicts(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_houston_landuse_type ON houston_land_use_conflicts(nearby_facility_type);
CREATE INDEX idx_houston_landuse_metro ON houston_land_use_conflicts(metro);

ALTER TABLE houston_land_use_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "houston_land_use_conflicts_select_public" ON houston_land_use_conflicts FOR SELECT TO public USING (true);
