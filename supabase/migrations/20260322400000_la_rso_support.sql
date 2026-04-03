-- ============================================================================
-- LA RSO (Rent Stabilization Ordinance) Support
-- Updates rent_stab_borough_stats RPC to filter by metro,
-- and adds a function to derive RSO status from year_built + units.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Update rent_stab_borough_stats to accept p_metro parameter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rent_stab_borough_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(
    borough varchar,
    total_buildings bigint,
    stabilized_buildings bigint,
    total_stabilized_units bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        b.borough,
        COUNT(DISTINCT b.id) as total_buildings,
        COUNT(DISTINCT b.id) FILTER (WHERE b.is_rent_stabilized = true) as stabilized_buildings,
        COALESCE(SUM(b.stabilized_units) FILTER (WHERE b.is_rent_stabilized = true), 0) as total_stabilized_units
    FROM buildings b
    WHERE b.borough IS NOT NULL
      AND b.metro = p_metro
    GROUP BY b.borough
    HAVING COUNT(DISTINCT b.id) FILTER (WHERE b.is_rent_stabilized = true) > 0
    ORDER BY total_stabilized_units DESC;
$$;

-- --------------------------------------------------------------------------
-- Derive RSO status for LA buildings:
-- Buildings with 2+ residential units built before Oct 1978 are generally
-- covered by the RSO (with some exemptions like condos, single-family homes).
-- This sets is_rent_stabilized=true and stabilized_year=year_built for
-- qualifying buildings that don't already have stabilization data.
-- --------------------------------------------------------------------------
UPDATE buildings
SET
    is_rent_stabilized = true,
    stabilized_units = COALESCE(residential_units, total_units),
    stabilized_year = year_built
WHERE metro = 'los-angeles'
  AND year_built IS NOT NULL
  AND year_built > 0
  AND year_built <= 1978
  AND COALESCE(residential_units, total_units, 0) >= 2
  AND (is_rent_stabilized IS NULL OR is_rent_stabilized = false);

-- Also mark buildings clearly NOT RSO (post-1978 or single-unit)
UPDATE buildings
SET is_rent_stabilized = false
WHERE metro = 'los-angeles'
  AND is_rent_stabilized IS NULL
  AND (
    (year_built IS NOT NULL AND year_built > 1978)
    OR COALESCE(residential_units, total_units, 0) < 2
  );
