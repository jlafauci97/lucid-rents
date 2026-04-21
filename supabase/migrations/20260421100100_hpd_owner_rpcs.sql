-- ============================================================================
-- HPD Owner RPCs (2026-04-21)
--
-- Helpers layered on top of hpd_registrations + hpd_contacts:
--   - get_building_owner_info(uuid)  → one row with CorporateOwner +
--     HeadOfficer + business address for the latest active registration.
--   - backfill_buildings_owner_name() → one-shot refresh of
--     buildings.owner_name from the most-recent HPD CorporateOwner contact
--     for NYC buildings where owner_name is null. Safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_building_owner_info(target_building_id uuid)
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
  SELECT r.registration_id
    INTO latest_reg_id
  FROM hpd_registrations r
  WHERE r.building_id = target_building_id
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


-- ---------------------------------------------------------------------------
-- backfill_buildings_owner_name
--   For NYC buildings missing owner_name, copy the most-recent HPD
--   CorporateOwner. Does not overwrite non-null values.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION backfill_buildings_owner_name()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH latest_corp AS (
    SELECT DISTINCT ON (r.building_id)
      r.building_id,
      c.corporation_name
    FROM hpd_registrations r
    JOIN hpd_contacts c ON c.registration_id = r.registration_id
    WHERE r.building_id IS NOT NULL
      AND c.contact_type = 'CorporateOwner'
      AND c.corporation_name IS NOT NULL
    ORDER BY r.building_id,
      COALESCE(r.registration_end_date, r.last_registration_date) DESC NULLS LAST
  )
  UPDATE buildings b
  SET owner_name = lc.corporation_name
  FROM latest_corp lc
  WHERE b.id = lc.building_id
    AND b.metro = 'nyc'
    AND (b.owner_name IS NULL OR b.owner_name = '');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
