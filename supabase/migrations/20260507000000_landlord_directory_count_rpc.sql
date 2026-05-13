-- Returns the planner's row estimate for the landlord directory's filtered set.
-- Uses EXPLAIN (FORMAT JSON) which runs in ~100ms instead of an exact COUNT(*)
-- which takes 11s+ on nyc and exceeds the anon role's 8s statement_timeout.
-- The landlord directory page used to call PostgREST count=estimated, which
-- silently fell back to an exact count and timed out — leaving the hero
-- showing "0 indexed".
--
-- The GARBAGE list MUST stay in sync with GARBAGE_NAMES in
-- src/app/[city]/landlords/page.tsx.
CREATE OR REPLACE FUNCTION public.get_landlord_directory_count(p_metro text)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SET statement_timeout = '3s'
AS $func$
DECLARE
  plan_json jsonb;
BEGIN
  EXECUTE
    $sql$EXPLAIN (FORMAT JSON) SELECT 1 FROM public.landlord_stats_canonical
         WHERE metro = $1
           AND name NOT IN (
             'AVAILABLE FROM DATA SOURCE','NAME NOT ON FILE','NOT AVAILABLE',
             'NOT AVAILABLE FROM THE DATA','NOT AVAILABLE FROM THE DATA SOURCE',
             'UNKNOWN','UNKNOWN OWNER','N/A','NA',
             'UNAVAILABLE','UNAVAILABLE OWNER','Taxpayer Unknown'
           )$sql$
    INTO plan_json
    USING p_metro;

  RETURN COALESCE((plan_json->0->'Plan'->>'Plan Rows')::bigint, 0);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.get_landlord_directory_count(text) TO anon, authenticated;
