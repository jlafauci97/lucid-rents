-- =============================================================================
-- BUILDING COUNT TRIGGERS (2026-03-24)
--
-- Automatically keeps violation_count, complaint_count, permit_count, etc.
-- on the buildings table in sync whenever rows are inserted, updated, or
-- deleted in the source tables. Prevents count drift that previously caused
-- LA rankings to show near-zero data.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. TRIGGER FUNCTION
--    Increments/decrements the appropriate count column on buildings
--    based on which source table fired the trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_building_count_on_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  col_name text;
BEGIN
  -- Map source table → buildings count column
  col_name := CASE TG_TABLE_NAME
    WHEN 'hpd_violations'  THEN 'violation_count'
    WHEN 'complaints_311'  THEN 'complaint_count'
    WHEN 'hpd_litigations' THEN 'litigation_count'
    WHEN 'dob_violations'  THEN 'dob_violation_count'
    WHEN 'bedbug_reports'  THEN 'bedbug_report_count'
    WHEN 'evictions'       THEN 'eviction_count'
    WHEN 'sidewalk_sheds'  THEN 'sidewalk_shed_count'
    WHEN 'dob_permits'     THEN 'permit_count'
  END;

  IF col_name IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- On INSERT or UPDATE of building_id: increment for new building
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.building_id IS DISTINCT FROM OLD.building_id) THEN
    IF NEW.building_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE buildings SET %I = COALESCE(%I, 0) + 1 WHERE id = $1',
        col_name, col_name
      ) USING NEW.building_id;
    END IF;
  END IF;

  -- On DELETE or UPDATE of building_id: decrement for old building
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.building_id IS DISTINCT FROM OLD.building_id) THEN
    IF OLD.building_id IS NOT NULL THEN
      EXECUTE format(
        'UPDATE buildings SET %I = GREATEST(COALESCE(%I, 0) - 1, 0) WHERE id = $1',
        col_name, col_name
      ) USING OLD.building_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. ATTACH TRIGGERS TO ALL SOURCE TABLES
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER trg_hpd_violations_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON hpd_violations
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_complaints_311_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON complaints_311
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_hpd_litigations_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON hpd_litigations
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_dob_violations_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON dob_violations
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_bedbug_reports_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON bedbug_reports
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_evictions_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON evictions
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_sidewalk_sheds_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON sidewalk_sheds
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

CREATE OR REPLACE TRIGGER trg_dob_permits_count
  AFTER INSERT OR UPDATE OF building_id OR DELETE
  ON dob_permits
  FOR EACH ROW EXECUTE FUNCTION update_building_count_on_change();

-- ---------------------------------------------------------------------------
-- 3. DRIFT-CHECK FUNCTION (safety net)
--    Samples N buildings per metro and reports any count mismatches.
--    Call from cron or manually: SELECT * FROM check_building_count_drift('los-angeles');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_building_count_drift(target_metro text, sample_size int DEFAULT 100)
RETURNS TABLE(table_name text, buildings_checked bigint, mismatched bigint, example_building_id uuid, stored_count bigint, actual_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check violation counts
  RETURN QUERY
  SELECT
    'hpd_violations'::text,
    count(*)::bigint,
    count(*) FILTER (WHERE sub.stored != sub.actual)::bigint,
    (array_agg(sub.id) FILTER (WHERE sub.stored != sub.actual))[1],
    max(sub.stored)::bigint,
    max(sub.actual)::bigint
  FROM (
    SELECT b.id, b.violation_count as stored,
      (SELECT count(*) FROM hpd_violations v WHERE v.building_id = b.id) as actual
    FROM buildings b
    WHERE b.metro = target_metro AND b.violation_count > 0
    ORDER BY random()
    LIMIT sample_size
  ) sub;

  -- Check complaint counts
  RETURN QUERY
  SELECT
    'complaints_311'::text,
    count(*)::bigint,
    count(*) FILTER (WHERE sub.stored != sub.actual)::bigint,
    (array_agg(sub.id) FILTER (WHERE sub.stored != sub.actual))[1],
    max(sub.stored)::bigint,
    max(sub.actual)::bigint
  FROM (
    SELECT b.id, b.complaint_count as stored,
      (SELECT count(*) FROM complaints_311 c WHERE c.building_id = b.id) as actual
    FROM buildings b
    WHERE b.metro = target_metro AND b.complaint_count > 0
    ORDER BY random()
    LIMIT sample_size
  ) sub;

  -- Check permit counts
  RETURN QUERY
  SELECT
    'dob_permits'::text,
    count(*)::bigint,
    count(*) FILTER (WHERE sub.stored != sub.actual)::bigint,
    (array_agg(sub.id) FILTER (WHERE sub.stored != sub.actual))[1],
    max(sub.stored)::bigint,
    max(sub.actual)::bigint
  FROM (
    SELECT b.id, b.permit_count as stored,
      (SELECT count(*) FROM dob_permits p WHERE p.building_id = b.id) as actual
    FROM buildings b
    WHERE b.metro = target_metro AND b.permit_count > 0
    ORDER BY random()
    LIMIT sample_size
  ) sub;
END;
$$;
