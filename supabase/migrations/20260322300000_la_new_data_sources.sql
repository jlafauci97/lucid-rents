-- LAHD Eviction Cases (99K records from data.lacity.org/resource/2u8b-eyuu)
CREATE TABLE lahd_evictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE SET NULL,
  apn varchar(20),
  address text,
  eviction_category varchar(50),
  notice_date date,
  notice_type varchar(50),
  received_date date,
  metro text NOT NULL DEFAULT 'los-angeles',
  imported_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_lahd_evictions_unique ON lahd_evictions(apn, COALESCE(notice_date, '1900-01-01'), COALESCE(notice_type, ''));
CREATE INDEX idx_lahd_evictions_building_id ON lahd_evictions(building_id);
CREATE INDEX idx_lahd_evictions_metro_date ON lahd_evictions(metro, received_date DESC) WHERE building_id IS NOT NULL;
CREATE INDEX idx_lahd_evictions_imported_at ON lahd_evictions(imported_at);
ALTER TABLE lahd_evictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lahd_evictions_select_public" ON lahd_evictions FOR SELECT TO public USING (true);

-- LAHD Tenant Buyout Cases (9K records from data.lacity.org/resource/ci3m-f23k)
CREATE TABLE lahd_tenant_buyouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE SET NULL,
  apn varchar(20),
  address text,
  disclosure_date date,
  compensation_amount numeric(12,2),
  metro text NOT NULL DEFAULT 'los-angeles',
  imported_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_lahd_buyouts_unique ON lahd_tenant_buyouts(apn, COALESCE(disclosure_date, '1900-01-01'));
CREATE INDEX idx_lahd_buyouts_building_id ON lahd_tenant_buyouts(building_id);
CREATE INDEX idx_lahd_buyouts_metro_date ON lahd_tenant_buyouts(metro, disclosure_date DESC) WHERE building_id IS NOT NULL;
CREATE INDEX idx_lahd_buyouts_imported_at ON lahd_tenant_buyouts(imported_at);
ALTER TABLE lahd_tenant_buyouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lahd_tenant_buyouts_select_public" ON lahd_tenant_buyouts FOR SELECT TO public USING (true);

-- LAHD CCRIS Cases - investigation/enforcement (317K records from data.lacity.org/resource/ds2y-sb5t)
CREATE TABLE lahd_ccris_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE SET NULL,
  apn varchar(20),
  address text,
  case_type varchar(20),
  start_date date,
  total_complaints integer DEFAULT 0,
  open_complaints integer DEFAULT 0,
  scheduled_inspections integer DEFAULT 0,
  metro text NOT NULL DEFAULT 'los-angeles',
  imported_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_lahd_ccris_unique ON lahd_ccris_cases(apn, COALESCE(start_date, '1900-01-01'), COALESCE(case_type, ''));
CREATE INDEX idx_lahd_ccris_building_id ON lahd_ccris_cases(building_id);
CREATE INDEX idx_lahd_ccris_metro_date ON lahd_ccris_cases(metro, start_date DESC) WHERE building_id IS NOT NULL;
CREATE INDEX idx_lahd_ccris_imported_at ON lahd_ccris_cases(imported_at);
ALTER TABLE lahd_ccris_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lahd_ccris_cases_select_public" ON lahd_ccris_cases FOR SELECT TO public USING (true);

-- LAHD Violation Summary - building enrichment, no dates (1M records from data.lacity.org/resource/cr8f-uc4j)
CREATE TABLE lahd_violation_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES buildings(id) ON DELETE SET NULL,
  apn varchar(20),
  address text,
  violation_type varchar(100),
  violations_cited integer DEFAULT 0,
  violations_cleared integer DEFAULT 0,
  metro text NOT NULL DEFAULT 'los-angeles',
  imported_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX idx_lahd_violation_summary_unique ON lahd_violation_summary(apn, COALESCE(violation_type, ''));
CREATE INDEX idx_lahd_violation_summary_building_id ON lahd_violation_summary(building_id);
CREATE INDEX idx_lahd_violation_summary_apn ON lahd_violation_summary(apn);
ALTER TABLE lahd_violation_summary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lahd_violation_summary_select_public" ON lahd_violation_summary FOR SELECT TO public USING (true);

-- Add metro+date index for dob_permits feed queries
CREATE INDEX IF NOT EXISTS idx_dob_permits_metro_date ON dob_permits(metro, issued_date DESC) WHERE building_id IS NOT NULL;
