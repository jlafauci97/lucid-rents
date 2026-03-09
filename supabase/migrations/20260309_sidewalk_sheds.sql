-- ============================================================================
-- Sidewalk Sheds: DOB permits for sidewalk shed installations
-- Source: NYC Open Data DOB permits (rbx6-tga4), work_type='Sidewalk Shed'
-- ============================================================================

CREATE TABLE sidewalk_sheds (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id             uuid REFERENCES buildings(id) ON DELETE SET NULL,
  bbl                     varchar(10),
  bin                     varchar(10),
  work_permit             varchar(50) UNIQUE NOT NULL,
  house_no                varchar(20),
  street_name             varchar(150),
  borough                 varchar(20),
  zip_code                varchar(10),
  block                   varchar(10),
  lot                     varchar(10),
  permit_status           varchar(30),
  filing_reason           varchar(30),
  issued_date             date,
  expired_date            date,
  job_description         text,
  estimated_job_costs     numeric(12,2),
  owner_business_name     varchar(200),
  permittee_business_name varchar(200),
  imported_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_sheds_bbl ON sidewalk_sheds(bbl);
CREATE INDEX idx_sheds_building_id ON sidewalk_sheds(building_id);
CREATE INDEX idx_sheds_work_permit ON sidewalk_sheds(work_permit);
CREATE INDEX idx_sheds_issued_date ON sidewalk_sheds(issued_date DESC);
CREATE INDEX idx_sheds_borough ON sidewalk_sheds(borough);
CREATE INDEX idx_sheds_zip ON sidewalk_sheds(zip_code);
CREATE INDEX idx_sheds_imported_at ON sidewalk_sheds(imported_at);

ALTER TABLE sidewalk_sheds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sheds_select_public" ON sidewalk_sheds FOR SELECT TO public USING (true);

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS sidewalk_shed_count integer DEFAULT 0;

-- ============================================================================
-- RPC Functions
-- ============================================================================

-- Summary stats by borough (active sheds only)
CREATE OR REPLACE FUNCTION scaffolding_stats()
RETURNS TABLE(borough text, active_count bigint, avg_days_up numeric)
LANGUAGE sql STABLE AS $$
  SELECT borough,
         COUNT(*) AS active_count,
         ROUND(AVG(CURRENT_DATE - issued_date), 0) AS avg_days_up
  FROM sidewalk_sheds
  WHERE permit_status = 'Permit Issued'
    AND issued_date IS NOT NULL
  GROUP BY borough
  ORDER BY active_count DESC;
$$;

-- Active shed count by zip code (for map choropleth)
CREATE OR REPLACE FUNCTION scaffolding_by_zip()
RETURNS TABLE(zip_code text, borough text, shed_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT zip_code, borough, COUNT(*) AS shed_count
  FROM sidewalk_sheds
  WHERE permit_status = 'Permit Issued'
    AND zip_code IS NOT NULL
  GROUP BY zip_code, borough
  ORDER BY shed_count DESC;
$$;

-- Longest-standing active sheds
CREATE OR REPLACE FUNCTION scaffolding_longest()
RETURNS TABLE(
  work_permit text, house_no text, street_name text,
  borough text, zip_code text, issued_date date, expired_date date,
  days_up integer, owner_business_name text, permittee_business_name text
)
LANGUAGE sql STABLE AS $$
  SELECT work_permit, house_no, street_name, borough, zip_code,
         issued_date, expired_date,
         (CURRENT_DATE - issued_date)::integer AS days_up,
         owner_business_name, permittee_business_name
  FROM sidewalk_sheds
  WHERE permit_status = 'Permit Issued'
    AND issued_date IS NOT NULL
  ORDER BY issued_date ASC
  LIMIT 500;
$$;
