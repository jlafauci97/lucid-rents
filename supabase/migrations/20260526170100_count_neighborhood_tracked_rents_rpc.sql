-- RPC for the Related rail's "Comparable {neighborhood} rentals" anchor.
-- Counts distinct buildings in a zip that have any building_rents row with a
-- non-null median_rent. Called via .rpc() in RelatedLinksStreamed so we don't
-- need to round-trip 2K building IDs through a PostgREST IN clause (URL-length
-- limited). Wrapped in unstable_cache on the Next side so each (metro, zip)
-- only hits the DB once per hour.

CREATE OR REPLACE FUNCTION count_neighborhood_tracked_rents(
  p_zip text,
  p_metro text,
  p_exclude_id uuid
) RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT br.building_id)::int
  FROM building_rents br
  JOIN buildings b ON b.id = br.building_id
  WHERE b.zip_code = p_zip
    AND b.metro = p_metro
    AND b.id != p_exclude_id
    AND br.median_rent IS NOT NULL;
$$;
