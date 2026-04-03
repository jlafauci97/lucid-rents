-- Fix scaffolding_longest() to aggregate permits by address.
-- Groups by house_no + street_name + borough so each row represents a
-- physical location with its total permit count and first/latest issued dates.

CREATE OR REPLACE FUNCTION scaffolding_longest()
RETURNS TABLE(
  house_no text, street_name text, borough text, zip_code text,
  permit_count bigint, first_issued date, latest_issued date,
  total_days integer, active_permits bigint,
  owner_business_name text
)
LANGUAGE sql STABLE AS $$
  SELECT
    house_no,
    street_name,
    borough,
    MIN(zip_code) AS zip_code,
    COUNT(*) AS permit_count,
    MIN(issued_date) AS first_issued,
    MAX(issued_date) AS latest_issued,
    (CURRENT_DATE - MIN(issued_date))::integer AS total_days,
    COUNT(*) FILTER (WHERE permit_status = 'Permit Issued') AS active_permits,
    MIN(owner_business_name) AS owner_business_name
  FROM sidewalk_sheds
  WHERE issued_date IS NOT NULL
  GROUP BY house_no, street_name, borough
  ORDER BY MIN(issued_date) ASC
  LIMIT 500;
$$;
