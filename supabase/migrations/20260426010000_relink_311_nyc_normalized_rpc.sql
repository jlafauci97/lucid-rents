-- Whitespace-tolerant relink of NYC 311 → buildings.
--
-- Why this exists:
-- After the 7-year backfill, ~9.7M of 15.6M NYC 311 rows were unlinked. A
-- sample analysis showed that ~93% of unlinked-with-address rows parse cleanly
-- with the linker regex, but never match buildings via exact equality because
-- NYC 311 pads numbered cross-streets with extra whitespace:
--   311:        "635 EAST  229 STREET"   (double space)
--   buildings:  "EAST 229 STREET"        (single space)
--   311:        "226 BEACH   98 STREET"  (triple space)
--   311:        "455 B   38 STREET"      (multi space)
-- Some 311 addresses also use alphanumeric house numbers ("616A ACADEMY
-- STREET") which the original `^(\d[\d\-]*)\s+` regex rejects.
--
-- This RPC re-runs the linker over a configurable created_date window with:
--   - looser regex: house# may carry one trailing letter (616A → 616A)
--   - normalized house#: strip non-digit/non-hyphen tail (616A → 616)
--   - normalized street: collapse all internal whitespace runs to one space
--                        and uppercase + trim
-- The buildings side stays unmodified, so the existing
-- (street_name, house_number) btree continues to drive the join.
--
-- Caller advances a date cursor and invokes one window per call. Real gaps
-- (street-level reports, parks, vacant lots) stay unlinked and don't get
-- reprocessed because we move forward by date, not by orphan-scan.
CREATE OR REPLACE FUNCTION public.relink_311_nyc_normalized_range(
  start_date timestamptz,
  end_date   timestamptz
)
RETURNS TABLE(processed int, linked int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
SET statement_timeout TO '120s'
AS $$
DECLARE
  v_processed int := 0;
  v_linked    int := 0;
BEGIN
  WITH candidates AS (
    SELECT
      c.unique_key,
      c.incident_address
    FROM public.complaints_311 c
    WHERE c.metro = 'nyc'
      AND c.building_id IS NULL
      AND c.incident_address IS NOT NULL
      AND c.created_date >= start_date
      AND c.created_date <  end_date
  ),
  parsed AS (
    -- Loose regex: digits, optional hyphenated digits, optional ONE trailing letter.
    -- Captures: hnum_raw (e.g. "616A", "100-12", "455"), street_raw (rest).
    SELECT
      cand.unique_key,
      m[1] AS hnum_raw,
      m[2] AS street_raw
    FROM candidates cand
    CROSS JOIN LATERAL regexp_match(
      cand.incident_address,
      '^(\d[\d\-]*[A-Za-z]?)\s+(.+)$'
    ) AS m
    WHERE m IS NOT NULL
  ),
  normalized AS (
    SELECT
      p.unique_key,
      -- Strip any non-digit / non-hyphen char from house#. "616A" → "616".
      regexp_replace(p.hnum_raw, '[^0-9\-]', '', 'g') AS hnum,
      -- Collapse all internal whitespace runs into a single space.
      -- Buildings store "EAST 229 STREET" so we must produce the same form.
      regexp_replace(upper(trim(p.street_raw)), '\s+', ' ', 'g') AS street
    FROM parsed p
  ),
  resolved AS (
    SELECT DISTINCT ON (n.unique_key) n.unique_key, b.id AS bid
    FROM normalized n
    JOIN public.buildings b
      ON b.metro = 'nyc'
     AND b.street_name = n.street
     AND b.house_number = n.hnum
    WHERE n.hnum   IS NOT NULL AND n.hnum   <> ''
      AND n.street IS NOT NULL AND n.street <> ''
    ORDER BY n.unique_key, b.id
  ),
  upd AS (
    UPDATE public.complaints_311 c
       SET building_id = r.bid
      FROM resolved r
     WHERE c.unique_key = r.unique_key
       AND c.metro = 'nyc'
    RETURNING 1
  )
  SELECT
    (SELECT count(*) FROM candidates),
    (SELECT count(*) FROM upd)
  INTO v_processed, v_linked;

  RETURN QUERY SELECT v_processed, v_linked;
END;
$$;

GRANT EXECUTE ON FUNCTION public.relink_311_nyc_normalized_range(timestamptz, timestamptz) TO service_role;
