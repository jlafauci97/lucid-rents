-- =============================================================================
-- DATABASE PERFORMANCE OPTIMIZATION (2026-03-23)
--
-- Addresses CPU spikes from:
-- 1. N×8 COUNT queries in updateBuildingCounts → single SQL RPC
-- 2. Missing indexes on high-seq-scan tables (buildings, lahd_violation_summary, hpd_litigations)
-- 3. ~300MB of unused indexes wasting write IO
-- 4. Autovacuum falling behind on large tables (20% threshold too high)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. BULK COUNT UPDATE RPC
--    Replaces 8 separate COUNT queries per building with 1 SQL call per batch
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION bulk_update_building_counts(building_ids uuid[])
RETURNS TABLE(building_id uuid, updated boolean, error text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bid uuid;
BEGIN
  FOREACH bid IN ARRAY building_ids
  LOOP
    BEGIN
      UPDATE buildings b SET
        violation_count    = COALESCE(v.cnt, 0),
        complaint_count    = COALESCE(c.cnt, 0),
        litigation_count   = COALESCE(l.cnt, 0),
        dob_violation_count = COALESCE(dv.cnt, 0),
        bedbug_report_count = COALESCE(bb.cnt, 0),
        eviction_count     = COALESCE(ev.cnt, 0),
        sidewalk_shed_count = COALESCE(ss.cnt, 0),
        permit_count       = COALESCE(p.cnt, 0)
      FROM
        (SELECT count(*) as cnt FROM hpd_violations WHERE hpd_violations.building_id = bid) v,
        (SELECT count(*) as cnt FROM complaints_311 WHERE complaints_311.building_id = bid) c,
        (SELECT count(*) as cnt FROM hpd_litigations WHERE hpd_litigations.building_id = bid) l,
        (SELECT count(*) as cnt FROM dob_violations WHERE dob_violations.building_id = bid) dv,
        (SELECT count(*) as cnt FROM bedbug_reports WHERE bedbug_reports.building_id = bid) bb,
        (SELECT count(*) as cnt FROM evictions WHERE evictions.building_id = bid) ev,
        (SELECT count(*) as cnt FROM sidewalk_sheds WHERE sidewalk_sheds.building_id = bid) ss,
        (SELECT count(*) as cnt FROM dob_permits WHERE dob_permits.building_id = bid) p
      WHERE b.id = bid;

      building_id := bid;
      updated := true;
      error := null;
      RETURN NEXT;
    EXCEPTION WHEN OTHERS THEN
      building_id := bid;
      updated := false;
      error := SQLERRM;
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ADD MISSING INDEXES
-- ---------------------------------------------------------------------------

-- buildings: rankings page (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_buildings_metro_violations
  ON buildings (metro, violation_count DESC)
  WHERE violation_count > 0;

CREATE INDEX IF NOT EXISTS idx_buildings_metro_complaints
  ON buildings (metro, complaint_count DESC)
  WHERE complaint_count > 0;

-- buildings: slug lookup (every building detail page)
CREATE INDEX IF NOT EXISTS idx_buildings_slug
  ON buildings (slug);

-- buildings: nearby buildings query
CREATE INDEX IF NOT EXISTS idx_buildings_metro_zip_reviews
  ON buildings (metro, zip_code, review_count DESC);

-- activity feed: tables missing metro+date coverage
CREATE INDEX IF NOT EXISTS idx_hpd_litigations_metro_date
  ON hpd_litigations (metro, case_open_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sidewalk_sheds_metro_date
  ON sidewalk_sheds (metro, issued_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evictions_metro_date
  ON evictions (metro, executed_date DESC)
  WHERE building_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bedbug_reports_metro_date
  ON bedbug_reports (metro, filing_date DESC)
  WHERE building_id IS NOT NULL;

-- LA violation summary (3.6B rows seq-scanned)
CREATE INDEX IF NOT EXISTS idx_lahd_violation_summary_metro
  ON lahd_violation_summary (metro);

CREATE INDEX IF NOT EXISTS idx_lahd_violation_summary_metro_building
  ON lahd_violation_summary (metro, building_id)
  WHERE building_id IS NOT NULL;

-- zillow rents: rent RPCs filter by metro
CREATE INDEX IF NOT EXISTS idx_zillow_rents_metro
  ON zillow_rents (metro);

-- landlord name search: trigram index for ILIKE
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_landlord_stats_name_trgm
  ON landlord_stats USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. DROP UNUSED INDEXES (~300MB wasted write IO)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_nypd_complaints_lat_lon;      -- 48MB, 0 scans
DROP INDEX IF EXISTS idx_complaints_311_complaint_type; -- 45MB, 0 scans
DROP INDEX IF EXISTS idx_complaints_311_borough;        -- 45MB, 0 scans
DROP INDEX IF EXISTS idx_permits_work_permit;           -- 31MB, 0 scans
DROP INDEX IF EXISTS idx_buildings_bin;                 -- 16MB, 0 scans
DROP INDEX IF EXISTS idx_hpd_violations_bin;            -- 13MB, 0 scans
DROP INDEX IF EXISTS idx_permits_zip;                   -- 10MB, 0 scans
DROP INDEX IF EXISTS idx_permits_work_type;             -- 10MB, 0 scans
DROP INDEX IF EXISTS idx_nypd_complaints_borough;       -- 7MB, 0 scans
DROP INDEX IF EXISTS idx_hpd_litigations_bbl;           -- 5MB, 0 scans
DROP INDEX IF EXISTS idx_energy_zip;                    -- 3MB, 0 scans
DROP INDEX IF EXISTS idx_sheds_work_permit;             -- 3MB, 0 scans
DROP INDEX IF EXISTS idx_profiles_display_name;         -- 0 scans

-- ---------------------------------------------------------------------------
-- 4. TUNE AUTOVACUUM (vacuum at 5% dead tuples instead of default 20%)
-- ---------------------------------------------------------------------------
ALTER TABLE complaints_311 SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE dob_violations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE buildings SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE hpd_violations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE nypd_complaints SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE dob_permits SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE hpd_litigations SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
ALTER TABLE lahd_violation_summary SET (
  autovacuum_vacuum_scale_factor = 0.05,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_vacuum_cost_delay = 2
);
