-- Dedup helper functions

-- Get a batch of duplicate building groups for a metro
CREATE OR REPLACE FUNCTION get_duplicate_groups_batch(
  metro_filter text,
  batch_limit int DEFAULT 500
)
RETURNS TABLE(full_address text, city text, cnt bigint) AS $$
  SELECT b.full_address, b.city, COUNT(*) as cnt
  FROM buildings b
  WHERE b.metro = metro_filter
    AND b.full_address IS NOT NULL
  GROUP BY b.full_address, b.city
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT batch_limit;
$$ LANGUAGE sql STABLE;

-- Get duplicate slug groups for a metro
CREATE OR REPLACE FUNCTION get_duplicate_slugs(metro_filter text)
RETURNS TABLE(slug text, borough text, cnt bigint) AS $$
  SELECT b.slug, b.borough, COUNT(*) as cnt
  FROM buildings b
  WHERE b.metro = metro_filter
    AND b.slug IS NOT NULL
  GROUP BY b.slug, b.borough
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC;
$$ LANGUAGE sql STABLE;

-- Check for natural key duplicates
CREATE OR REPLACE FUNCTION check_natural_key_dupes(key_column text)
RETURNS TABLE(key_val text, cnt bigint) AS $$
BEGIN
  RETURN QUERY EXECUTE format(
    'SELECT %I::text as key_val, COUNT(*) as cnt FROM buildings WHERE %I IS NOT NULL GROUP BY %I HAVING COUNT(*) > 1 LIMIT 20',
    key_column, key_column, key_column
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Re-point building_amenities with conflict handling
CREATE OR REPLACE FUNCTION repoint_building_amenities(keeper_id uuid, loser_ids uuid[])
RETURNS void AS $$
BEGIN
  DELETE FROM building_amenities ba
  WHERE ba.building_id = ANY(loser_ids)
    AND EXISTS (
      SELECT 1 FROM building_amenities ka
      WHERE ka.building_id = keeper_id AND ka.source = ba.source AND ka.amenity = ba.amenity
    );
  UPDATE building_amenities SET building_id = keeper_id WHERE building_id = ANY(loser_ids);
END;
$$ LANGUAGE plpgsql;

-- Transactional dedup: merge, repoint all FKs, delete losers — all atomic
CREATE OR REPLACE FUNCTION dedup_building_group(
  keeper_id uuid,
  loser_ids uuid[],
  merge_updates jsonb DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  tbl text;
BEGIN
  -- Step A: Merge non-null columns from losers into keeper
  IF merge_updates != '{}'::jsonb THEN
    UPDATE buildings
    SET
      house_number = COALESCE(buildings.house_number, (merge_updates->>'house_number')),
      street_name = COALESCE(buildings.street_name, (merge_updates->>'street_name')),
      zip_code = COALESCE(buildings.zip_code, (merge_updates->>'zip_code')),
      year_built = COALESCE(buildings.year_built, (merge_updates->>'year_built')::int),
      num_floors = COALESCE(buildings.num_floors, (merge_updates->>'num_floors')::int),
      total_units = COALESCE(buildings.total_units, (merge_updates->>'total_units')::int),
      residential_units = COALESCE(buildings.residential_units, (merge_updates->>'residential_units')::int),
      owner_name = COALESCE(buildings.owner_name, (merge_updates->>'owner_name')),
      latitude = COALESCE(buildings.latitude, (merge_updates->>'latitude')::double precision),
      longitude = COALESCE(buildings.longitude, (merge_updates->>'longitude')::double precision),
      name = COALESCE(buildings.name, (merge_updates->>'name')),
      apn = COALESCE(buildings.apn, (merge_updates->>'apn')),
      pin = COALESCE(buildings.pin, (merge_updates->>'pin')),
      hcad_account = COALESCE(buildings.hcad_account, (merge_updates->>'hcad_account')),
      folio_number = COALESCE(buildings.folio_number, (merge_updates->>'folio_number'))
    WHERE buildings.id = keeper_id;
  END IF;

  -- Step B: Re-point building_amenities (has unique constraint)
  DELETE FROM building_amenities ba
  WHERE ba.building_id = ANY(loser_ids)
    AND EXISTS (
      SELECT 1 FROM building_amenities ka
      WHERE ka.building_id = keeper_id AND ka.source = ba.source AND ka.amenity = ba.amenity
    );
  UPDATE building_amenities SET building_id = keeper_id WHERE building_id = ANY(loser_ids);

  -- Step C: Re-point all other FK tables
  FOREACH tbl IN ARRAY ARRAY[
    'building_listings', 'building_rents', 'building_scores',
    'dewey_building_rents', 'dwellsy_building_meta',
    'monitored_buildings', 'reviews', 'saved_buildings',
    'unit_listings', 'unit_rent_history', 'units',
    'bedbug_reports', 'complaints_311', 'dob_permits', 'dob_violations',
    'energy_benchmarks', 'evictions', 'hpd_lead_violations', 'hpd_litigations',
    'hpd_violations', 'lahd_ccris_cases', 'lahd_evictions',
    'lahd_tenant_buyouts', 'lahd_violation_summary',
    'rent_stabilization', 'sidewalk_sheds',
    'chicago_affordable_units', 'chicago_demolitions', 'chicago_lead_inspections',
    'chicago_rlto_violations', 'chicago_scofflaws',
    'houston_affordable_housing', 'houston_dangerous_buildings',
    'houston_flood_risk', 'houston_land_use_conflicts',
    'miami_flood_claims', 'miami_forty_year_recerts', 'miami_unsafe_structures',
    'nypd_complaints', 'review_amenities'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('UPDATE %I SET building_id = $1 WHERE building_id = ANY($2)', tbl)
        USING keeper_id, loser_ids;
    END IF;
  END LOOP;

  -- Step D: Delete losers
  DELETE FROM buildings WHERE id = ANY(loser_ids);
END;
$$ LANGUAGE plpgsql;
