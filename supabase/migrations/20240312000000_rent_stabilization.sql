-- ============================================================================
-- Rent Stabilization Data
-- Derived from DOF tax bills via NYCDB (taxbillsnyc.s3.amazonaws.com)
-- Migration: 20240312000000_rent_stabilization.sql
-- ============================================================================

-- --------------------------------------------------------------------------
-- rent_stabilization — yearly rent-stabilized unit counts per BBL
-- --------------------------------------------------------------------------
CREATE TABLE rent_stabilization (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id           uuid REFERENCES buildings(id) ON DELETE SET NULL,
    bbl                   varchar(10) NOT NULL,
    year                  integer NOT NULL,
    units_stabilized      integer,
    units_total           integer,
    est_units_stabilized  integer,
    diff_units_stabilized integer,
    raw_data              jsonb,
    imported_at           timestamptz DEFAULT now(),
    UNIQUE(bbl, year)
);

-- Indexes
CREATE INDEX idx_rent_stab_bbl ON rent_stabilization(bbl);
CREATE INDEX idx_rent_stab_building_id ON rent_stabilization(building_id);
CREATE INDEX idx_rent_stab_year ON rent_stabilization(year DESC);
CREATE INDEX idx_rent_stab_bbl_year ON rent_stabilization(bbl, year DESC);

-- RLS: public read
ALTER TABLE rent_stabilization ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rent_stabilization_select_public"
    ON rent_stabilization FOR SELECT
    TO public
    USING (true);

-- --------------------------------------------------------------------------
-- Denormalized columns on buildings (follows crime_count pattern)
-- --------------------------------------------------------------------------
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS is_rent_stabilized boolean DEFAULT false;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS stabilized_units integer;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS stabilized_year integer;

-- --------------------------------------------------------------------------
-- RPC: rent_stab_trend — year-over-year stabilized unit counts for a building
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rent_stab_trend(target_bbl varchar(10))
RETURNS TABLE(
    year integer,
    units_stabilized integer,
    units_total integer,
    est_units_stabilized integer,
    diff_units_stabilized integer
)
LANGUAGE sql STABLE
AS $$
    SELECT rs.year, rs.units_stabilized, rs.units_total,
           rs.est_units_stabilized, rs.diff_units_stabilized
    FROM rent_stabilization rs
    WHERE rs.bbl = target_bbl
    ORDER BY rs.year ASC;
$$;

-- --------------------------------------------------------------------------
-- RPC: rent_stab_borough_stats — aggregate stats per borough
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rent_stab_borough_stats()
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
    GROUP BY b.borough
    ORDER BY b.borough;
$$;
