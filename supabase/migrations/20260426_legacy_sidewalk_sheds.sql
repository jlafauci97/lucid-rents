-- Add a source column so we can mix legacy DOB BIS permits (1989+) with DOB NOW (2017+).
-- Legacy permits get source='legacy' and a "L-" prefix on work_permit to avoid collisions.

ALTER TABLE sidewalk_sheds
  ADD COLUMN IF NOT EXISTS source varchar(20) NOT NULL DEFAULT 'dob_now';

CREATE INDEX IF NOT EXISTS idx_sheds_source ON sidewalk_sheds(source);

-- Re-aggregate longest-standing sheds using BOTH legacy (1989+) and DOB NOW (2017+) data.
-- An address counts as "currently up" if it has any DOB NOW permit with status='Permit Issued'.
-- The total_days is then computed from the earliest issued_date across BOTH sources at that address.

CREATE OR REPLACE FUNCTION scaffolding_longest()
RETURNS TABLE(
  house_no text, street_name text, borough text, zip_code text,
  permit_count bigint, first_issued date, latest_issued date,
  total_days integer, active_permits bigint,
  owner_business_name text
)
LANGUAGE sql STABLE AS $$
  WITH active_addresses AS (
    SELECT DISTINCT house_no, street_name, borough
    FROM sidewalk_sheds
    WHERE source = 'dob_now'
      AND permit_status = 'Permit Issued'
      AND house_no IS NOT NULL
      AND street_name IS NOT NULL
  ),
  agg AS (
    SELECT
      s.house_no,
      s.street_name,
      s.borough,
      MIN(s.zip_code) AS zip_code,
      COUNT(*) AS permit_count,
      MIN(s.issued_date) AS first_issued,
      MAX(s.issued_date) AS latest_issued,
      (CURRENT_DATE - MIN(s.issued_date))::integer AS total_days,
      COUNT(*) FILTER (
        WHERE s.source = 'dob_now' AND s.permit_status = 'Permit Issued'
      ) AS active_permits,
      MIN(s.owner_business_name) AS owner_business_name
    FROM sidewalk_sheds s
    INNER JOIN active_addresses a
      ON s.house_no = a.house_no
     AND s.street_name = a.street_name
     AND s.borough = a.borough
    WHERE s.issued_date IS NOT NULL
    GROUP BY s.house_no, s.street_name, s.borough
  )
  SELECT
    house_no, street_name, borough, zip_code,
    permit_count, first_issued, latest_issued,
    total_days, active_permits, owner_business_name
  FROM agg
  ORDER BY first_issued ASC
  LIMIT 500;
$$;
