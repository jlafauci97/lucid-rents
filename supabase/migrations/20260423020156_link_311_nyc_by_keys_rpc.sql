-- Keyed variant of link_311_nyc_bulk: link only the specified unique_keys.
-- Faster than a bulk orphan scan because we index-seek on (unique_key, metro)
-- instead of filtering WHERE building_id IS NULL across millions of rows.
-- Used by scripts/backfill-nyc-311-historical.mjs per-page after upserts.
CREATE OR REPLACE FUNCTION public.link_311_nyc_by_keys(keys text[])
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '60s'
AS $$
DECLARE
  linked int := 0;
BEGIN
  IF keys IS NULL OR array_length(keys, 1) IS NULL THEN
    RETURN 0;
  END IF;

  WITH candidates AS (
    SELECT
      c.unique_key,
      (regexp_match(c.incident_address, '^(\d[\d\-]*)\s+(.+)$'))[1] AS hnum,
      (regexp_match(c.incident_address, '^(\d[\d\-]*)\s+(.+)$'))[2] AS street
    FROM public.complaints_311 c
    WHERE c.metro = 'nyc'
      AND c.unique_key = ANY(keys)
      AND c.building_id IS NULL
      AND c.incident_address IS NOT NULL
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

GRANT EXECUTE ON FUNCTION public.link_311_nyc_by_keys(text[]) TO service_role;
