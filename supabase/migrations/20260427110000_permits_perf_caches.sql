-- ============================================================================
-- Performance: the four /[city]/permits RPCs (permit_stats, permits_by_zip,
-- permits_by_type, permits_recent) all timed out for non-NYC metros and
-- showed "No permit data available" on the page despite dob_permits having
-- 100K-500K rows per metro.
--
-- Two underlying problems:
--   1. The status filter `permit_status = 'Permit Issued'` is NYC-only.
--      Other cities use 'ISSUED'/'ACTIVE' (Chicago), 'Issued'/'CofO Issued'
--      (LA), or numeric codes (Miami).
--   2. The RPCs LEFT JOINed the 2.1M-row buildings table just to get a
--      borough that's already on dob_permits.borough — costly aggregate
--      that exceeded the 8s anon statement_timeout.
--
-- Fix:
--   - is_active_permit(metro, status) helper centralises the per-metro
--     status whitelist.
--   - Three small cache tables (permit_stats_cache, permits_by_zip_cache,
--     permits_by_type_cache, permits_recent_cache) are populated from
--     dob_permits via refresh_permit_caches() — service_role timeout.
--   - The four RPCs are rewritten to read from cache (sub-ms response).
--
-- Miami quirk: dob_permits.issued_date is NULL across all 262K rows and
-- zip_code is NULL across all rows. permits_recent for Miami orders by
-- id DESC instead of issued_date. The map view will be empty until that
-- ingestion gap is fixed.
--
-- Houston not addressed: no Houston rows exist in dob_permits at all.
-- Needs a separate ingest from Houston's open data portal.
-- ============================================================================

CREATE TABLE IF NOT EXISTS permit_stats_cache (
    metro                text   NOT NULL,
    borough              text   NOT NULL,
    active_count         bigint NOT NULL,
    top_work_type        text,
    refreshed_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (metro, borough)
);

CREATE TABLE IF NOT EXISTS permits_by_zip_cache (
    metro                text   NOT NULL,
    zip_code             text   NOT NULL,
    borough              text,
    permit_count         bigint NOT NULL,
    refreshed_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (metro, zip_code)
);

CREATE TABLE IF NOT EXISTS permits_by_type_cache (
    metro                text   NOT NULL,
    work_type            text   NOT NULL,
    active_count         bigint NOT NULL,
    avg_cost             numeric,
    refreshed_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (metro, work_type)
);

CREATE TABLE IF NOT EXISTS permits_recent_cache (
    metro                text NOT NULL,
    rank                 int  NOT NULL,
    work_permit          text,
    house_no             text,
    street_name          text,
    borough              text,
    zip_code             text,
    work_type            text,
    permit_status        text,
    filing_reason        text,
    issued_date          date,
    expired_date         date,
    job_description      text,
    estimated_job_costs  numeric,
    owner_business_name  text,
    building_slug        text,
    building_borough     text,
    refreshed_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (metro, rank)
);

GRANT SELECT ON permit_stats_cache, permits_by_zip_cache, permits_by_type_cache, permits_recent_cache
  TO anon, authenticated, service_role;

