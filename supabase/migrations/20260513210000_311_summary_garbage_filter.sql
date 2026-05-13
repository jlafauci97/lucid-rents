-- ============================================================================
-- get_top_landlords_by_311 — apply garbage filter at RPC level
--
-- Background: the underlying MV (landlord_311_summary) only filters a small
-- exact-match list of placeholder names ("AVAILABLE FROM DATA SOURCE", etc.).
-- It didn't catch:
--   - Case/punctuation variants ("Taxpayer Of" vs "TAXPAYER OF")
--   - Government / public-agency owners (City of Chicago, Cook County, CTA,
--     IL DOT, Chicago Park District, Chicago Housing Authority, etc.)
--   - Title-holding land trusts (Chicago Title Land Trust Company, LaSalle
--     Bank Trustee, Parkway Bank Trustee, Marquette Bank — they hold legal
--     title but aren't the operating landlord)
--   - "Taxpayer Of" / "Real Estate Taxpayer" / etc.
--
-- Without these filters, the Hall of Shame on /[city]/landlords ranked
-- government entities and title trusts as the worst landlords.
--
-- Approach: filter at the RPC level (cheap) instead of rebuilding the 48MB
-- materialized view. Read top-100 by complaints, then exclude garbage and
-- LIMIT after — gives effectively the same top-N for any p_limit ≤ 50.
-- The same pattern list is mirrored in:
--   - src/app/[city]/landlords/page.tsx (GARBAGE_NAMES, query-time filter)
--   - 20260428200000_landlord_stats_canonical.sql (refresh function)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_top_landlords_by_311(
  p_limit int DEFAULT 3,
  p_metro text DEFAULT 'nyc'
)
RETURNS TABLE (
  name             text,
  building_count   int,
  complaint_count  bigint,
  slug             text
)
LANGUAGE sql
STABLE
AS $$
  WITH top AS (
    SELECT s.name, s.building_count, s.complaint_count, s.metro
    FROM landlord_311_summary s
    WHERE s.metro = p_metro
      AND s.name IS NOT NULL
      AND s.name NOT IN (
        'AVAILABLE FROM DATA SOURCE','NAME NOT ON FILE','NOT AVAILABLE',
        'NOT AVAILABLE FROM THE DATA','NOT AVAILABLE FROM THE DATA SOURCE',
        'FROM THE DATA SOURCE NOT','UNKNOWN','UNKNOWN OWNER','CURRENT OWNER',
        'N/A','NA','UNAVAILABLE','UNAVAILABLE OWNER','Taxpayer Unknown',
        'RAILROAD'
      )
      AND UPPER(s.name) NOT LIKE '%TAXPAYER%'
      AND UPPER(s.name) NOT LIKE 'CITY OF CHICAGO%'
      AND UPPER(s.name) NOT LIKE 'COUNTY OF COOK%'
      AND UPPER(s.name) NOT LIKE 'COOK COUNTY%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO CITY%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO HEIGHTS%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO TITLE%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO HSING%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO HOUSING%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO BOARD OF ED%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO PARK DIST%'
      AND UPPER(s.name) NOT LIKE 'CHICAGO TRANSIT%'
      AND UPPER(s.name) NOT LIKE 'IL DEPT%'
      AND UPPER(s.name) NOT LIKE 'IL ST TOLL%'
      AND UPPER(s.name) NOT LIKE 'IL MEDICAL DIST%'
      AND UPPER(s.name) NOT LIKE 'IL HSE DEVL%'
      AND UPPER(s.name) NOT LIKE 'METRO WATER%'
      AND UPPER(s.name) NOT LIKE 'PARKWAY BANK%'
      AND UPPER(s.name) NOT LIKE 'PARKWAY BK%'
      AND UPPER(s.name) NOT LIKE 'LASALLE BANK%'
      AND UPPER(s.name) NOT LIKE 'MARQUETTE BANK%'
      AND UPPER(s.name) NOT LIKE 'CATHOLIC BISHOP%'
      AND UPPER(s.name) NOT LIKE 'COM ED%'
      AND UPPER(s.name) NOT LIKE 'COMM ED%'
      AND UPPER(s.name) NOT LIKE 'ROBBINS VILLAGE%'
    ORDER BY s.complaint_count DESC
    LIMIT p_limit
  )
  SELECT
    t.name,
    t.building_count,
    t.complaint_count,
    (
      SELECT ls.slug
      FROM landlord_stats ls
      WHERE ls.metro = t.metro
        AND UPPER(TRIM(ls.name)) = UPPER(TRIM(t.name))
      ORDER BY ls.building_count DESC NULLS LAST
      LIMIT 1
    ) AS slug
  FROM top t
  ORDER BY t.complaint_count DESC;
$$;
