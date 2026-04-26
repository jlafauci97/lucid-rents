-- Bulk 311 → building linker for NYC.
--
-- Parses incident_address into house_number + street_name and joins to
-- buildings on the existing idx_buildings_street_address index. Intended for
-- batch backfill runs where the per-address REST lookup in the sync route is
-- too slow (millions of unlinked rows).
--
-- Returns the number of rows updated in this call. Caller loops until it
-- returns < chunk_size / until returns 0.
CREATE OR REPLACE FUNCTION public.link_311_nyc_bulk(chunk_size int DEFAULT 10000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '120s'
AS $$
DECLARE
  linked int := 0;
BEGIN
  WITH candidates AS (
    SELECT
      c.unique_key,
      (regexp_match(c.incident_address, '^(\d[\d\-]*)\s+(.+)$'))[1] AS hnum,
      (regexp_match(c.incident_address, '^(\d[\d\-]*)\s+(.+)$'))[2] AS street
    FROM public.complaints_311 c
    WHERE c.metro = 'nyc'
      AND c.building_id IS NULL
      AND c.incident_address IS NOT NULL
    LIMIT chunk_size
  ),
  resolved AS (
    SELECT DISTINCT ON (cand.unique_key) cand.unique_key, b.id AS bid
    FROM candidates cand
    JOIN public.buildings b
      ON b.metro = 'nyc'
     AND b.street_name = cand.street
     AND b.house_number = cand.hnum
    WHERE cand.hnum IS NOT NULL AND cand.street IS NOT NULL
    ORDER BY cand.unique_key, b.id
  ),
  upd AS (
    UPDATE public.complaints_311 c
       SET building_id = r.bid
      FROM resolved r
     WHERE c.unique_key = r.unique_key
       AND c.metro = 'nyc'
    RETURNING 1
  )
  SELECT count(*) INTO linked FROM upd;

  RETURN linked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_311_nyc_bulk(int) TO service_role;
