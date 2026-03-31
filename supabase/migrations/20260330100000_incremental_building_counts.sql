-- =============================================================================
-- INCREMENTAL BUILDING COUNTS (2026-03-30)
--
-- Replaces bulk_update_building_counts RPC (8 COUNT(*) per building per sync)
-- with INSERT/DELETE triggers that atomically increment/decrement counts.
--
-- Impact: eliminates the biggest CPU hotspot — no more full table scans
-- on 8 tables × N buildings after every cron sync.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Generic increment/decrement functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_building_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col_name text;
BEGIN
  col_name := TG_ARGV[0];
  IF NEW.building_id IS NOT NULL THEN
    EXECUTE format(
      'UPDATE buildings SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
      col_name, col_name
    ) USING NEW.building_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_building_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col_name text;
BEGIN
  col_name := TG_ARGV[0];
  IF OLD.building_id IS NOT NULL THEN
    EXECUTE format(
      'UPDATE buildings SET %I = GREATEST(COALESCE(%I, 0) - 1, 0) WHERE id = $1',
      col_name, col_name
    ) USING OLD.building_id;
  END IF;
  RETURN OLD;
END;
$$;

-- Also handle UPDATE of building_id (unlink old, link new)
CREATE OR REPLACE FUNCTION update_building_count()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  col_name text;
BEGIN
  col_name := TG_ARGV[0];
  -- Only fire if building_id actually changed
  IF OLD.building_id IS DISTINCT FROM NEW.building_id THEN
    IF OLD.building_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE buildings SET %I = GREATEST(COALESCE(%I, 0) - 1, 0) WHERE id = $1',
        col_name, col_name
      ) USING OLD.building_id;
    END IF;
    IF NEW.building_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE buildings SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
        col_name, col_name
      ) USING NEW.building_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Create triggers for each source table → count column
-- ---------------------------------------------------------------------------

-- hpd_violations → violation_count
DROP TRIGGER IF EXISTS trg_hpd_violations_inc ON hpd_violations;
CREATE TRIGGER trg_hpd_violations_inc
  AFTER INSERT ON hpd_violations
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('violation_count');

DROP TRIGGER IF EXISTS trg_hpd_violations_dec ON hpd_violations;
CREATE TRIGGER trg_hpd_violations_dec
  AFTER DELETE ON hpd_violations
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('violation_count');

DROP TRIGGER IF EXISTS trg_hpd_violations_upd ON hpd_violations;
CREATE TRIGGER trg_hpd_violations_upd
  AFTER UPDATE OF building_id ON hpd_violations
  FOR EACH ROW EXECUTE FUNCTION update_building_count('violation_count');

-- complaints_311 → complaint_count
DROP TRIGGER IF EXISTS trg_complaints_311_inc ON complaints_311;
CREATE TRIGGER trg_complaints_311_inc
  AFTER INSERT ON complaints_311
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('complaint_count');

DROP TRIGGER IF EXISTS trg_complaints_311_dec ON complaints_311;
CREATE TRIGGER trg_complaints_311_dec
  AFTER DELETE ON complaints_311
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('complaint_count');

DROP TRIGGER IF EXISTS trg_complaints_311_upd ON complaints_311;
CREATE TRIGGER trg_complaints_311_upd
  AFTER UPDATE OF building_id ON complaints_311
  FOR EACH ROW EXECUTE FUNCTION update_building_count('complaint_count');

-- hpd_litigations → litigation_count
DROP TRIGGER IF EXISTS trg_hpd_litigations_inc ON hpd_litigations;
CREATE TRIGGER trg_hpd_litigations_inc
  AFTER INSERT ON hpd_litigations
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('litigation_count');

DROP TRIGGER IF EXISTS trg_hpd_litigations_dec ON hpd_litigations;
CREATE TRIGGER trg_hpd_litigations_dec
  AFTER DELETE ON hpd_litigations
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('litigation_count');

DROP TRIGGER IF EXISTS trg_hpd_litigations_upd ON hpd_litigations;
CREATE TRIGGER trg_hpd_litigations_upd
  AFTER UPDATE OF building_id ON hpd_litigations
  FOR EACH ROW EXECUTE FUNCTION update_building_count('litigation_count');

