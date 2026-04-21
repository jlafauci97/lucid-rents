-- ============================================================================
-- get_building_owner_info_by_bbl (2026-04-21)
--
-- BBL-keyed variant of get_building_owner_info. Never reads the buildings
-- table, so it's safe to call on the hot page-load path even when buildings
-- is under heavy I/O (where the original building_id-keyed RPC indirectly
-- contended via the hpd_registrations.building_id FK and the linker backfill
-- that populates it).
--
-- Consumes: hpd_registrations (bbl idx), hpd_contacts (registration_id idx).
-- ============================================================================

CREATE OR REPLACE FUNCTION get_building_owner_info_by_bbl(target_bbl text)
RETURNS TABLE (
  corporation_name        text,
  head_officer_name       text,
  head_officer_title      text,
  business_house_number   text,
  business_street_name    text,
  business_city           text,
  business_state          text,
  business_zip            text,
  registration_end_date   date,
  registration_id         text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  latest_reg_id text;
BEGIN
  IF target_bbl IS NULL OR target_bbl = '' THEN
    RETURN;
  END IF;

  SELECT r.registration_id
    INTO latest_reg_id
  FROM hpd_registrations r
  WHERE r.bbl = target_bbl
  ORDER BY COALESCE(r.registration_end_date, r.last_registration_date) DESC NULLS LAST
  LIMIT 1;

  IF latest_reg_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH corp AS (
    SELECT c.corporation_name
    FROM hpd_contacts c
    WHERE c.registration_id = latest_reg_id
      AND c.contact_type = 'CorporateOwner'
      AND c.corporation_name IS NOT NULL
    LIMIT 1
  ),
  head AS (
    SELECT
      NULLIF(TRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '') AS name,
      c.title,
      c.business_house_number,
      c.business_street_name,
      c.business_city,
      c.business_state,
      c.business_zip
    FROM hpd_contacts c
    WHERE c.registration_id = latest_reg_id
      AND c.contact_type IN ('HeadOfficer', 'IndividualOwner')
      AND (c.first_name IS NOT NULL OR c.last_name IS NOT NULL)
    ORDER BY
      CASE c.contact_type
        WHEN 'HeadOfficer' THEN 1
        WHEN 'IndividualOwner' THEN 2
        ELSE 3
      END
    LIMIT 1
  ),
  reg AS (
    SELECT r.registration_end_date
    FROM hpd_registrations r
    WHERE r.registration_id = latest_reg_id
    LIMIT 1
  )
  SELECT
    (SELECT corp.corporation_name FROM corp)::text,
    (SELECT head.name FROM head)::text,
    (SELECT head.title FROM head)::text,
    (SELECT head.business_house_number FROM head)::text,
    (SELECT head.business_street_name FROM head)::text,
    (SELECT head.business_city FROM head)::text,
    (SELECT head.business_state FROM head)::text,
    (SELECT head.business_zip FROM head)::text,
    (SELECT reg.registration_end_date FROM reg)::date,
    latest_reg_id::text;
END;
$$;
