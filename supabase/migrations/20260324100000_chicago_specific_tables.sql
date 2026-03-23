-- Chicago-specific tables: RLTO violations, affordable units, lead inspections, scofflaws, demolitions

-- Chicago RLTO (Residential Landlord Tenant Ordinance) violations
CREATE TABLE IF NOT EXISTS chicago_rlto_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  case_number text NOT NULL,
  violation_type text,
  violation_description text,
  violation_date date,
  status text,
  respondent text,
  address text,
  ward integer,
  community_area text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(case_number)
);

CREATE INDEX idx_chicago_rlto_building ON chicago_rlto_violations(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chicago_rlto_date ON chicago_rlto_violations(violation_date DESC);
CREATE INDEX idx_chicago_rlto_metro ON chicago_rlto_violations(metro);

-- Chicago Affordable Requirements Ordinance units
CREATE TABLE IF NOT EXISTS chicago_affordable_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  project_name text,
  address text,
  ward integer,
  community_area text,
  total_units integer,
  affordable_units integer,
  income_requirement text,
  unit_type text,
  status text,
  developer text,
  approval_date date,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(address, project_name)
);

CREATE INDEX idx_chicago_aro_building ON chicago_affordable_units(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chicago_aro_ward ON chicago_affordable_units(ward);

-- Chicago Lead Inspections
CREATE TABLE IF NOT EXISTS chicago_lead_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  inspection_id text NOT NULL,
  address text,
  inspection_date date,
  result text,
  risk_level text,
  hazard_type text,
  ward integer,
  community_area text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(inspection_id)
);

CREATE INDEX idx_chicago_lead_building ON chicago_lead_inspections(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chicago_lead_date ON chicago_lead_inspections(inspection_date DESC);
CREATE INDEX idx_chicago_lead_result ON chicago_lead_inspections(result);

-- Chicago Building Code Scofflaws (Problem Landlords)
CREATE TABLE IF NOT EXISTS chicago_scofflaws (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  respondent_name text NOT NULL,
  address text,
  building_id uuid REFERENCES buildings(id),
  total_fines numeric,
  unpaid_fines numeric,
  violation_count integer,
  last_violation_date date,
  ward integer,
  community_area text,
  status text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(respondent_name, address)
);

CREATE INDEX idx_chicago_scoff_building ON chicago_scofflaws(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chicago_scoff_fines ON chicago_scofflaws(unpaid_fines DESC);

-- Chicago Demolitions (filtered from permits but kept separately for tracking)
CREATE TABLE IF NOT EXISTS chicago_demolitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id),
  permit_number text NOT NULL,
  address text,
  issue_date date,
  status text,
  work_description text,
  contractor text,
  ward integer,
  community_area text,
  latitude double precision,
  longitude double precision,
  imported_at timestamptz DEFAULT now(),
  metro text NOT NULL DEFAULT 'chicago',
  UNIQUE(permit_number)
);

CREATE INDEX idx_chicago_demo_building ON chicago_demolitions(building_id) WHERE building_id IS NOT NULL;
CREATE INDEX idx_chicago_demo_date ON chicago_demolitions(issue_date DESC);

-- Enable RLS on all new tables
ALTER TABLE chicago_rlto_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chicago_affordable_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE chicago_lead_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE chicago_scofflaws ENABLE ROW LEVEL SECURITY;
ALTER TABLE chicago_demolitions ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read chicago_rlto_violations" ON chicago_rlto_violations FOR SELECT USING (true);
CREATE POLICY "Public read chicago_affordable_units" ON chicago_affordable_units FOR SELECT USING (true);
CREATE POLICY "Public read chicago_lead_inspections" ON chicago_lead_inspections FOR SELECT USING (true);
CREATE POLICY "Public read chicago_scofflaws" ON chicago_scofflaws FOR SELECT USING (true);
CREATE POLICY "Public read chicago_demolitions" ON chicago_demolitions FOR SELECT USING (true);
