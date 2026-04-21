-- ============================================================================
-- HPD Registrations & Contacts (2026-04-21)
--
-- Annual filings that disclose owners, managing agents, and head officers for
-- every NYC rental building of 3+ units. Sourced from NYC Open Data:
--   - Registrations: tesw-yqqr (~203K rows, one per building-year)
--   - Contacts:      feu5-w2e2 (~780K rows, one per person-per-registration)
--
-- Linkage:
--   hpd_registrations → buildings.id   via BBL (computed from boroid+block+lot)
--   hpd_contacts      → buildings.id   via hpd_registrations.registration_id
-- ============================================================================

-- --------------------------------------------------------------------------
-- hpd_registrations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hpd_registrations (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id           varchar(20) UNIQUE NOT NULL,
    building_id               uuid REFERENCES buildings(id) ON DELETE SET NULL,
    hpd_building_id           varchar(20),
    bbl                       varchar(10),
    bin                       varchar(10),
    borough                   varchar(20),
    boro_id                   varchar(2),
    block                     integer,
    lot                       integer,
    house_number              varchar(20),
    low_house_number          varchar(20),
    high_house_number         varchar(20),
    street_name               varchar(100),
    zip                       varchar(10),
    community_board           varchar(10),
    last_registration_date    date,
    registration_end_date     date,
    metro                     text NOT NULL DEFAULT 'nyc',
    imported_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpd_registrations_bbl
  ON hpd_registrations(bbl)
  WHERE bbl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hpd_registrations_building_id
  ON hpd_registrations(building_id)
  WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hpd_registrations_end_date
  ON hpd_registrations(registration_end_date DESC);
CREATE INDEX IF NOT EXISTS idx_hpd_registrations_imported_at
  ON hpd_registrations(imported_at);
CREATE INDEX IF NOT EXISTS idx_hpd_registrations_metro
  ON hpd_registrations(metro);

ALTER TABLE hpd_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hpd_registrations_select_public" ON hpd_registrations;
CREATE POLICY "hpd_registrations_select_public"
    ON hpd_registrations FOR SELECT TO public USING (true);


-- --------------------------------------------------------------------------
-- hpd_contacts
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hpd_contacts (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_contact_id   varchar(20) UNIQUE NOT NULL,
    registration_id           varchar(20) NOT NULL,
    building_id               uuid REFERENCES buildings(id) ON DELETE SET NULL,
    contact_type              varchar(30),
    contact_description       varchar(50),
    corporation_name          varchar(200),
    title                     varchar(100),
    first_name                varchar(100),
    middle_initial            varchar(10),
    last_name                 varchar(100),
    business_house_number     varchar(30),
    business_street_name      varchar(100),
    business_apartment        varchar(30),
    business_city             varchar(100),
    business_state            varchar(10),
    business_zip              varchar(10),
    metro                     text NOT NULL DEFAULT 'nyc',
    imported_at               timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hpd_contacts_registration_id
  ON hpd_contacts(registration_id);
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_building_id
  ON hpd_contacts(building_id)
  WHERE building_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_corporation_name
  ON hpd_contacts(corporation_name)
  WHERE corporation_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_last_name
  ON hpd_contacts(last_name)
  WHERE last_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_type
  ON hpd_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_imported_at
  ON hpd_contacts(imported_at);
CREATE INDEX IF NOT EXISTS idx_hpd_contacts_metro
  ON hpd_contacts(metro);

ALTER TABLE hpd_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hpd_contacts_select_public" ON hpd_contacts;
CREATE POLICY "hpd_contacts_select_public"
    ON hpd_contacts FOR SELECT TO public USING (true);


-- --------------------------------------------------------------------------
-- link_hpd_contacts_to_buildings(since)
--   Propagates hpd_registrations.building_id onto hpd_contacts rows via the
--   shared registration_id key. Scoped by imported_at when `since` is given.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION link_hpd_contacts_to_buildings(since timestamptz DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE hpd_contacts c
  SET building_id = r.building_id
  FROM hpd_registrations r
  WHERE c.registration_id = r.registration_id
    AND r.building_id IS NOT NULL
    AND c.building_id IS DISTINCT FROM r.building_id
    AND (since IS NULL OR c.imported_at >= since);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;
