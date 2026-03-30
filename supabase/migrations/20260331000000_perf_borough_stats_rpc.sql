-- ============================================================================
-- Performance: materialized view + RPCs for fast page loads
-- Migration: 20260331000000_perf_borough_stats_rpc.sql
-- ============================================================================

-- Index to support covering scans on buildings by metro+borough
CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough ON buildings(metro, borough);
CREATE INDEX IF NOT EXISTS idx_buildings_metro_borough_stats ON buildings(metro, borough) INCLUDE (violation_count, complaint_count);

-- ============================================================================
-- Materialized view: pre-computed borough stats (sub-ms reads on 1.86M rows)
-- ============================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_borough_stats AS
SELECT
    b.metro,
    b.borough,
    COUNT(*) as building_count,
    COALESCE(SUM(b.violation_count), 0) as total_violations,
    COALESCE(SUM(b.complaint_count), 0) as total_complaints
FROM buildings b
WHERE b.metro IS NOT NULL AND b.borough IS NOT NULL
GROUP BY b.metro, b.borough;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_borough_stats_metro_borough ON mv_borough_stats(metro, borough);

-- RPC: reads from materialized view (instant)
CREATE OR REPLACE FUNCTION borough_stats_by_city(target_metro text)
RETURNS TABLE(
    borough text,
    building_count bigint,
    total_violations bigint,
    total_complaints bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT borough, building_count, total_violations, total_complaints
    FROM mv_borough_stats
    WHERE metro = target_metro
    ORDER BY borough;
$$;

-- RPC: refresh the materialized view (called by cron after sync)
CREATE OR REPLACE FUNCTION refresh_borough_stats()
RETURNS void
LANGUAGE sql
AS $$
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_borough_stats;
$$;

-- ============================================================================
-- RPC: crime_by_zip_single — returns crime stats for a single zip code
-- Replaces fetching ALL zip codes then filtering client-side
-- ============================================================================

CREATE OR REPLACE FUNCTION crime_by_zip_single(
    target_zip varchar(5),
    since_date date DEFAULT (now() - interval '1 year')::date
)
RETURNS TABLE(
    zip_code varchar(5),
    borough varchar(20),
    total bigint,
    violent bigint,
    property bigint,
    quality_of_life bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nc.zip_code,
        MAX(nc.borough) as borough,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE nc.crime_category = 'violent') as violent,
        COUNT(*) FILTER (WHERE nc.crime_category = 'property') as property,
        COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life') as quality_of_life
    FROM nypd_complaints nc
    WHERE nc.zip_code = target_zip
      AND nc.cmplnt_date >= since_date
      AND nc.zip_code IS NOT NULL
    GROUP BY nc.zip_code;
$$;
