-- ============================================================================
-- Landlord-level OATH aggregates (2026-04-22)
--
-- get_landlord_oath_summary(owner_name)
--   → portfolio-wide counts: total hearings, unpaid cases, unpaid $,
--     default-judgment count, agency breakdown.
--
-- get_landlord_oath_recent(owner_name, limit)
--   → recent individual cases for the timeline.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_landlord_oath_summary(landlord_owner_name text)
RETURNS TABLE (
  building_count                bigint,
  total_hearings                bigint,
  unpaid_hearings               bigint,
  total_unpaid_balance          numeric,
  total_penalty_imposed         numeric,
  total_paid                    numeric,
  default_judgments             bigint,
  latest_violation_date         date,
  agencies                      jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  bbls text[];
BEGIN
  IF landlord_owner_name IS NULL OR landlord_owner_name = '' THEN
    RETURN;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT b.bbl) FILTER (WHERE b.bbl IS NOT NULL), ARRAY[]::text[])
    INTO bbls
  FROM buildings b
  WHERE b.owner_name = landlord_owner_name AND b.metro = 'nyc';

  IF array_length(bbls, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    array_length(bbls, 1)::bigint AS building_count,
    count(*)::bigint AS total_hearings,
    count(*) FILTER (WHERE o.balance_due > 0)::bigint AS unpaid_hearings,
    COALESCE(sum(o.balance_due) FILTER (WHERE o.balance_due > 0), 0)::numeric AS total_unpaid_balance,
    COALESCE(sum(o.penalty_imposed), 0)::numeric AS total_penalty_imposed,
    COALESCE(sum(o.paid_amount), 0)::numeric AS total_paid,
    count(*) FILTER (WHERE upper(o.hearing_result) = 'DEFAULTED')::bigint AS default_judgments,
    max(o.violation_date) AS latest_violation_date,
    (
      SELECT jsonb_object_agg(agency, cnt)
      FROM (
        SELECT issuing_agency AS agency, count(*) AS cnt
        FROM oath_hearings
        WHERE bbl = ANY(bbls)
        GROUP BY issuing_agency
        ORDER BY count(*) DESC
        LIMIT 10
      ) t
    ) AS agencies
  FROM oath_hearings o
  WHERE o.bbl = ANY(bbls);
END;
$$;


CREATE OR REPLACE FUNCTION get_landlord_oath_recent(landlord_owner_name text, row_limit int DEFAULT 20)
RETURNS TABLE (
  ticket_number           text,
  bbl                     text,
  violation_date          date,
  issuing_agency          text,
  violation_description   text,
  hearing_status          text,
  hearing_result          text,
  penalty_imposed         numeric,
  balance_due             numeric,
  house_number            text,
  street_name             text,
  borough                 text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  bbls text[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT b.bbl) FILTER (WHERE b.bbl IS NOT NULL), ARRAY[]::text[])
    INTO bbls
  FROM buildings b
  WHERE b.owner_name = landlord_owner_name AND b.metro = 'nyc';

  IF array_length(bbls, 1) IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    o.ticket_number::text,
    o.bbl::text,
    o.violation_date,
    o.issuing_agency::text,
    o.violation_description,
    o.hearing_status::text,
    o.hearing_result::text,
    o.penalty_imposed,
    o.balance_due,
    o.house_number::text,
    o.street_name::text,
    o.borough::text
  FROM oath_hearings o
  WHERE o.bbl = ANY(bbls)
  ORDER BY o.violation_date DESC NULLS LAST
  LIMIT COALESCE(row_limit, 20);
END;
$$;
