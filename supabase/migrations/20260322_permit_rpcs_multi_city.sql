-- ============================================================================
-- Multi-city permit RPCs: add p_metro parameter to filter by metro area
-- ============================================================================

-- RPC: Permit stats by borough/area filtered by metro
CREATE OR REPLACE FUNCTION permit_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, active_count bigint, top_work_type text)
LANGUAGE sql STABLE AS $$
  SELECT
    COALESCE(b.borough, p.borough) AS borough,
    COUNT(*) AS active_count,
    (
      SELECT p2.work_type
      FROM dob_permits p2
      LEFT JOIN buildings b2 ON b2.id = p2.building_id
      WHERE COALESCE(b2.borough, p2.borough) = COALESCE(b.borough, p.borough)
        AND p2.permit_status = 'Permit Issued'
        AND p2.metro = p_metro
      GROUP BY p2.work_type
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ) AS top_work_type
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.metro = p_metro
  GROUP BY COALESCE(b.borough, p.borough)
  ORDER BY active_count DESC;
$$;

-- RPC: Active permits by zip code filtered by metro
CREATE OR REPLACE FUNCTION permits_by_zip(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, borough text, permit_count bigint)
LANGUAGE sql STABLE AS $$
  SELECT
    p.zip_code,
    COALESCE(b.borough, p.borough) AS borough,
    COUNT(*) AS permit_count
  FROM dob_permits p
  LEFT JOIN buildings b ON b.id = p.building_id
  WHERE p.permit_status = 'Permit Issued'
    AND p.zip_code IS NOT NULL
    AND p.metro = p_metro
  GROUP BY p.zip_code, COALESCE(b.borough, p.borough)
  ORDER BY permit_count DESC;
$$;

-- RPC: Active permits by work type filtered by metro
CREATE OR REPLACE FUNCTION permits_by_type(p_metro text DEFAULT 'nyc')
RETURNS TABLE(work_type text, active_count bigint, avg_cost numeric)
LANGUAGE sql STABLE AS $$
  SELECT
    p.work_type,
    COUNT(*) AS active_count,
    ROUND(AVG(p.estimated_job_costs), 0) AS avg_cost
  FROM dob_permits p
  WHERE p.permit_status = 'Permit Issued'
    AND p.work_type IS NOT NULL
    AND p.metro = p_metro
  GROUP BY p.work_type
  ORDER BY active_count DESC;
$$;

-- RPC: Recently issued permits filtered by metro
CREATE OR REPLACE FUNCTION permits_recent(p_metro text DEFAULT 'nyc')
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
    COALESCE(b.borough, p.borough) AS borough,
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
    AND p.metro = p_metro
  ORDER BY p.issued_date DESC
  LIMIT 50;
$$;