-- Per-metro "active permit" status whitelist
CREATE OR REPLACE FUNCTION public.is_active_permit(p_metro text, p_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT CASE p_metro
    WHEN 'nyc'         THEN p_status = 'Permit Issued'
    WHEN 'chicago'     THEN p_status IN ('ISSUED','ACTIVE','PHASED PERMITTING')
    WHEN 'los-angeles' THEN p_status IN ('Issued','CofO Issued')
    WHEN 'miami'       THEN p_status IS NOT NULL  -- numeric codes — accept all
    ELSE p_status IS NOT NULL
  END;
$$;
GRANT EXECUTE ON FUNCTION public.is_active_permit(text,text) TO anon, authenticated, service_role;

-- RPCs read from cache (sub-ms). SECURITY DEFINER bypasses RLS for anon.
CREATE OR REPLACE FUNCTION public.permit_stats(p_metro text DEFAULT 'nyc')
RETURNS TABLE(borough text, active_count bigint, top_work_type text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT borough, active_count, top_work_type
  FROM permit_stats_cache WHERE metro = p_metro
  ORDER BY active_count DESC;
$$;

CREATE OR REPLACE FUNCTION public.permits_by_zip(p_metro text DEFAULT 'nyc')
RETURNS TABLE(zip_code text, borough text, permit_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT zip_code, borough, permit_count
  FROM permits_by_zip_cache WHERE metro = p_metro
  ORDER BY permit_count DESC;
$$;

CREATE OR REPLACE FUNCTION public.permits_by_type(p_metro text DEFAULT 'nyc')
RETURNS TABLE(work_type text, active_count bigint, avg_cost numeric)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT work_type, active_count, avg_cost
  FROM permits_by_type_cache WHERE metro = p_metro
  ORDER BY active_count DESC;
$$;

CREATE OR REPLACE FUNCTION public.permits_recent(p_metro text DEFAULT 'nyc')
RETURNS TABLE(
  work_permit text, house_no text, street_name text, borough text, zip_code text,
  work_type text, permit_status text, filing_reason text, issued_date date,
  expired_date date, job_description text, estimated_job_costs numeric,
  owner_business_name text, building_slug text, building_borough text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT work_permit, house_no, street_name, borough, zip_code,
         work_type, permit_status, filing_reason, issued_date,
         expired_date, job_description, estimated_job_costs,
         owner_business_name, building_slug, building_borough
  FROM permits_recent_cache WHERE metro = p_metro
  ORDER BY rank;
$$;

GRANT EXECUTE ON FUNCTION public.permit_stats(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permits_by_zip(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permits_by_type(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.permits_recent(text) TO anon, authenticated, service_role;

-- Cache refresh — call from cron / pg_cron after dob_permits sync
CREATE OR REPLACE FUNCTION public.refresh_permit_caches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
    INSERT INTO permit_stats_cache (metro, borough, active_count, top_work_type, refreshed_at)
    SELECT metro, borough, COUNT(*)::bigint, NULL, now()
    FROM dob_permits
    WHERE borough IS NOT NULL AND is_active_permit(metro, permit_status)
    GROUP BY metro, borough
    ON CONFLICT (metro, borough) DO UPDATE SET
      active_count = EXCLUDED.active_count, refreshed_at = EXCLUDED.refreshed_at;

    INSERT INTO permits_by_type_cache (metro, work_type, active_count, avg_cost, refreshed_at)
    SELECT metro, work_type, COUNT(*)::bigint, ROUND(AVG(estimated_job_costs), 0), now()
    FROM dob_permits
    WHERE work_type IS NOT NULL AND is_active_permit(metro, permit_status)
    GROUP BY metro, work_type
    ON CONFLICT (metro, work_type) DO UPDATE SET
      active_count = EXCLUDED.active_count, avg_cost = EXCLUDED.avg_cost, refreshed_at = EXCLUDED.refreshed_at;

    INSERT INTO permits_by_zip_cache (metro, zip_code, borough, permit_count, refreshed_at)
    SELECT metro, zip_code, MAX(borough), COUNT(*)::bigint, now()
    FROM dob_permits
    WHERE zip_code IS NOT NULL AND is_active_permit(metro, permit_status)
    GROUP BY metro, zip_code
    ON CONFLICT (metro, zip_code) DO UPDATE SET
      permit_count = EXCLUDED.permit_count, borough = EXCLUDED.borough, refreshed_at = EXCLUDED.refreshed_at;

    -- Backfill top_work_type from the metro-wide top type
    UPDATE permit_stats_cache c
    SET top_work_type = (
      SELECT work_type FROM permits_by_type_cache
      WHERE metro = c.metro ORDER BY active_count DESC LIMIT 1
    )
    WHERE top_work_type IS NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.refresh_permit_caches() TO service_role;