-- dob_violations → dob_violation_count
DROP TRIGGER IF EXISTS trg_dob_violations_inc ON dob_violations;
CREATE TRIGGER trg_dob_violations_inc
  AFTER INSERT ON dob_violations
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('dob_violation_count');

DROP TRIGGER IF EXISTS trg_dob_violations_dec ON dob_violations;
CREATE TRIGGER trg_dob_violations_dec
  AFTER DELETE ON dob_violations
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('dob_violation_count');

DROP TRIGGER IF EXISTS trg_dob_violations_upd ON dob_violations;
CREATE TRIGGER trg_dob_violations_upd
  AFTER UPDATE OF building_id ON dob_violations
  FOR EACH ROW EXECUTE FUNCTION update_building_count('dob_violation_count');

-- bedbug_reports → bedbug_report_count
DROP TRIGGER IF EXISTS trg_bedbug_reports_inc ON bedbug_reports;
CREATE TRIGGER trg_bedbug_reports_inc
  AFTER INSERT ON bedbug_reports
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('bedbug_report_count');

DROP TRIGGER IF EXISTS trg_bedbug_reports_dec ON bedbug_reports;
CREATE TRIGGER trg_bedbug_reports_dec
  AFTER DELETE ON bedbug_reports
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('bedbug_report_count');

DROP TRIGGER IF EXISTS trg_bedbug_reports_upd ON bedbug_reports;
CREATE TRIGGER trg_bedbug_reports_upd
  AFTER UPDATE OF building_id ON bedbug_reports
  FOR EACH ROW EXECUTE FUNCTION update_building_count('bedbug_report_count');

-- evictions → eviction_count
DROP TRIGGER IF EXISTS trg_evictions_inc ON evictions;
CREATE TRIGGER trg_evictions_inc
  AFTER INSERT ON evictions
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('eviction_count');

DROP TRIGGER IF EXISTS trg_evictions_dec ON evictions;
CREATE TRIGGER trg_evictions_dec
  AFTER DELETE ON evictions
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('eviction_count');

DROP TRIGGER IF EXISTS trg_evictions_upd ON evictions;
CREATE TRIGGER trg_evictions_upd
  AFTER UPDATE OF building_id ON evictions
  FOR EACH ROW EXECUTE FUNCTION update_building_count('eviction_count');

-- sidewalk_sheds → sidewalk_shed_count
DROP TRIGGER IF EXISTS trg_sidewalk_sheds_inc ON sidewalk_sheds;
CREATE TRIGGER trg_sidewalk_sheds_inc
  AFTER INSERT ON sidewalk_sheds
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('sidewalk_shed_count');

DROP TRIGGER IF EXISTS trg_sidewalk_sheds_dec ON sidewalk_sheds;
CREATE TRIGGER trg_sidewalk_sheds_dec
  AFTER DELETE ON sidewalk_sheds
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('sidewalk_shed_count');

DROP TRIGGER IF EXISTS trg_sidewalk_sheds_upd ON sidewalk_sheds;
CREATE TRIGGER trg_sidewalk_sheds_upd
  AFTER UPDATE OF building_id ON sidewalk_sheds
  FOR EACH ROW EXECUTE FUNCTION update_building_count('sidewalk_shed_count');

-- dob_permits → permit_count
DROP TRIGGER IF EXISTS trg_dob_permits_inc ON dob_permits;
CREATE TRIGGER trg_dob_permits_inc
  AFTER INSERT ON dob_permits
  FOR EACH ROW EXECUTE FUNCTION increment_building_count('permit_count');

DROP TRIGGER IF EXISTS trg_dob_permits_dec ON dob_permits;
CREATE TRIGGER trg_dob_permits_dec
  AFTER DELETE ON dob_permits
  FOR EACH ROW EXECUTE FUNCTION decrement_building_count('permit_count');

DROP TRIGGER IF EXISTS trg_dob_permits_upd ON dob_permits;
CREATE TRIGGER trg_dob_permits_upd
  AFTER UPDATE OF building_id ON dob_permits
  FOR EACH ROW EXECUTE FUNCTION update_building_count('permit_count');
