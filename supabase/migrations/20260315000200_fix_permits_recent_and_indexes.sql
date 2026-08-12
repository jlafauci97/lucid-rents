-- Fix permits_recent() RPC: correct column names and filter for fast queries
-- Run: DROP FUNCTION IF EXISTS permits_recent(); first if function exists with old signature

CREATE OR REPLACE FUNCTION permits_recent()
RETURNS TABLE (
  work_permit text,
  house_no text,
  street_name text,
  borough text,
  zip_code text,
  work_type text,
  permit_status text,
  filing_reason text,
  issued_date date,
  expired_date date,
  job_description text,
  estimated_job_costs numeric,
  owner_business_name text,
  building_slug text,
  building_borough text
)
LANGUAGE sql STABLE
AS $$
  SELECT
    p.work_permit,
    p.house_no,
    p.street_name,
    p.borough,
    p.zip_code,
    p.work_type,
    p.permit_status,
    p.filing_reason,
    p.issued_date,
    p.expired_date,
    p.job_description,
    p.estimated_job_costs,
    p.owner_business_name,
    b.slug AS building_slug,
    b.borough AS building_borough
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.issued_date >= CURRENT_DATE - INTERVAL '90 days'
  ORDER BY p.issued_date DESC
  LIMIT 50;
$$;

-- Composite index for permits_recent performance
CREATE INDEX IF NOT EXISTS idx_permits_status_issued ON dob_permits (permit_status, issued_date DESC);

-- Partial indexes for faster BBL linking during sync
CREATE INDEX IF NOT EXISTS idx_sheds_unlinked ON sidewalk_sheds (bbl) WHERE building_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_permits_unlinked ON dob_permits (bbl) WHERE building_id IS NULL;

-- Index for complaints_311 activity feed queries
CREATE INDEX IF NOT EXISTS idx_311_imported_at ON complaints_311 (imported_at DESC);

-- RLS policy for complaints_311 (enables anon reads for health check and public queries)
ALTER TABLE complaints_311 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read complaints_311" ON complaints_311;
CREATE POLICY "Allow anon read complaints_311" ON complaints_311 FOR SELECT USING (true);
