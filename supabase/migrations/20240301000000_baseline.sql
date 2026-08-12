-- Baseline schema (generated from prod dump)
-- Creates the base objects that predate the migration history: tables, functions,
-- and supporting objects that exist in production but are not created by any
-- migration file. Everything created by later migrations is intentionally excluded.
SET check_function_bodies = false;

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;



--
-- Name: apply_chicago_by_address_chunk(uuid, uuid, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.apply_chicago_by_address_chunk(p_cursor uuid, p_max uuid, p_limit integer) RETURNS TABLE(new_cursor uuid, scanned integer, updated integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_new_cursor uuid;
  v_scanned int;
  v_updated int;
BEGIN
  WITH cand AS (
    SELECT b.id,
           norm_miami_address(b.house_number || ' ' || b.street_name) AS akey
    FROM buildings b
    WHERE b.metro = 'chicago'
      AND (b.pin IS NULL OR b.pin = '')               -- only the un-pinned residue
      AND b.house_number IS NOT NULL AND b.street_name IS NOT NULL
      AND (b.owner_name IS NULL OR b.owner_name !~ '\s')  -- still bad
      AND b.id > p_cursor AND b.id <= p_max
    ORDER BY b.id
    LIMIT p_limit
  ),
  upd AS (
    UPDATE buildings b
    SET owner_name = c.mail_address_name
    FROM cand
    JOIN cook_county_owners c ON c.prop_address_key = cand.akey
    WHERE b.id = cand.id
      AND c.mail_address_name ~ '\s'
      AND b.owner_name IS DISTINCT FROM c.mail_address_name
    RETURNING b.id
  )
  SELECT
    (SELECT id FROM cand ORDER BY id DESC LIMIT 1),
    (SELECT count(*)::int FROM cand),
    (SELECT count(*)::int FROM upd)
  INTO v_new_cursor, v_scanned, v_updated;

  new_cursor := v_new_cursor;
  scanned   := COALESCE(v_scanned, 0);
  updated   := COALESCE(v_updated, 0);
  RETURN NEXT;
END;
$$;

--
-- Name: apply_hpd_contact_links(jsonb); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.apply_hpd_contact_links(pairs jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE hpd_contacts c
  SET building_id = (p->>'bid')::uuid
  FROM jsonb_array_elements(pairs) p
  WHERE c.id = (p->>'id')::uuid
    AND c.building_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

--
-- Name: apply_hpd_registration_links(jsonb); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.apply_hpd_registration_links(pairs jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  SET LOCAL session_replication_role = replica;
  UPDATE hpd_registrations r
  SET building_id = (p->>'bid')::uuid
  FROM jsonb_array_elements(pairs) p
  WHERE r.id = (p->>'id')::uuid
    AND r.building_id IS NULL;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

--
-- Name: audit_nyc_coverage_batch(uuid[], date); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.audit_nyc_coverage_batch(p_ids uuid[], p_cutoff date) RETURNS TABLE(building_id uuid, hpd_total bigint, hpd_7y bigint, last_hpd date, c311_total bigint, c311_7y bigint, last_311 date, rent_sources integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT
    b.id,
    COALESCE(h.total, 0),
    COALESCE(h.recent, 0),
    h.last_d,
    COALESCE(c.total, 0),
    COALESCE(c.recent, 0),
    c.last_d,
    COALESCE(r.sources, 0)::int
  FROM unnest(p_ids) AS b(id)
  LEFT JOIN LATERAL (
    SELECT COUNT(*) total,
           COUNT(*) FILTER (WHERE inspection_date >= p_cutoff) recent,
           MAX(inspection_date) last_d
    FROM hpd_violations
    WHERE building_id = b.id
  ) h ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) total,
           COUNT(*) FILTER (WHERE created_date >= p_cutoff) recent,
           MAX(created_date::date) last_d
    FROM complaints_311_nyc
    WHERE building_id = b.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT source) sources
    FROM building_rents
    WHERE building_id = b.id
  ) r ON true;
$$;

--
-- Name: backfill_buildings_owner_name_by_bbl(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backfill_buildings_owner_name_by_bbl(boro_prefix text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH latest_corp AS (
    SELECT DISTINCT ON (r.bbl)
      r.bbl,
      c.corporation_name
    FROM hpd_registrations r
    JOIN hpd_contacts c ON c.registration_id = r.registration_id
    WHERE r.bbl IS NOT NULL
      AND c.contact_type = 'CorporateOwner'
      AND c.corporation_name IS NOT NULL
      AND (boro_prefix IS NULL OR r.bbl LIKE boro_prefix || '%')
    ORDER BY r.bbl,
      COALESCE(r.registration_end_date, r.last_registration_date) DESC NULLS LAST
  )
  UPDATE buildings b
  SET owner_name = lc.corporation_name
  FROM latest_corp lc
  WHERE b.bbl = lc.bbl
    AND b.metro = 'nyc'
    AND (b.owner_name IS NULL OR b.owner_name = '');

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

--
-- Name: backfill_flood_zones_chunk(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backfill_flood_zones_chunk(p_metro text, p_limit integer DEFAULT 100) RETURNS TABLE(processed integer, updated integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  _processed integer := 0;
  _updated integer := 0;
begin
  with candidates as (
    select b.id, b.latitude, b.longitude
    from buildings b
    where b.metro = p_metro
      and b.latitude is not null
      and b.longitude is not null
      and b.flood_zone is null
    order by b.id
    limit p_limit
    for update skip locked
  ),
  resolved as (
    select
      c.id,
      coalesce(
        (
          select fz.zone_code
          from flood_zones fz
          where fz.metro = p_metro
            and extensions.ST_Contains(
              fz.geom,
              extensions.ST_SetSRID(
                extensions.ST_MakePoint(c.longitude::double precision, c.latitude::double precision),
                4326
              )
            )
          order by case fz.zone_code
            when 'VE' then 1 when 'V' then 2
            when 'AE' then 3 when 'A' then 4
            when 'AO' then 5 when 'AH' then 6
            when 'X'  then 7 when 'D' then 8
            else 9
          end
          limit 1
        ),
        'UNMAPPED'
      ) as zone_code
    from candidates c
  ),
  upd as (
    update buildings b
    set flood_zone = r.zone_code
    from resolved r
    where b.id = r.id
    returning b.id, r.zone_code
  )
  select count(*)::integer,
         count(*) filter (where zone_code <> 'UNMAPPED')::integer
  into _processed, _updated
  from upd;

  return query select _processed, _updated;
end;
$$;

--
-- Name: backfill_flood_zones_for_metro(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backfill_flood_zones_for_metro(p_metro text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  updated_count integer := 0;
begin
  with candidates as (
    select b.id, b.latitude, b.longitude
    from buildings b
    where b.metro = p_metro
      and b.latitude is not null
      and b.longitude is not null
  ),
  matched as (
    select
      c.id,
      (
        select fz.zone_code
        from flood_zones fz
        where fz.metro = p_metro
          and extensions.ST_Contains(
            fz.geom,
            extensions.ST_SetSRID(
              extensions.ST_MakePoint(c.longitude::double precision, c.latitude::double precision),
              4326
            )
          )
        order by case fz.zone_code
          when 'VE' then 1 when 'V' then 2
          when 'AE' then 3 when 'A' then 4
          when 'AO' then 5 when 'AH' then 6
          when 'X'  then 7 when 'D' then 8
          else 9
        end
        limit 1
      ) as zone_code
    from candidates c
  )
  update buildings b
  set flood_zone = m.zone_code
  from matched m
  where b.id = m.id
    and m.zone_code is not null
    and (b.flood_zone is distinct from m.zone_code);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

--
-- Name: backfill_metro_fmr_fallback(text, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backfill_metro_fmr_fallback(p_metro text, p_avg_0br integer, p_avg_1br integer, p_avg_2br integer, p_avg_3br integer, p_avg_4br integer) RETURNS integer
    LANGUAGE plpgsql
    SET statement_timeout TO '600s'
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  total_inserted int := 0;
  cnt int;
  bed int;
  fmr int;
  vals int[] := ARRAY[p_avg_0br, p_avg_1br, p_avg_2br, p_avg_3br, p_avg_4br];
BEGIN
  FOR bed IN 0..4 LOOP
    fmr := vals[bed + 1];
    IF fmr > 0 THEN
      INSERT INTO building_rents (building_id, source, bedrooms, min_rent, max_rent, median_rent, listing_count)
      SELECT b.id, 'hud_fmr', bed, ROUND(fmr * 0.85), ROUND(fmr * 1.15), fmr, 0
      FROM buildings b
      WHERE b.metro = p_metro
        AND NOT EXISTS (SELECT 1 FROM building_rents br WHERE br.building_id = b.id)
      ON CONFLICT (building_id, source, bedrooms) DO NOTHING;
      
      GET DIAGNOSTICS cnt = ROW_COUNT;
      total_inserted := total_inserted + cnt;
    END IF;
  END LOOP;
  RETURN total_inserted;
END;
$$;

--
-- Name: backfill_zip_centroid_single(uuid); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backfill_zip_centroid_single(p_id uuid) RETURNS character varying
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_zip varchar;
BEGIN
  UPDATE buildings SET zip_code = (
    SELECT zc.zip_code FROM zip_centroids zc
    WHERE zc.metro = buildings.metro
    ORDER BY (zc.avg_lat::float8 - buildings.latitude::float8) * (zc.avg_lat::float8 - buildings.latitude::float8)
           + (zc.avg_lon::float8 - buildings.longitude::float8) * (zc.avg_lon::float8 - buildings.longitude::float8)
    LIMIT 1)
  WHERE id = p_id
    AND zip_code IS NULL
    AND latitude IS NOT NULL
    AND longitude IS NOT NULL
  RETURNING zip_code INTO v_zip;
  RETURN v_zip;
END;
$$;

--
-- Name: backup_review_original(uuid, character varying, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backup_review_original(p_review_id uuid, p_title character varying, p_body text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO private.reviews_original (review_id, original_title, original_body)
  VALUES (p_review_id, p_title, p_body)
  ON CONFLICT (review_id) DO NOTHING;
END;
$$;

--
-- Name: backup_reviews_batch(jsonb); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.backup_reviews_batch(p_data jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO private.reviews_original (review_id, original_title, original_body)
  SELECT
    (elem->>'review_id')::uuid,
    elem->>'original_title',
    elem->>'original_body'
  FROM jsonb_array_elements(p_data) AS elem
  ON CONFLICT (review_id) DO NOTHING;
END;
$$;

--
-- Name: batch_update_parcel_ids(jsonb); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.batch_update_parcel_ids(p_updates jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  rec jsonb;
  updated int := 0;
BEGIN
  FOR rec IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    BEGIN
      UPDATE buildings SET
        bbl = COALESCE((rec->>'bbl'), bbl),
        apn = COALESCE((rec->>'apn'), apn),
        pin = COALESCE((rec->>'pin'), pin),
        folio_number = COALESCE((rec->>'folio_number'), folio_number),
        hcad_account = COALESCE((rec->>'hcad_account'), hcad_account),
        zip_code = COALESCE((rec->>'zip_code'), zip_code)
      WHERE id = (rec->>'id')::uuid;
      updated := updated + 1;
    EXCEPTION WHEN unique_violation THEN
      -- Skip duplicates
      NULL;
    END;
  END LOOP;
  RETURN updated;
END;
$$;

--
-- Name: bulk_link_311(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311(target_metro text, batch_limit integer DEFAULT 10000) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  linked int;
BEGIN
  WITH to_link AS (
    SELECT c.id as complaint_id, m.building_id
    FROM complaints_311 c
    JOIN _addr_link_map m 
      ON UPPER(TRIM(c.incident_address)) = m.norm_addr 
      AND m.metro = target_metro
    WHERE c.metro = target_metro 
      AND c.building_id IS NULL 
      AND c.incident_address IS NOT NULL 
      AND c.incident_address != ''
    LIMIT batch_limit
  )
  UPDATE complaints_311 c2
  SET building_id = tl.building_id
  FROM to_link tl
  WHERE c2.id = tl.complaint_id;
  
  GET DIAGNOSTICS linked = ROW_COUNT;
  RETURN linked;
END;
$$;

--
-- Name: bulk_link_311_addr_cursor(text, integer, timestamp with time zone); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311_addr_cursor(p_metro text, p_limit integer DEFAULT 200, p_before_date timestamp with time zone DEFAULT '9999-12-31 00:00:00+00'::timestamp with time zone) RETURNS TABLE(linked integer, last_date timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_count int;
  v_last timestamptz;
BEGIN
  WITH src AS (
    SELECT id as cid,
           created_date as cd,
           -- Strip trailing CITY ST ZIP variants (commas optional, zip optional comma):
           --   ", LOS ANGELES, CA, 90064"  → drop everything from first comma
           --   " HOUSTON TX 77075"          → drop city/state/zip
           regexp_replace(
             regexp_replace(
               regexp_replace(trim(incident_address), '\s+(HOUSTON|UNINCORPORATED|MIAMI|CHICAGO|LOS ANGELES|LA)\s+(TX|FL|IL|CA)\s+\d{5}.*$', '', 'i'),
               ',.*$', ''
             ),
             '\s+\d{5}(-\d{4})?$', ''
           ) as addr
    FROM complaints_311
    WHERE metro = p_metro
      AND building_id IS NULL
      AND incident_address IS NOT NULL
      AND created_date < p_before_date
    ORDER BY created_date DESC
    LIMIT p_limit
  ),
  cands AS (
    SELECT cid, cd,
           upper(split_part(addr, ' ', 1)) as hn,
           normalize_street(
             trim(substring(addr FROM position(' ' in addr)+1))
           ) as ns
    FROM src
    WHERE position(' ' in addr) > 0
  ),
  cap AS (SELECT cd FROM cands ORDER BY cd ASC LIMIT 1),
  matches AS (
    SELECT DISTINCT ON (c.cid) c.cid, b.id as bid
    FROM cands c
    JOIN buildings b
      ON b.metro = p_metro
      AND upper(b.house_number) = c.hn
      AND normalize_street(b.street_name) = c.ns
    WHERE c.hn != '' AND c.ns != ''
    ORDER BY c.cid, b.id
  ),
  upd AS (
    UPDATE complaints_311 t
    SET building_id = m.bid
    FROM matches m
    WHERE t.id = m.cid
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM upd)::int, (SELECT cd FROM cap)
  INTO v_count, v_last;

  linked := COALESCE(v_count, 0);
  last_date := COALESCE(v_last, p_before_date);
  RETURN NEXT;
END;
$_$;

--
-- Name: bulk_link_311_by_address(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311_by_address(p_metro text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count int;
BEGIN
  UPDATE complaints_311 t
  SET building_id = b.id
  FROM buildings b
  WHERE t.building_id IS NULL
    AND t.metro = p_metro
    AND b.metro = p_metro
    AND t.incident_address IS NOT NULL
    -- Match house_number as first token of incident_address
    AND upper(split_part(t.incident_address, ' ', 1)) = upper(b.house_number)
    -- Match street_name as tokens 2-3 (handles most addresses)
    AND (
      upper(split_part(t.incident_address, ' ', 2) || ' ' || split_part(t.incident_address, ' ', 3)) LIKE upper(b.street_name) || '%'
      OR upper(split_part(t.incident_address, ' ', 2)) = upper(b.street_name)
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

--
-- Name: bulk_link_311_by_address(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311_by_address(p_metro text, p_limit integer DEFAULT 50000) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total int := 0;
  v_batch int;
BEGIN
  -- Link records one batch at a time using a LATERAL lookup per row
  WITH to_link AS (
    SELECT t.unique_key, b.id as building_id
    FROM (
      SELECT unique_key, incident_address
      FROM complaints_311
      WHERE metro = p_metro AND building_id IS NULL AND incident_address IS NOT NULL
      LIMIT p_limit
    ) t
    CROSS JOIN LATERAL (
      SELECT id FROM buildings 
      WHERE metro = p_metro
        AND upper(house_number) = upper(split_part(t.incident_address, ' ', 1))
        AND (
          upper(street_name) = upper(split_part(t.incident_address, ' ', 2))
          OR upper(street_name) = upper(split_part(t.incident_address, ' ', 2) || ' ' || split_part(t.incident_address, ' ', 3))
        )
      LIMIT 1
    ) b
  )
  UPDATE complaints_311 c
  SET building_id = tl.building_id
  FROM to_link tl
  WHERE c.unique_key = tl.unique_key AND c.metro = p_metro;
  
  GET DIAGNOSTICS v_total = ROW_COUNT;
  RETURN v_total;
END;
$$;

--
-- Name: bulk_link_311_v2(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311_v2(target_metro text, max_addrs integer DEFAULT 200) RETURNS TABLE(total_linked bigint, addrs_processed integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  addr_rec RECORD;
  linked_total bigint := 0;
  addrs_done int := 0;
  batch_linked bigint;
BEGIN
  FOR addr_rec IN 
    SELECT m.norm_addr, m.building_id
    FROM _addr_link_map m
    WHERE m.metro = target_metro
      AND EXISTS (
        SELECT 1 FROM complaints_311 c
        WHERE c.metro = target_metro
          AND c.building_id IS NULL
          AND UPPER(TRIM(c.incident_address)) = m.norm_addr
        LIMIT 1
      )
    LIMIT max_addrs
  LOOP
    UPDATE complaints_311
    SET building_id = addr_rec.building_id
    WHERE metro = target_metro
      AND building_id IS NULL
      AND UPPER(TRIM(incident_address)) = addr_rec.norm_addr;
    
    GET DIAGNOSTICS batch_linked = ROW_COUNT;
    linked_total := linked_total + batch_linked;
    addrs_done := addrs_done + 1;
  END LOOP;
  
  RETURN QUERY SELECT linked_total, addrs_done;
END;
$$;

--
-- Name: bulk_link_311_v3(text, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_311_v3(target_metro text, addr_offset integer DEFAULT 0, addr_limit integer DEFAULT 100) RETURNS TABLE(total_linked bigint, addrs_processed integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  addr_rec RECORD;
  linked_total bigint := 0;
  addrs_done int := 0;
  batch_linked bigint;
BEGIN
  FOR addr_rec IN 
    SELECT norm_addr, building_id
    FROM _addr_link_map
    WHERE metro = target_metro
    ORDER BY norm_addr
    OFFSET addr_offset
    LIMIT addr_limit
  LOOP
    UPDATE complaints_311
    SET building_id = addr_rec.building_id
    WHERE metro = target_metro
      AND building_id IS NULL
      AND UPPER(TRIM(incident_address)) = addr_rec.norm_addr;
    
    GET DIAGNOSTICS batch_linked = ROW_COUNT;
    linked_total := linked_total + batch_linked;
    addrs_done := addrs_done + 1;
  END LOOP;
  
  RETURN QUERY SELECT linked_total, addrs_done;
END;
$$;

--
-- Name: bulk_link_by_bbl(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_by_bbl(p_table text, p_limit integer DEFAULT 2000) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_sql text;
  v_count int;
BEGIN
  -- Force use of partial index idx_hpd_violations_unlinked_bbl by joining on bbl directly.
  -- The previous query had Postgres picking idx_hpd_violations_unlinked which scans
  -- all unlinked records and filters by bbl — slow because most unlinked rows have NULL bbl.
  v_sql := format($q$
    UPDATE %I t
    SET building_id = b.id
    FROM buildings b
    WHERE t.id IN (
      SELECT id FROM %I
      WHERE building_id IS NULL
        AND bbl IS NOT NULL
        AND bbl <> ''
        AND bbl ~ '^\d{10}$'
      ORDER BY bbl
      LIMIT %s
    )
    AND b.bbl = t.bbl
  $q$, p_table, p_table, p_limit);

  EXECUTE v_sql;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$_$;

--
-- Name: bulk_link_by_house_street(text, text, text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_by_house_street(p_table text, p_id_col text, p_metro text, p_limit integer DEFAULT 200) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_count int;
  v_sql text;
BEGIN
  v_sql := format($q$
    WITH cands AS (
      SELECT %I as cid, normalize_street(street_name) as ns, upper(house_number) as hn
      FROM %I
      WHERE building_id IS NULL
        AND metro = %L
        AND house_number IS NOT NULL
        AND street_name IS NOT NULL
      LIMIT %s
    ),
    matches AS (
      SELECT DISTINCT ON (c.cid) c.cid, b.id as bid
      FROM cands c
      JOIN buildings b 
        ON b.metro = %L
        AND normalize_street(b.street_name) = c.ns
        AND upper(b.house_number) = c.hn
      ORDER BY c.cid, b.id
    )
    UPDATE %I t SET building_id = m.bid 
    FROM matches m 
    WHERE t.%I = m.cid
  $q$, p_id_col, p_table, p_metro, p_limit, p_metro, p_table, p_id_col);
  
  EXECUTE v_sql;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$_$;

--
-- Name: bulk_link_by_house_street_cursor(text, text, text, integer, bigint); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_by_house_street_cursor(p_table text, p_id_col text, p_metro text, p_limit integer DEFAULT 200, p_after_id bigint DEFAULT 0) RETURNS TABLE(linked integer, max_id bigint)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_count int;
  v_max bigint;
  v_sql text;
BEGIN
  v_sql := format($q$
    WITH cands AS (
      SELECT %I as cid, normalize_street(street_name) as ns, upper(house_number) as hn
      FROM %I
      WHERE building_id IS NULL
        AND metro = %L
        AND house_number IS NOT NULL
        AND street_name IS NOT NULL
        AND %I > %s
      ORDER BY %I
      LIMIT %s
    ),
    cap AS (SELECT max(cid) as m FROM cands),
    matches AS (
      SELECT DISTINCT ON (c.cid) c.cid, b.id as bid
      FROM cands c
      JOIN buildings b 
        ON b.metro = %L
        AND normalize_street(b.street_name) = c.ns
        AND upper(b.house_number) = c.hn
      ORDER BY c.cid, b.id
    ),
    upd AS (
      UPDATE %I t SET building_id = m.bid 
      FROM matches m 
      WHERE t.%I = m.cid
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM upd)::int, (SELECT m FROM cap)
  $q$, p_id_col, p_table, p_metro, p_id_col, p_after_id, p_id_col, p_limit, p_metro, p_table, p_id_col);
  
  EXECUTE v_sql INTO v_count, v_max;
  linked := COALESCE(v_count, 0);
  max_id := COALESCE(v_max, p_after_id);
  RETURN NEXT;
END;
$_$;

--
-- Name: bulk_link_by_house_street_v2(text, text, text, integer, uuid); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_by_house_street_v2(p_table text, p_id_col text, p_metro text, p_limit integer DEFAULT 200, p_after_id uuid DEFAULT '00000000-0000-0000-0000-000000000000'::uuid) RETURNS TABLE(linked integer, last_id uuid)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_count int;
  v_last uuid;
  v_sql text;
BEGIN
  v_sql := format($q$
    WITH cands AS (
      SELECT %I as cid, normalize_street(street_name) as ns, upper(house_number) as hn
      FROM %I
      WHERE building_id IS NULL
        AND metro = %L
        AND house_number IS NOT NULL
        AND street_name IS NOT NULL
        AND %I > %L
      ORDER BY %I
      LIMIT %s
    ),
    cap AS (SELECT cid::text as m FROM cands ORDER BY cid DESC LIMIT 1),
    matches AS (
      SELECT DISTINCT ON (c.cid) c.cid, b.id as bid
      FROM cands c
      JOIN buildings b
        ON b.metro = %L
        AND normalize_street(b.street_name) = c.ns
        AND upper(b.house_number) = c.hn
      ORDER BY c.cid, b.id
    ),
    upd AS (
      UPDATE %I t SET building_id = m.bid
      FROM matches m
      WHERE t.%I = m.cid
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM upd)::int, ((SELECT m FROM cap))::uuid
  $q$, p_id_col, p_table, p_metro, p_id_col, p_after_id::text, p_id_col, p_limit, p_metro, p_table, p_id_col);

  EXECUTE v_sql INTO v_count, v_last;
  linked := COALESCE(v_count, 0);
  last_id := COALESCE(v_last, p_after_id);
  RETURN NEXT;
END;
$_$;

--
-- Name: bulk_link_complaints_311(text, timestamp with time zone, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_complaints_311(p_metro text, p_since timestamp with time zone DEFAULT (now() - '14 days'::interval), p_limit integer DEFAULT 50000) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_linked int;
BEGIN
  WITH candidates AS (
    SELECT
      unique_key,
      upper(split_part(trim(incident_address), ' ', 1)) AS hn,
      upper(trim(regexp_replace(
        substring(trim(incident_address) from '^\S+\s+(.*)$'),
        ',.*$', '', 'g'
      ))) AS sn
    FROM public.complaints_311
    WHERE building_id IS NULL
      AND incident_address IS NOT NULL
      AND metro = p_metro
      AND imported_at >= p_since
    LIMIT p_limit
  ),
  matched AS (
    SELECT DISTINCT ON (c.unique_key) c.unique_key, b.id AS bid
    FROM candidates c
    JOIN public.buildings b
      ON b.metro = p_metro
     AND upper(b.street_name) = c.sn
     AND upper(b.house_number) = c.hn
    WHERE c.hn IS NOT NULL AND c.sn IS NOT NULL AND length(c.sn) > 0
  )
  UPDATE public.complaints_311 c
  SET building_id = m.bid,
      link_attempted_at = now()
  FROM matched m
  WHERE c.unique_key = m.unique_key;
  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN coalesce(v_linked, 0);
END;
$_$;

--
-- Name: bulk_link_la_311(integer, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_la_311(p_limit integer DEFAULT 500, p_after_key text DEFAULT ''::text) RETURNS TABLE(linked integer, last_key text)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_count int := 0;
  v_last text;
BEGIN
  WITH candidates AS (
    SELECT 
      unique_key,
      -- Take only the street-address part (before the first comma)
      split_part(incident_address, ',', 1) as addr_only,
      -- House number = first token of address-only part
      split_part(split_part(incident_address, ',', 1), ' ', 1) as house_no,
      -- Street = everything after the first token
      trim(substring(split_part(incident_address, ',', 1) 
           from position(' ' in split_part(incident_address, ',', 1)) + 1)) as street_raw
    FROM complaints_311
    WHERE metro = 'los-angeles' 
      AND building_id IS NULL 
      AND incident_address IS NOT NULL
      AND unique_key > p_after_key
    ORDER BY unique_key
    LIMIT p_limit
  ),
  matches AS (
    SELECT c.unique_key, b.id as building_id
    FROM candidates c
    CROSS JOIN LATERAL (
      SELECT id FROM buildings
      WHERE metro = 'los-angeles'
        AND upper(house_number) = upper(c.house_no)
        AND normalize_street(street_name) = normalize_street(c.street_raw)
      LIMIT 1
    ) b
  ),
  updated AS (
    UPDATE complaints_311 t
    SET building_id = m.building_id
    FROM matches m
    WHERE t.unique_key = m.unique_key AND t.metro = 'los-angeles'
    RETURNING 1
  )
  SELECT 
    (SELECT COUNT(*) FROM updated)::int, 
    (SELECT MAX(unique_key) FROM candidates)
  INTO v_count, v_last;
  
  linked := v_count;
  last_key := COALESCE(v_last, p_after_key);
  RETURN NEXT;
END;
$$;

--
-- Name: bulk_link_la_single_address(text, integer, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_la_single_address(p_table text, p_limit integer DEFAULT 500, p_after_id text DEFAULT ''::text) RETURNS TABLE(linked integer, last_id text)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_sql text;
  v_count int := 0;
  v_last text;
BEGIN
  v_sql := format($q$
    WITH candidates AS (
      SELECT id, 
        -- Normalize: strip city/state/zip suffix, collapse whitespace
        regexp_replace(
          regexp_replace(trim(address), ',.*$', '', 'g'),  -- drop everything after first comma
          '\s+', ' ', 'g'  -- collapse multiple spaces
        ) as clean_addr
      FROM %I
      WHERE building_id IS NULL
        AND address IS NOT NULL
        AND id::text > %L
      ORDER BY id
      LIMIT %s
    ),
    parsed AS (
      SELECT 
        id, 
        clean_addr,
        split_part(clean_addr, ' ', 1) as house_no,
        trim(substring(clean_addr from position(' ' in clean_addr) + 1)) as street_raw
      FROM candidates
    ),
    matches AS (
      SELECT p.id, b.id as building_id
      FROM parsed p
      CROSS JOIN LATERAL (
        SELECT id FROM buildings
        WHERE metro = 'los-angeles'
          AND upper(house_number) = upper(p.house_no)
          AND normalize_street(street_name) = normalize_street(p.street_raw)
        LIMIT 1
      ) b
    ),
    updated AS (
      UPDATE %I t
      SET building_id = m.building_id
      FROM matches m
      WHERE t.id = m.id
      RETURNING 1
    )
    SELECT 
      (SELECT COUNT(*) FROM updated)::int as linked_count,
      (SELECT MAX(id::text) FROM candidates) as max_id
  $q$, p_table, p_after_id, p_limit, p_table);
  
  EXECUTE v_sql INTO v_count, v_last;
  
  linked := v_count;
  last_id := COALESCE(v_last, p_after_id);
  RETURN NEXT;
END;
$_$;

--
-- Name: bulk_link_to_buildings(text, text, text, text, text, timestamp with time zone, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_link_to_buildings(p_table text, p_id_col text, p_metro text, p_house_col text DEFAULT 'house_number'::text, p_street_col text DEFAULT 'street_name'::text, p_since timestamp with time zone DEFAULT (now() - '14 days'::interval), p_limit integer DEFAULT 50000) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_linked int;
BEGIN
  EXECUTE format($f$
    WITH unlinked AS (
      SELECT %I AS rec_id, upper(%I) AS hn, upper(%I) AS sn
      FROM public.%I
      WHERE building_id IS NULL
        AND metro = $1
        AND %I IS NOT NULL AND %I IS NOT NULL
        AND imported_at >= $2
      LIMIT $3
    ),
    matched AS (
      SELECT DISTINCT ON (u.rec_id) u.rec_id, b.id AS bid
      FROM unlinked u
      JOIN public.buildings b
        ON b.metro = $1
       AND upper(b.street_name) = u.sn
       AND upper(b.house_number) = u.hn
    )
    UPDATE public.%I t
    SET building_id = m.bid
    FROM matched m
    WHERE t.%I = m.rec_id
  $f$, p_id_col, p_house_col, p_street_col, p_table, p_house_col, p_street_col, p_table, p_id_col)
  USING p_metro, p_since, p_limit;

  GET DIAGNOSTICS v_linked = ROW_COUNT;
  RETURN coalesce(v_linked, 0);
END;
$_$;

--
-- Name: bulk_set_owner(uuid[], text[]); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bulk_set_owner(ids uuid[], names text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  updated int := 0;
BEGIN
  UPDATE buildings b
  SET owner_name = t.name
  FROM unnest(ids, names) AS t(id, name)
  WHERE b.id = t.id AND b.owner_name IS NULL;
  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated;
END;
$$;

--
-- Name: bump_building_updated_at_from_child(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.bump_building_updated_at_from_child() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
BEGIN
  -- NEW.building_id is present on every child table we attach this to.
  -- We don't compare OLD vs NEW because any upsert that touches a row at
  -- all should be considered a refresh worth re-crawling.
  UPDATE buildings SET updated_at = now() WHERE id = NEW.building_id;
  RETURN NEW;
END;
$$;

--
-- Name: create_311_indexes(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.create_311_indexes() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  SET LOCAL statement_timeout = '10min';
  
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_311_houston_unlinked_cursor 
  ON complaints_311 (unique_key) 
  WHERE metro = ''houston'' AND building_id IS NULL AND incident_address IS NOT NULL';
  
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_311_chicago_unlinked_cursor 
  ON complaints_311 (unique_key) 
  WHERE metro = ''chicago'' AND building_id IS NULL AND incident_address IS NOT NULL';
END;
$$;

--
-- Name: create_buildings_from_311(text, integer, timestamp with time zone); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.create_buildings_from_311(p_metro text, p_limit integer DEFAULT 200, p_before_date timestamp with time zone DEFAULT '9999-12-31 00:00:00+00'::timestamp with time zone) RETURNS TABLE(created integer, last_date timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_count int;
  v_last timestamptz;
  v_city text;
  v_state text;
BEGIN
  -- Match buildings table format per metro
  IF p_metro = 'houston' THEN
    v_city := 'Houston'; v_state := 'TX';
  ELSIF p_metro = 'chicago' THEN
    v_city := 'Chicago'; v_state := 'IL';
  ELSIF p_metro = 'miami' THEN
    v_city := 'Miami'; v_state := 'FL';
  ELSIF p_metro = 'los-angeles' THEN
    v_city := 'Los Angeles'; v_state := 'CA';
  ELSE
    v_city := initcap(p_metro); v_state := '';
  END IF;

  WITH src AS (
    SELECT id as cid,
           created_date as cd,
           latitude, longitude,
           -- Strip trailing CITY/ST/ZIP for cleaner address
           regexp_replace(
             regexp_replace(
               regexp_replace(trim(incident_address), '\s+(HOUSTON|UNINCORPORATED|MIAMI|CHICAGO|LOS ANGELES|LA)\s+(TX|FL|IL|CA)\s+\d{5}.*$', '', 'i'),
               ',.*$', ''
             ),
             '\s+\d{5}(-\d{4})?$', ''
           ) as addr
    FROM complaints_311
    WHERE metro = p_metro
      AND building_id IS NULL
      AND incident_address IS NOT NULL
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND created_date < p_before_date
    ORDER BY created_date DESC
    LIMIT p_limit
  ),
  parsed AS (
    SELECT cid, cd, latitude, longitude, addr,
           upper(split_part(addr, ' ', 1)) as hn,
           trim(substring(addr FROM position(' ' in addr)+1)) as street_raw
    FROM src
    WHERE position(' ' in addr) > 0
      AND split_part(addr, ' ', 1) ~ '^\d+$'
  ),
  -- Dedup by (hn, normalized_street) — only one new building per address even if many 311 hits today
  uniq AS (
    SELECT DISTINCT ON (hn, normalize_street(street_raw))
      cid, cd, latitude, longitude, hn, street_raw
    FROM parsed
    ORDER BY hn, normalize_street(street_raw), cd DESC
  ),
  cap AS (SELECT cd FROM uniq ORDER BY cd ASC LIMIT 1),
  -- Don't insert if a building with same hn + normalized street already exists
  to_insert AS (
    SELECT u.* FROM uniq u
    WHERE NOT EXISTS (
      SELECT 1 FROM buildings b
      WHERE b.metro = p_metro
        AND upper(b.house_number) = u.hn
        AND normalize_street(b.street_name) = normalize_street(u.street_raw)
    )
  ),
  ins AS (
    INSERT INTO buildings (
      metro, borough, city, state,
      house_number, street_name, full_address, slug,
      latitude, longitude
    )
    SELECT
      p_metro, v_city, v_city, v_state,
      hn, street_raw,
      hn || ' ' || street_raw || ', ' || v_city || ', ' || v_state,
      lower(regexp_replace(hn || '-' || street_raw, '[^a-zA-Z0-9]+', '-', 'g'))
        || '-' || substr(md5(hn || street_raw), 1, 6),
      latitude, longitude
    FROM to_insert
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM ins)::int, (SELECT cd FROM cap)
  INTO v_count, v_last;

  created := COALESCE(v_count, 0);
  last_date := COALESCE(v_last, p_before_date);
  RETURN NEXT;
END;
$_$;

--
-- Name: data_snapshot_counts(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.data_snapshot_counts(p_metro text DEFAULT NULL::text) RETURNS TABLE(hpd_violations_count bigint, complaints_311_count bigint, buildings_count bigint, hpd_litigations_count bigint, dob_violations_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET statement_timeout TO '15s'
    SET search_path TO 'public', 'pg_temp'
    AS $$
    SELECT
        CASE WHEN p_metro IS NULL THEN
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'hpd_violations')
        ELSE
            (SELECT count(*)::bigint FROM hpd_violations WHERE metro = p_metro)
        END as hpd_violations_count,
        CASE WHEN p_metro IS NULL THEN
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'complaints_311')
        ELSE
            (SELECT count(*)::bigint FROM complaints_311 WHERE metro = p_metro)
        END as complaints_311_count,
        CASE WHEN p_metro IS NULL THEN
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'buildings')
        ELSE
            (SELECT count(*)::bigint FROM buildings WHERE metro = p_metro)
        END as buildings_count,
        CASE WHEN p_metro IS NULL THEN
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'hpd_litigations')
        ELSE
            (SELECT count(*)::bigint FROM hpd_litigations WHERE metro = p_metro)
        END as hpd_litigations_count,
        CASE WHEN p_metro IS NULL THEN
            (SELECT reltuples::bigint FROM pg_class WHERE relname = 'dob_violations')
        ELSE
            (SELECT count(*)::bigint FROM dob_violations WHERE metro = p_metro)
        END as dob_violations_count;
$$;

--
-- Name: dedup_chicago_batch(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_chicago_batch(p_batch_size integer DEFAULT 50) RETURNS TABLE(groups_processed integer, rows_deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  rec RECORD;
  v_groups int := 0;
  v_deleted int := 0;
  v_keeper_id uuid;
  v_loser_ids uuid[];
BEGIN
  -- Find buildings that share an address with at least one other Chicago building
  -- Uses index scan on (metro, full_address) instead of GROUP BY
  FOR rec IN
    SELECT DISTINCT b1.full_address
    FROM buildings b1
    WHERE b1.metro = 'chicago' AND b1.full_address IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM buildings b2
        WHERE b2.metro = 'chicago'
          AND b2.full_address = b1.full_address
          AND b2.id != b1.id
      )
    LIMIT p_batch_size
  LOOP
    -- Pick keeper: prefer row with pin, then most non-null columns
    SELECT id INTO v_keeper_id FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago'
    ORDER BY (pin IS NOT NULL) DESC,
      (CASE WHEN house_number IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN street_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN zip_code IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN owner_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN longitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END)
    DESC, created_at ASC
    LIMIT 1;

    SELECT array_agg(id) INTO v_loser_ids FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago' AND id != v_keeper_id;

    IF v_loser_ids IS NOT NULL AND array_length(v_loser_ids, 1) > 0 THEN
      PERFORM dedup_building_group(v_keeper_id, v_loser_ids, '{}'::jsonb);
      v_deleted := v_deleted + array_length(v_loser_ids, 1);
    END IF;

    v_groups := v_groups + 1;
  END LOOP;

  groups_processed := v_groups;
  rows_deleted := v_deleted;
  RETURN NEXT;
END;
$$;

--
-- Name: dedup_chicago_fast(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_chicago_fast(p_batch_size integer DEFAULT 50) RETURNS TABLE(groups_processed integer, rows_deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  rec RECORD;
  v_groups int := 0;
  v_deleted int := 0;
  v_keeper_id uuid;
  v_loser_ids uuid[];
BEGIN
  FOR rec IN
    DELETE FROM _chicago_dedup_queue
    WHERE ctid IN (SELECT ctid FROM _chicago_dedup_queue LIMIT p_batch_size)
    RETURNING full_address
  LOOP
    -- Find all buildings at this address
    SELECT id INTO v_keeper_id FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago'
    ORDER BY (pin IS NOT NULL) DESC,
      (CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN longitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN owner_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END)
    DESC, created_at ASC
    LIMIT 1;

    SELECT array_agg(id) INTO v_loser_ids FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago' AND id != v_keeper_id;

    IF v_loser_ids IS NOT NULL AND array_length(v_loser_ids, 1) > 0 THEN
      PERFORM dedup_building_group(v_keeper_id, v_loser_ids, '{}'::jsonb);
      v_deleted := v_deleted + array_length(v_loser_ids, 1);
    END IF;

    v_groups := v_groups + 1;
  END LOOP;

  groups_processed := v_groups;
  rows_deleted := v_deleted;
  RETURN NEXT;
END;
$$;

--
-- Name: dedup_chicago_from_queue(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_chicago_from_queue(p_batch_size integer DEFAULT 50) RETURNS TABLE(groups_processed integer, rows_deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  rec RECORD;
  v_groups int := 0;
  v_deleted int := 0;
  v_keeper_id uuid;
  v_loser_ids uuid[];
BEGIN
  FOR rec IN
    DELETE FROM _chicago_dedup_queue
    WHERE full_address IN (
      SELECT full_address FROM _chicago_dedup_queue LIMIT p_batch_size
    )
    RETURNING full_address
  LOOP
    SELECT id INTO v_keeper_id FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago'
    ORDER BY (pin IS NOT NULL) DESC,
      (CASE WHEN house_number IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN street_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN zip_code IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN owner_name IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN longitude IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END)
    DESC, created_at ASC
    LIMIT 1;

    SELECT array_agg(id) INTO v_loser_ids FROM buildings
    WHERE full_address = rec.full_address AND metro = 'chicago' AND id != v_keeper_id;

    IF v_loser_ids IS NOT NULL AND array_length(v_loser_ids, 1) > 0 THEN
      PERFORM dedup_building_group(v_keeper_id, v_loser_ids, '{}'::jsonb);
      v_deleted := v_deleted + array_length(v_loser_ids, 1);
    END IF;

    v_groups := v_groups + 1;
  END LOOP;

  groups_processed := v_groups;
  rows_deleted := v_deleted;
  RETURN NEXT;
END;
$$;

--
-- Name: dedup_chicago_full(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_chicago_full(p_batch_size integer DEFAULT 200) RETURNS TABLE(total_groups integer, total_deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total_groups int := 0;
  v_total_deleted int := 0;
  v_result RECORD;
BEGIN
  SET LOCAL statement_timeout = '0';
  LOOP
    SELECT * INTO v_result FROM dedup_chicago_fast(p_batch_size);
    IF v_result.groups_processed = 0 THEN EXIT; END IF;
    v_total_groups := v_total_groups + v_result.groups_processed;
    v_total_deleted := v_total_deleted + v_result.rows_deleted;
  END LOOP;
  total_groups := v_total_groups;
  total_deleted := v_total_deleted;
  RETURN NEXT;
END;
$$;

--
-- Name: dedup_metro_batch(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_metro_batch(p_metro text, p_batch_size integer DEFAULT 100) RETURNS TABLE(groups_processed integer, rows_deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  rec RECORD;
  v_groups int := 0;
  v_deleted int := 0;
  v_keeper_id uuid;
  v_loser_ids uuid[];
  v_merge jsonb;
  v_natural_key text;
  v_row RECORD;
  v_keeper RECORD;
BEGIN
  -- Determine natural key for this metro
  v_natural_key := CASE p_metro
    WHEN 'nyc' THEN 'bbl'
    WHEN 'los-angeles' THEN 'apn'
    WHEN 'chicago' THEN 'pin'
    WHEN 'houston' THEN 'hcad_account'
    WHEN 'miami' THEN 'folio_number'
  END;

  SET LOCAL statement_timeout = '300s';

  -- Find duplicate groups for this metro
  FOR rec IN
    SELECT b.full_address, b.city
    FROM buildings b
    WHERE b.metro = p_metro AND b.full_address IS NOT NULL
    GROUP BY b.full_address, b.city
    HAVING COUNT(*) > 1
    LIMIT p_batch_size
  LOOP
    -- For NYC, skip groups where all BBLs are different (condo lots)
    IF p_metro = 'nyc' THEN
      -- Check if any BBLs are duplicated within this group
      IF NOT EXISTS (
        SELECT 1 FROM buildings
        WHERE full_address = rec.full_address AND metro = 'nyc' AND bbl IS NOT NULL
        GROUP BY bbl HAVING COUNT(*) > 1
      ) THEN
        CONTINUE;
      END IF;

      -- Dedup within each duplicated BBL sub-group
      FOR v_row IN
        SELECT bbl FROM buildings
        WHERE full_address = rec.full_address AND metro = 'nyc' AND bbl IS NOT NULL
        GROUP BY bbl HAVING COUNT(*) > 1
      LOOP
        -- Pick keeper: most non-null columns
        SELECT id INTO v_keeper_id FROM buildings
        WHERE full_address = rec.full_address AND metro = 'nyc' AND bbl = v_row.bbl
        ORDER BY (
          (CASE WHEN house_number IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN street_name IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN zip_code IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN owner_name IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN longitude IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END)
        ) DESC, created_at ASC
        LIMIT 1;

        SELECT array_agg(id) INTO v_loser_ids FROM buildings
        WHERE full_address = rec.full_address AND metro = 'nyc' AND bbl = v_row.bbl AND id != v_keeper_id;

        PERFORM dedup_building_group(v_keeper_id, v_loser_ids, '{}'::jsonb);
        v_deleted := v_deleted + array_length(v_loser_ids, 1);
      END LOOP;
    ELSE
      -- Non-NYC: pick keeper with natural key, most non-null columns
      EXECUTE format(
        'SELECT id FROM buildings WHERE full_address = $1 AND metro = $2 ORDER BY (%I IS NOT NULL) DESC, (
          (CASE WHEN house_number IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN street_name IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN zip_code IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN year_built IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN owner_name IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN latitude IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN longitude IS NOT NULL THEN 1 ELSE 0 END) +
          (CASE WHEN name IS NOT NULL THEN 1 ELSE 0 END)
        ) DESC, created_at ASC LIMIT 1',
        v_natural_key
      ) INTO v_keeper_id USING rec.full_address, p_metro;

      SELECT array_agg(id) INTO v_loser_ids FROM buildings
      WHERE full_address = rec.full_address AND metro = p_metro AND id != v_keeper_id;

      PERFORM dedup_building_group(v_keeper_id, v_loser_ids, '{}'::jsonb);
      v_deleted := v_deleted + array_length(v_loser_ids, 1);
    END IF;

    v_groups := v_groups + 1;
  END LOOP;

  groups_processed := v_groups;
  rows_deleted := v_deleted;
  RETURN NEXT;
END;
$_$;

--
-- Name: dedup_metro_full(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.dedup_metro_full(p_metro text, p_batch_size integer DEFAULT 200) RETURNS TABLE(total_groups integer, total_deleted integer, batches_run integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_total_groups int := 0;
  v_total_deleted int := 0;
  v_batches int := 0;
  v_result RECORD;
BEGIN
  SET LOCAL statement_timeout = '600s';
  
  LOOP
    SELECT * INTO v_result FROM dedup_metro_batch(p_metro, p_batch_size);
    
    IF v_result.groups_processed = 0 THEN
      EXIT;
    END IF;
    
    v_total_groups := v_total_groups + v_result.groups_processed;
    v_total_deleted := v_total_deleted + v_result.rows_deleted;
    v_batches := v_batches + 1;
    
    RAISE NOTICE '[%] Batch %: % groups, % rows deleted (total: % groups, % deleted)',
      p_metro, v_batches, v_result.groups_processed, v_result.rows_deleted, v_total_groups, v_total_deleted;
  END LOOP;
  
  total_groups := v_total_groups;
  total_deleted := v_total_deleted;
  batches_run := v_batches;
  RETURN NEXT;
END;
$$;

--
-- Name: delete_chicago_single_family_chunk(uuid, uuid, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.delete_chicago_single_family_chunk(p_cursor uuid, p_max uuid, p_limit integer) RETURNS TABLE(new_cursor uuid, scanned integer, deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_new_cursor uuid;
  v_scanned int;
  v_deleted int;
BEGIN
  WITH cand AS (
    SELECT b.id, REPLACE(b.pin, '-', '') AS pin14,
           COALESCE(b.review_count,0) + COALESCE(b.violation_count,0)
             + COALESCE(b.complaint_count,0) + COALESCE(b.litigation_count,0)
             + COALESCE(b.eviction_count,0) AS signal
    FROM buildings b
    WHERE b.metro = 'chicago'
      AND b.pin IS NOT NULL AND b.pin <> ''
      AND b.id > p_cursor AND b.id <= p_max
    ORDER BY b.id
    LIMIT p_limit
  ),
  to_delete AS (
    SELECT cand.id
    FROM cand
    JOIN cook_county_owners c ON c.pin = cand.pin14
    WHERE c.class IN ('202','203','204','205','206','207','208','209','210','211','212','234','240','241','295')
      AND cand.signal = 0
      AND NOT EXISTS (SELECT 1 FROM chicago_affordable_units    x WHERE x.building_id = cand.id)
      AND NOT EXISTS (SELECT 1 FROM chicago_demolitions         x WHERE x.building_id = cand.id)
      AND NOT EXISTS (SELECT 1 FROM chicago_lead_inspections    x WHERE x.building_id = cand.id)
      AND NOT EXISTS (SELECT 1 FROM chicago_rlto_violations     x WHERE x.building_id = cand.id)
      AND NOT EXISTS (SELECT 1 FROM chicago_rodent_complaints   x WHERE x.building_id = cand.id)
      AND NOT EXISTS (SELECT 1 FROM chicago_scofflaws           x WHERE x.building_id = cand.id)
  ),
  del AS (
    DELETE FROM buildings WHERE id IN (SELECT id FROM to_delete) RETURNING 1
  )
  SELECT
    (SELECT id FROM cand ORDER BY id DESC LIMIT 1),
    (SELECT count(*)::int FROM cand),
    (SELECT count(*)::int FROM del)
  INTO v_new_cursor, v_scanned, v_deleted;

  new_cursor := v_new_cursor;
  scanned   := COALESCE(v_scanned, 0);
  deleted   := COALESCE(v_deleted, 0);
  RETURN NEXT;
END;
$$;

--
-- Name: delete_la_single_family_chunk(uuid, uuid, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.delete_la_single_family_chunk(p_cursor uuid, p_max uuid, p_limit integer) RETURNS TABLE(new_cursor uuid, scanned integer, deleted integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_new_cursor uuid;
  v_scanned int;
  v_deleted int;
BEGIN
  WITH cand AS (
    SELECT b.id,
           COALESCE(b.review_count,0) + COALESCE(b.violation_count,0)
             + COALESCE(b.complaint_count,0) + COALESCE(b.litigation_count,0)
             + COALESCE(b.eviction_count,0) AS signal,
           b.land_use
    FROM buildings b
    WHERE b.metro = 'los-angeles'
      AND b.id > p_cursor AND b.id <= p_max
    ORDER BY b.id
    LIMIT p_limit
  ),
  to_delete AS (
    SELECT cand.id
    FROM cand
    WHERE cand.land_use = 'Single'
      AND cand.signal = 0
      AND NOT EXISTS (SELECT 1 FROM la_earthquake_retrofit  x WHERE x.building_id = cand.id)
  ),
  del AS (
    DELETE FROM buildings WHERE id IN (SELECT id FROM to_delete) RETURNING 1
  )
  SELECT
    (SELECT id FROM cand ORDER BY id DESC LIMIT 1),
    (SELECT count(*)::int FROM cand),
    (SELECT count(*)::int FROM del)
  INTO v_new_cursor, v_scanned, v_deleted;

  new_cursor := v_new_cursor;
  scanned   := COALESCE(v_scanned, 0);
  deleted   := COALESCE(v_deleted, 0);
  RETURN NEXT;
END;
$$;

--
-- Name: estimated_row_counts(text[]); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.estimated_row_counts(table_names text[]) RETURNS TABLE(table_name text, row_count bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT c.relname::text AS table_name, c.reltuples::bigint AS row_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = ANY(table_names);
$$;

--
-- Name: find_building_by_address_prefix(text, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.find_building_by_address_prefix(p_address text, p_metro text) RETURNS uuid
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_upper text := upper(trim(p_address));
  v_house_no text;
  v_street text;
  v_id uuid;
  v_space_pos int;
BEGIN
  -- Parse "123 MAIN ST ..." into house_number + street_name
  v_space_pos := position(' ' in v_upper);
  IF v_space_pos = 0 THEN RETURN NULL; END IF;

  v_house_no := substring(v_upper from 1 for v_space_pos - 1);
  v_street := trim(substring(v_upper from v_space_pos + 1));
  
  -- Only keep first N words of street (strip city/state if any slipped through)
  -- Take up to 4 words of street name
  v_street := (
    SELECT string_agg(word, ' ')
    FROM (
      SELECT word, row_number() OVER () as rn
      FROM unnest(string_to_array(v_street, ' ')) AS word
    ) sub
    WHERE rn <= 4
  );

  -- Match on exact house_number + street_name prefix (uses indexes)
  SELECT id INTO v_id FROM buildings
  WHERE metro = p_metro
  AND upper(house_number) = v_house_no
  AND upper(street_name) LIKE v_street || '%'
  LIMIT 1;
  
  RETURN v_id;
END;
$$;

--
-- Name: flood_zone_for_point(numeric, numeric); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.flood_zone_for_point(p_lat numeric, p_lng numeric) RETURNS TABLE(zone_code text, zone_subtype text, bfe numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select fz.zone_code, fz.zone_subtype, fz.bfe
  from flood_zones fz
  where extensions.ST_Contains(
    fz.geom,
    extensions.ST_SetSRID(extensions.ST_MakePoint(p_lng, p_lat), 4326)
  )
  order by case fz.zone_code
    when 'VE' then 1
    when 'V'  then 2
    when 'AE' then 3
    when 'A'  then 4
    when 'AO' then 5
    when 'AH' then 6
    when 'X'  then 7
    when 'D'  then 8
    else 9
  end
  limit 1;
$$;

--
-- Name: flood_zones_for_bbox(text, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.flood_zones_for_bbox(p_metro text, p_west numeric, p_south numeric, p_east numeric, p_north numeric) RETURNS TABLE(zone_code text, zone_subtype text, geom_geojson text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  select
    fz.zone_code,
    fz.zone_subtype,
    extensions.ST_AsGeoJSON(fz.geom) as geom_geojson
  from flood_zones fz
  where fz.metro = p_metro
    and extensions.ST_Intersects(
      fz.geom,
      extensions.ST_MakeEnvelope(p_west, p_south, p_east, p_north, 4326)
    );
$$;

--
-- Name: get_backed_up_review_ids(uuid[]); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.get_backed_up_review_ids(p_ids uuid[]) RETURNS TABLE(review_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  RETURN QUERY
  SELECT ro.review_id FROM private.reviews_original ro
  WHERE ro.review_id = ANY(p_ids);
END;
$$;

--
-- Name: get_buildings_missing_parcel(text, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.get_buildings_missing_parcel(p_metro text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0) RETURNS TABLE(id uuid, house_number character varying, street_name character varying, borough character varying, zip_code character varying, full_address text, latitude numeric, longitude numeric, slug text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT b.id, b.house_number, b.street_name, b.borough, b.zip_code,
         b.full_address, b.latitude, b.longitude, b.slug
  FROM buildings b
  WHERE b.metro = p_metro
    AND CASE p_metro
          WHEN 'nyc' THEN b.bbl IS NULL
          WHEN 'los-angeles' THEN b.apn IS NULL
          WHEN 'chicago' THEN b.pin IS NULL
          WHEN 'miami' THEN b.folio_number IS NULL
          WHEN 'houston' THEN b.hcad_account IS NULL
        END
  ORDER BY b.id
  OFFSET p_offset
  LIMIT p_limit;
$$;

--
-- Name: get_buildings_without_real_rents(text, text, integer, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.get_buildings_without_real_rents(p_metro text, p_borough text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0, p_min_units integer DEFAULT 1) RETURNS TABLE(id uuid, full_address text, borough text, zip_code text, slug text, residential_units integer)
    LANGUAGE sql STABLE
    SET statement_timeout TO '120s'
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT b.id, b.full_address, b.borough, b.zip_code, b.slug, b.residential_units
  FROM buildings b
  WHERE b.metro = p_metro
    AND (p_min_units <= 0 OR COALESCE(b.residential_units, 0) >= p_min_units)
    AND (p_borough IS NULL OR b.borough = p_borough)
    AND NOT EXISTS (
      SELECT 1 FROM building_rents br 
      WHERE br.building_id = b.id AND br.source != 'hud_fmr'
    )
  ORDER BY COALESCE(b.residential_units, 0) DESC, b.id
  LIMIT p_limit
  OFFSET p_offset;
$$;

--
-- Name: get_buildings_without_rents(text, text, integer, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.get_buildings_without_rents(p_metro text, p_borough text DEFAULT NULL::text, p_limit integer DEFAULT 500, p_offset integer DEFAULT 0, p_min_units integer DEFAULT 1) RETURNS TABLE(id uuid, full_address text, borough text, zip_code text, slug text, residential_units integer)
    LANGUAGE sql STABLE
    SET statement_timeout TO '120s'
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT b.id, b.full_address, b.borough, b.zip_code, b.slug, b.residential_units
  FROM buildings b
  LEFT JOIN building_rents br ON br.building_id = b.id
  WHERE b.metro = p_metro
    AND (p_min_units <= 0 OR COALESCE(b.residential_units, 0) >= p_min_units)
    AND (p_borough IS NULL OR b.borough = p_borough)
    AND br.building_id IS NULL
  ORDER BY COALESCE(b.residential_units, 0) DESC, b.id
  LIMIT p_limit
  OFFSET p_offset;
$$;

--
-- Name: get_duplicate_groups_with_timeout(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.get_duplicate_groups_with_timeout(metro_filter text, batch_limit integer DEFAULT 500) RETURNS TABLE(full_address text, city character varying, cnt bigint)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  SET LOCAL statement_timeout = '120s';
  RETURN QUERY
  SELECT b.full_address, b.city, COUNT(*) as cnt
  FROM buildings b
  WHERE b.metro = metro_filter
    AND b.full_address IS NOT NULL
  GROUP BY b.full_address, b.city
  HAVING COUNT(*) > 1
  ORDER BY COUNT(*) DESC
  LIMIT batch_limit;
END;
$$;

--
-- Name: link_311_nyc_bulk(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.link_311_nyc_bulk(chunk_size integer DEFAULT 10000) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET statement_timeout TO '120s'
    AS $_$
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
$_$;

--
-- Name: link_311_nyc_by_keys(text[]); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.link_311_nyc_by_keys(keys text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET statement_timeout TO '60s'
    AS $_$
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
$_$;

--
-- Name: link_311_with_backfill(text, integer, timestamp with time zone); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.link_311_with_backfill(p_metro text, p_limit integer DEFAULT 200, p_before_date timestamp with time zone DEFAULT '9999-12-31 00:00:00+00'::timestamp with time zone) RETURNS TABLE(linked integer, created integer, last_date timestamp with time zone)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_linked int := 0;
  v_created int := 0;
  v_last timestamptz := p_before_date;
  v_tmp_linked int;
  v_tmp_created int;
  v_tmp_last timestamptz;
  iter int;
BEGIN
  -- Pass 1: link what's already linkable
  SELECT l.linked, l.last_date INTO v_tmp_linked, v_tmp_last
  FROM bulk_link_311_addr_cursor(p_metro, p_limit, p_before_date) l;
  v_linked := COALESCE(v_tmp_linked, 0);
  v_last := COALESCE(v_tmp_last, p_before_date);

  -- Pass 2: create buildings for what's still unlinked in this date window
  -- (using the same date cursor so we only touch the current batch)
  SELECT c.created INTO v_tmp_created
  FROM create_buildings_from_311(p_metro, p_limit, p_before_date) c;
  v_created := COALESCE(v_tmp_created, 0);

  -- Pass 3: if we created any buildings, re-link to catch new matches
  IF v_created > 0 THEN
    SELECT l.linked INTO v_tmp_linked
    FROM bulk_link_311_addr_cursor(p_metro, p_limit, p_before_date) l;
    v_linked := v_linked + COALESCE(v_tmp_linked, 0);
  END IF;

  linked := v_linked;
  created := v_created;
  last_date := v_last;
  RETURN NEXT;
END;
$$;

--
-- Name: link_hpd_by_bbl_chunk(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.link_hpd_by_bbl_chunk(p_limit integer DEFAULT 2000) RETURNS bigint
    LANGUAGE plpgsql
    SET statement_timeout TO '120s'
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_linked bigint;
BEGIN
  WITH to_link AS (
    SELECT h.id, b.id AS bid
    FROM hpd_violations h
    JOIN buildings b ON b.bbl = h.bbl AND b.metro = 'nyc'
    WHERE h.building_id IS NULL
      AND h.bbl IS NOT NULL
      AND h.bbl <> ''
    LIMIT p_limit
  ),
  upd AS (
    UPDATE hpd_violations h
    SET building_id = t.bid
    FROM to_link t
    WHERE h.id = t.id
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_linked FROM upd;
  RETURN v_linked;
END;
$$;

--
-- Name: link_hpd_with_backfill(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.link_hpd_with_backfill(p_limit integer DEFAULT 20) RETURNS TABLE(linked integer, created integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_linked1 int := 0;
  v_created int := 0;
  v_linked2 int := 0;
  v_bbl_set text[];
BEGIN
  -- Pass 1: link unlinked rows whose BBL is already in buildings.
  -- Capture which BBLs were unlinked so we can target Pass 2 + 3 to the same set.
  WITH batch AS (
    SELECT id, bbl
    FROM hpd_violations
    WHERE building_id IS NULL AND bbl IS NOT NULL AND bbl <> ''
    LIMIT p_limit
  ),
  collected AS (
    SELECT array_agg(DISTINCT bbl) as bbls FROM batch
  ),
  matched AS (
    SELECT DISTINCT ON (b1.id) b1.id as rec_id, b2.id as bid
    FROM batch b1
    JOIN buildings b2 ON b2.bbl = b1.bbl
    ORDER BY b1.id, b2.id
  ),
  upd AS (
    UPDATE hpd_violations h SET building_id = m.bid
    FROM matched m WHERE h.id = m.rec_id
    RETURNING 1
  )
  SELECT count(*)::int, (SELECT bbls FROM collected) INTO v_linked1, v_bbl_set FROM upd;

  -- Pass 2: backfill buildings for the BBLs in this batch that still have no building.
  -- Dedup by bbl, source the address from hpd_violations itself.
  IF v_bbl_set IS NOT NULL AND array_length(v_bbl_set, 1) > 0 THEN
    WITH still_unlinked AS (
      SELECT DISTINCT ON (bbl) bbl, borough, house_number, street_name
      FROM hpd_violations
      WHERE bbl = ANY(v_bbl_set)
        AND building_id IS NULL
        AND street_name IS NOT NULL AND street_name <> ''
        AND borough IS NOT NULL
    ),
    ins AS (
      INSERT INTO buildings (
        bbl, borough, city, state,
        house_number, street_name, full_address, slug, metro
      )
      SELECT
        bbl, borough, 'New York', 'NY',
        COALESCE(house_number, ''),
        street_name,
        COALESCE(house_number || ' ', '') || street_name || ', ' || borough || ', NY',
        lower(regexp_replace(
          COALESCE(house_number || '-', '') || street_name || '-' || substr(md5(bbl), 1, 6),
          '[^a-zA-Z0-9]+', '-', 'g')),
        'nyc'
      FROM still_unlinked
      ON CONFLICT (bbl) DO NOTHING
      RETURNING 1
    )
    SELECT count(*)::int INTO v_created FROM ins;
  END IF;

  -- Pass 3: link ALL hpd_violations whose BBL is in our captured set and now has
  -- a building. Crucially this is bounded by the BBL set (not a fresh LIMIT),
  -- so every record that just had its building created actually gets linked.
  IF v_bbl_set IS NOT NULL AND array_length(v_bbl_set, 1) > 0 THEN
    WITH matched AS (
      SELECT DISTINCT ON (h.id) h.id as rec_id, b.id as bid
      FROM hpd_violations h
      JOIN buildings b ON b.bbl = h.bbl
      WHERE h.building_id IS NULL AND h.bbl = ANY(v_bbl_set)
      ORDER BY h.id, b.id
    ),
    upd AS (
      UPDATE hpd_violations h SET building_id = m.bid
      FROM matched m WHERE h.id = m.rec_id
      RETURNING 1
    )
    SELECT count(*)::int INTO v_linked2 FROM upd;
  END IF;

  linked := v_linked1 + v_linked2;
  created := v_created;
  RETURN NEXT;
END;
$$;

--
-- Name: linking_stats(text[], text[]); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.linking_stats(table_names text[], metros text[]) RETURNS TABLE(table_name text, metro text, total bigint, linked bigint)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET statement_timeout TO '30s'
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY table_names LOOP
    -- Check table exists and has the required columns
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE information_schema.columns.table_schema = 'public'
        AND information_schema.columns.table_name = tbl
        AND column_name = 'metro'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE information_schema.columns.table_schema = 'public'
        AND information_schema.columns.table_name = tbl
        AND column_name = 'building_id'
    ) THEN
      RETURN QUERY EXECUTE format(
        'SELECT %L::text, m.metro::text, COUNT(*)::bigint, COUNT(building_id)::bigint
         FROM %I t
         JOIN unnest($1) AS m(metro) ON t.metro = m.metro
         GROUP BY m.metro',
        tbl, tbl
      ) USING metros;
    END IF;
  END LOOP;
END;
$_$;

--
-- Name: load_chicago_owner_targets(uuid, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.load_chicago_owner_targets(p_cursor uuid, p_limit integer) RETURNS TABLE(id uuid, pin text, owner_name text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT b.id, b.pin, b.owner_name
  FROM buildings b
  WHERE b.metro = 'chicago'
    AND b.pin IS NOT NULL AND b.pin <> ''
    AND (b.owner_name IS NULL OR b.owner_name !~ '\s')
    AND b.id > p_cursor
  ORDER BY b.id
  LIMIT p_limit
$$;

--
-- Name: load_la_owner_targets(uuid, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.load_la_owner_targets(p_cursor uuid, p_limit integer) RETURNS TABLE(id uuid, apn text, full_address text, owner_name text)
    LANGUAGE sql STABLE
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
  SELECT b.id, b.apn, b.full_address, b.owner_name
  FROM buildings b
  WHERE b.state = 'CA'
    AND b.owner_name IS NULL
    AND b.metro = 'los-angeles'
    AND b.apn IS NOT NULL AND b.apn <> ''
    AND b.id > p_cursor
  ORDER BY b.id
  LIMIT p_limit;
$$;

--
-- Name: norm_miami_address(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.norm_miami_address(s text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(upper(coalesce(s, '')), '(\d+)\s*(ST|ND|RD|TH)\M', '\1', 'g'),
      '\s+(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|DRIVE|DR|ROAD|RD|LANE|LN|COURT|CT|CIRCLE|CIR|TERRACE|TER|PLACE|PL|PARKWAY|PKWY|HIGHWAY|HWY|TRAIL|TRL|WAY|LOOP)\s*$', '', 'g'),
    '\s+', ' ', 'g'
  ));
$_$;

--
-- Name: normalize_address(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.normalize_address(addr text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
BEGIN
  IF addr IS NULL OR LENGTH(TRIM(addr)) < 3 THEN RETURN NULL; END IF;
  RETURN UPPER(TRIM(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    UPPER(TRIM(SPLIT_PART(addr, ',', 1))),
    '^\([^)]*\)\s*', ''),
    '\s+(APT|UNIT|STE|SUITE|FL|FLOOR|RM|ROOM|#)\s*\S*$', ''),
    '\bNORTH\b', 'N'),
    '\bSOUTH\b', 'S'),
    '\bEAST\b', 'E'),
    '\bWEST\b', 'W'),
    '\bSTREET\b', 'ST'),
    '\bAVENUE\b', 'AVE'),
    '\bBOULEVARD\b', 'BLVD'),
    '\bDRIVE\b', 'DR'),
    '\bPLACE\b', 'PL'),
    '\bCOURT\b', 'CT'),
    '\bLANE\b', 'LN'),
    '\bROAD\b', 'RD'),
    '\bPARKWAY\b', 'PKWY'),
    '(\d+)(ST|ND|RD|TH)\b', '\1'),
    '\s+', ' ')
  ));
END;
$_$;

--
-- Name: normalize_street(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.normalize_street(s text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public', 'pg_temp'
    AS $_$
  SELECT 
    regexp_replace(
      regexp_replace(
        regexp_replace(
          upper(trim(COALESCE(s, ''))),
          -- 1. Strip ordinal suffix after digits: "28TH" → "28", "1ST" → "1"
          '(\d+)(ST|ND|RD|TH)\y', '\1', 'g'
        ),
        -- 2. Strip trailing street type
        '\s+(STREET|ST|AVENUE|AVE|BOULEVARD|BLVD|DRIVE|DR|ROAD|RD|LANE|LN|COURT|CT|CIRCLE|CIR|TERRACE|TER|PLACE|PL|PARKWAY|PKWY|HIGHWAY|HWY|TRAIL|TRL|WAY|LOOP)$', '', 'g'
      ),
      -- 3. Collapse whitespace
      '\s+', ' ', 'g'
    );
$_$;

--
-- Name: pg_advisory_unlock(bigint); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.pg_advisory_unlock(lock_key bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT pg_advisory_unlock(lock_key);
$$;

--
-- Name: pg_try_advisory_lock(bigint); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.pg_try_advisory_lock(lock_key bigint) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
  SELECT pg_try_advisory_lock(lock_key);
$$;

--
-- Name: prune_unlinkable_complaints_311(interval, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.prune_unlinkable_complaints_311(p_min_age interval DEFAULT '90 days'::interval, p_limit integer DEFAULT 5000) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_deleted int;
BEGIN
  WITH victims AS (
    SELECT id FROM public.complaints_311
    WHERE building_id IS NULL
      AND imported_at < (now() - p_min_age)
      AND link_attempted_at IS NOT NULL
      AND link_attempted_at < (now() - interval '14 days')
    LIMIT p_limit
  )
  DELETE FROM public.complaints_311 c USING victims v
  WHERE c.id = v.id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN coalesce(v_deleted, 0);
END;
$$;

--
-- Name: recent_link_rate(text, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.recent_link_rate(p_metro text, p_days integer DEFAULT 30) RETURNS TABLE(total bigint, linked bigint, unlinked bigint, pct integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE
  v_total bigint;
  v_unlinked bigint;
  v_table text;
  v_cutoff timestamptz;
BEGIN
  v_cutoff := now() - (p_days || ' days')::interval;
  v_table := 'complaints_311_' || replace(p_metro, 'los-angeles', 'la');

  EXECUTE format('SELECT count(*) FROM %I WHERE created_date >= $1', v_table)
    INTO v_total USING v_cutoff;
  -- Partial index on (created_date) WHERE building_id IS NULL — fast.
  EXECUTE format('SELECT count(*) FROM %I WHERE created_date >= $1 AND building_id IS NULL', v_table)
    INTO v_unlinked USING v_cutoff;

  total := v_total;
  unlinked := v_unlinked;
  linked := v_total - v_unlinked;
  pct := CASE WHEN v_total > 0 THEN ((v_total - v_unlinked) * 100 / v_total)::int ELSE 100 END;
  RETURN NEXT;
END;
$_$;

--
-- Name: recent_link_rate_hpd(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.recent_link_rate_hpd(p_days integer DEFAULT 30) RETURNS TABLE(unlinked_with_bbl bigint, recent_imported bigint, pct_linked integer)
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_unlinked bigint;
  v_recent bigint;
BEGIN
  SELECT count(*) INTO v_unlinked
  FROM hpd_violations
  WHERE building_id IS NULL AND bbl IS NOT NULL AND bbl <> '';

  SELECT COALESCE(sum(records_added), 0) INTO v_recent
  FROM sync_log
  WHERE sync_type = 'hpd_violations'
    AND status = 'completed'
    AND started_at >= now() - (p_days || ' days')::interval;

  unlinked_with_bbl := v_unlinked;
  recent_imported := v_recent;
  pct_linked := CASE
    WHEN v_recent > 0 THEN GREATEST(0, ((v_recent - v_unlinked) * 100 / v_recent)::int)
    ELSE 100 END;
  RETURN NEXT;
END;
$$;

--
-- Name: reconcile_building_counts(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.reconcile_building_counts(target_metro text) RETURNS TABLE(buildings_fixed bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET statement_timeout TO '120s'
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  fixed bigint := 0;
  batch_fixed bigint;
  tbl record;
BEGIN
  IF target_metro IS NULL OR target_metro = '' THEN
    RAISE EXCEPTION 'target_metro is required';
  END IF;

  FOR tbl IN
    SELECT * FROM (VALUES
      ('hpd_violations',  'violation_count'),
      ('complaints_311',  'complaint_count'),
      ('hpd_litigations', 'litigation_count'),
      ('dob_violations',  'dob_violation_count'),
      ('bedbug_reports',  'bedbug_report_count'),
      ('evictions',       'eviction_count'),
      ('sidewalk_sheds',  'sidewalk_shed_count'),
      ('dob_permits',     'permit_count')
    ) AS t(source_table, count_col)
  LOOP
    EXECUTE format(
      'UPDATE buildings b
       SET %I = COALESCE(sub.actual, 0)
       FROM (
         SELECT b2.id, COUNT(s.building_id) AS actual
         FROM buildings b2
         LEFT JOIN %I s ON s.building_id = b2.id
         WHERE b2.metro = $1
         GROUP BY b2.id
         HAVING COUNT(s.building_id) IS DISTINCT FROM b2.%I
       ) sub
       WHERE b.id = sub.id',
      tbl.count_col, tbl.source_table, tbl.count_col
    ) USING target_metro;

    GET DIAGNOSTICS batch_fixed = ROW_COUNT;
    fixed := fixed + batch_fixed;
  END LOOP;

  RETURN QUERY SELECT fixed;
END;
$_$;

--
-- Name: refresh_chicago_canonical_letter(text, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_chicago_canonical_letter(p_from text, p_to text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_inserted int;
BEGIN
  WITH ins AS (
    INSERT INTO landlord_stats_canonical (
      metro, slug, name, building_count, total_violations, total_complaints,
      total_litigations, total_dob_violations, avg_score,
      worst_building_address, worst_building_violations
    )
    SELECT metro, slug,
      (array_agg(name ORDER BY length(name) DESC, name))[1],
      SUM(building_count)::int,
      SUM(total_violations)::int, SUM(total_complaints)::int,
      SUM(total_litigations)::int, SUM(total_dob_violations)::int,
      ROUND(AVG(avg_score)::numeric, 2),
      (array_agg(worst_building_address ORDER BY worst_building_violations DESC NULLS LAST))[1],
      MAX(worst_building_violations)::int
    FROM landlord_stats
    WHERE metro='chicago' AND name >= p_from AND name < p_to
      AND slug IS NOT NULL AND slug <> ''
      AND name NOT IN (
        'AVAILABLE FROM DATA SOURCE','NAME NOT ON FILE','NOT AVAILABLE',
        'NOT AVAILABLE FROM THE DATA','NOT AVAILABLE FROM THE DATA SOURCE',
        'UNKNOWN','UNKNOWN OWNER','CURRENT OWNER','N/A','NA','UNAVAILABLE',
        'UNAVAILABLE OWNER','Taxpayer Unknown'
      )
    GROUP BY metro, slug
    ON CONFLICT (metro, slug) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$$;

--
-- Name: refresh_chicago_letter(text, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_chicago_letter(p_from text, p_to text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE v_inserted int;
BEGIN
  WITH ins AS (
    INSERT INTO landlord_stats (
      name, metro, slug, building_count, total_violations, total_complaints,
      total_litigations, total_dob_violations, avg_score,
      worst_building_id, worst_building_address, worst_building_violations
    )
    SELECT
      owner_name, 'chicago',
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(owner_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')),
      COUNT(*)::int,
      COALESCE(SUM(violation_count), 0)::int,
      COALESCE(SUM(complaint_count), 0)::int,
      COALESCE(SUM(litigation_count), 0)::int,
      COALESCE(SUM(dob_violation_count), 0)::int,
      ROUND(AVG(overall_score)::numeric, 2),
      (array_agg(id ORDER BY violation_count DESC NULLS LAST))[1],
      (array_agg(full_address ORDER BY violation_count DESC NULLS LAST))[1],
      MAX(COALESCE(violation_count, 0))::int
    FROM buildings
    WHERE metro = 'chicago'
      AND owner_name IS NOT NULL AND owner_name <> ''
      AND owner_name >= p_from AND owner_name < p_to
    GROUP BY owner_name
    ON CONFLICT (name, metro) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$_$;

--
-- Name: refresh_la_canonical_letter(text, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_la_canonical_letter(p_from text, p_to text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE v_inserted int;
BEGIN
  WITH ins AS (
    INSERT INTO landlord_stats_canonical (
      metro, slug, name, building_count, total_violations, total_complaints,
      total_litigations, total_dob_violations, avg_score,
      worst_building_address, worst_building_violations
    )
    SELECT metro, slug,
      (array_agg(name ORDER BY length(name) DESC, name))[1],
      SUM(building_count)::int,
      SUM(total_violations)::int, SUM(total_complaints)::int,
      SUM(total_litigations)::int, SUM(total_dob_violations)::int,
      ROUND(AVG(avg_score)::numeric, 2),
      (array_agg(worst_building_address ORDER BY worst_building_violations DESC NULLS LAST))[1],
      MAX(worst_building_violations)::int
    FROM landlord_stats
    WHERE metro='los-angeles' AND name >= p_from AND name < p_to
    GROUP BY metro, slug
    ON CONFLICT (metro, slug) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$$;

--
-- Name: refresh_la_letter(text, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_la_letter(p_from text, p_to text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $_$
DECLARE v_inserted int;
BEGIN
  WITH ins AS (
    INSERT INTO landlord_stats (
      name, metro, slug, building_count, total_violations, total_complaints,
      total_litigations, total_dob_violations, avg_score,
      worst_building_id, worst_building_address, worst_building_violations
    )
    SELECT
      owner_name, 'los-angeles',
      LOWER(REGEXP_REPLACE(REGEXP_REPLACE(owner_name, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g')),
      COUNT(*)::int,
      COALESCE(SUM(violation_count), 0)::int,
      COALESCE(SUM(complaint_count), 0)::int,
      COALESCE(SUM(litigation_count), 0)::int,
      COALESCE(SUM(dob_violation_count), 0)::int,
      ROUND(AVG(overall_score)::numeric, 2),
      (array_agg(id ORDER BY violation_count DESC NULLS LAST))[1],
      (array_agg(full_address ORDER BY violation_count DESC NULLS LAST))[1],
      MAX(COALESCE(violation_count, 0))::int
    FROM buildings
    WHERE metro = 'los-angeles'
      AND owner_name IS NOT NULL AND owner_name <> ''
      AND owner_name >= p_from AND owner_name < p_to
    GROUP BY owner_name
    ON CONFLICT (name, metro) DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::int INTO v_inserted FROM ins;
  RETURN v_inserted;
END;
$_$;

--
-- Name: refresh_landlord_311_for_metro(text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_landlord_311_for_metro(p_metro text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  rowcount int;
BEGIN
  -- Wipe existing rows for the metro
  DELETE FROM landlord_311_summary WHERE metro = p_metro;

  -- Aggregate buildings.complaint_count by owner_name
  INSERT INTO landlord_311_summary (metro, name, building_count, complaint_count, refreshed_at)
  SELECT
    p_metro,
    owner_name,
    COUNT(*)::int,
    SUM(complaint_count)::bigint,
    NOW()
  FROM buildings
  WHERE metro = p_metro
    AND owner_name IS NOT NULL
    AND complaint_count > 0
    AND owner_name NOT IN (
      'AVAILABLE FROM DATA SOURCE',
      'NAME NOT ON FILE',
      'NOT AVAILABLE',
      'NOT AVAILABLE FROM THE DATA',
      'NOT AVAILABLE FROM THE DATA SOURCE',
      'UNKNOWN',
      'UNKNOWN OWNER',
      'CURRENT OWNER',
      'N/A',
      'NA',
      'UNAVAILABLE',
      'UNAVAILABLE OWNER',
      'Taxpayer Unknown'
    )
  GROUP BY owner_name;

  GET DIAGNOSTICS rowcount = ROW_COUNT;
  RETURN rowcount;
END;
$$;

--
-- Name: refresh_sitemap_building_cursors(integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.refresh_sitemap_building_cursors(p_batch_size integer DEFAULT 10000) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  TRUNCATE sitemap_building_cursors;
  INSERT INTO sitemap_building_cursors (batch_index, cursor_id)
  SELECT (row_number() OVER (ORDER BY id) - 1) / p_batch_size AS batch_index,
         id AS cursor_id
  FROM buildings
  WHERE (row_number() OVER (ORDER BY id) - 1) % p_batch_size = 0;
END;
$$;

--
-- Name: relink_311_nyc_normalized_range(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.relink_311_nyc_normalized_range(start_date timestamp with time zone, end_date timestamp with time zone) RETURNS TABLE(processed integer, linked integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    SET statement_timeout TO '120s'
    AS $_$
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
      regexp_replace(p.hnum_raw, '[^0-9\-]', '', 'g') AS hnum,
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
$_$;

--
-- Name: reset_pg_stat_statements(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.reset_pg_stat_statements() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  prior_calls bigint;
BEGIN
  SELECT COALESCE(SUM(calls), 0) INTO prior_calls FROM extensions.pg_stat_statements;
  PERFORM extensions.pg_stat_statements_reset();
  RETURN jsonb_build_object(
    'reset_at', NOW(),
    'prior_total_calls', prior_calls
  );
END;
$$;

--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;

--
-- Name: search_landlord_stats(text, text, text, integer, integer); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.search_landlord_stats(city_filter text, search_query text, sort_by text DEFAULT 'violations'::text, page_offset integer DEFAULT 0, page_limit integer DEFAULT 25) RETURNS SETOF json
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  q_norm text := upper(btrim(search_query));
BEGIN
  IF q_norm IS NULL OR q_norm = '' THEN
    RETURN;
  END IF;

  IF length(q_norm) < 3 THEN
    -- Short queries: prefix match only. Served entirely from the covering
    -- index (index-only scan) — substring match on 1-2 chars cannot use the
    -- trigram index and used to seq-scan 631K rows into a statement timeout.
    RETURN QUERY
    WITH matches AS MATERIALIZED (
      SELECT name, slug, building_count, total_violations, total_complaints,
             total_litigations, total_dob_violations, avg_score,
             worst_building_id, worst_building_address, worst_building_violations
      FROM landlord_stats
      WHERE (city_filter IS NULL OR metro = city_filter)
        AND upper(btrim(name)) LIKE q_norm || '%'
      LIMIT 1000
    )
    SELECT row_to_json(t) FROM (
      SELECT m.*, count(*) OVER () AS total_count
      FROM matches m
      ORDER BY
        CASE WHEN sort_by = 'complaints'  THEN m.total_complaints
             WHEN sort_by = 'litigations' THEN m.total_litigations
             WHEN sort_by = 'dob'         THEN m.total_dob_violations
             WHEN sort_by = 'buildings'   THEN m.building_count
             ELSE m.total_violations END DESC NULLS LAST
      OFFSET page_offset LIMIT page_limit
    ) t;
  ELSE
    -- 3+ chars: substring match via the trigram index, hard-capped so the
    -- scattered heap fetches stay bounded on cold cache.
    RETURN QUERY
    WITH matches AS MATERIALIZED (
      SELECT name, slug, building_count, total_violations, total_complaints,
             total_litigations, total_dob_violations, avg_score,
             worst_building_id, worst_building_address, worst_building_violations
      FROM landlord_stats
      WHERE name ILIKE '%' || btrim(search_query) || '%'
        AND (city_filter IS NULL OR metro = city_filter)
      LIMIT 300
    )
    SELECT row_to_json(t) FROM (
      SELECT m.*, count(*) OVER () AS total_count
      FROM matches m
      ORDER BY
        CASE WHEN sort_by = 'complaints'  THEN m.total_complaints
             WHEN sort_by = 'litigations' THEN m.total_litigations
             WHEN sort_by = 'dob'         THEN m.total_dob_violations
             WHEN sort_by = 'buildings'   THEN m.building_count
             ELSE m.total_violations END DESC NULLS LAST
      OFFSET page_offset LIMIT page_limit
    ) t;
  END IF;
END;
$$;

--
-- Name: stmt_decrement_building_count(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.stmt_decrement_building_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  col_name text;
BEGIN
  col_name := TG_ARGV[0];
  EXECUTE format(
    'UPDATE buildings SET %I = GREATEST(COALESCE(%I, 0) - sub.cnt, 0)
     FROM (SELECT building_id, COUNT(*) AS cnt
           FROM old_rows
           WHERE building_id IS NOT NULL
           GROUP BY building_id) sub
     WHERE buildings.id = sub.building_id',
    col_name, col_name
  );
  RETURN NULL;
END;
$$;

--
-- Name: stmt_increment_building_count(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.stmt_increment_building_count() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  col_name text;
BEGIN
  col_name := TG_ARGV[0];
  EXECUTE format(
    'UPDATE buildings SET %I = COALESCE(%I, 0) + sub.cnt
     FROM (SELECT building_id, COUNT(*) AS cnt
           FROM new_rows
           WHERE building_id IS NOT NULL
           GROUP BY building_id) sub
     WHERE buildings.id = sub.building_id',
    col_name, col_name
  );
  RETURN NULL;
END;
$$;

--
-- Name: terminate_idle_advisory_locks(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.terminate_idle_advisory_locks() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM pg_terminate_backend(l.pid)
  FROM pg_locks l
  JOIN pg_stat_activity a ON l.pid = a.pid
  WHERE l.locktype = 'advisory' AND a.state = 'idle';
END;
$$;

--
-- Name: update_building_review_stats(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.update_building_review_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    target_building_id uuid;
BEGIN
    -- Determine which building to update
    IF TG_OP = 'DELETE' THEN
        target_building_id := OLD.building_id;
    ELSE
        target_building_id := NEW.building_id;
    END IF;

    -- Update the building's review_count and overall_score
    UPDATE buildings
    SET
        review_count = (
            SELECT COUNT(*)
            FROM reviews
            WHERE reviews.building_id = target_building_id
              AND reviews.status = 'published'
        ),
        overall_score = (
            SELECT ROUND(AVG(overall_rating)::numeric, 1)
            FROM reviews
            WHERE reviews.building_id = target_building_id
              AND reviews.status = 'published'
        ),
        updated_at = now()
    WHERE id = target_building_id;

    -- If building_id changed on UPDATE, also refresh the old building
    IF TG_OP = 'UPDATE' AND OLD.building_id IS DISTINCT FROM NEW.building_id THEN
        UPDATE buildings
        SET
            review_count = (
                SELECT COUNT(*)
                FROM reviews
                WHERE reviews.building_id = OLD.building_id
                  AND reviews.status = 'published'
            ),
            overall_score = (
                SELECT ROUND(AVG(overall_rating)::numeric, 1)
                FROM reviews
                WHERE reviews.building_id = OLD.building_id
                  AND reviews.status = 'published'
            ),
            updated_at = now()
        WHERE id = OLD.building_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

--
-- Name: update_helpful_count(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.update_helpful_count() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    target_review_id uuid;
BEGIN
    IF TG_OP = 'DELETE' THEN
        target_review_id := OLD.review_id;
    ELSE
        target_review_id := NEW.review_id;
    END IF;

    UPDATE reviews
    SET helpful_count = (
        SELECT COUNT(*)
        FROM helpful_votes
        WHERE helpful_votes.review_id = target_review_id
    )
    WHERE id = target_review_id;

    -- Also update the review author's profile helpful_count
    UPDATE profiles
    SET helpful_count = (
        SELECT COALESCE(SUM(r.helpful_count), 0)
        FROM reviews r
        WHERE r.user_id = profiles.id
    )
    WHERE id = (
        SELECT user_id FROM reviews WHERE id = target_review_id
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

--
-- Name: upsert_flood_zone(text, text, text, text, numeric, text); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.upsert_flood_zone(p_metro text, p_zone_id text, p_zone_code text, p_zone_subtype text, p_bfe numeric, p_geom_geojson text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  insert into flood_zones (metro, zone_id, zone_code, zone_subtype, bfe, geom)
  values (
    p_metro,
    p_zone_id,
    p_zone_code,
    p_zone_subtype,
    p_bfe,
    extensions.ST_Multi(
      extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(p_geom_geojson), 4326)
    )::extensions.geometry(MultiPolygon, 4326)
  )
  on conflict (metro, zone_id) do update set
    zone_code = excluded.zone_code,
    zone_subtype = excluded.zone_subtype,
    bfe = excluded.bfe,
    geom = excluded.geom;
$$;

--
-- Name: upsert_flood_zones_batch(jsonb); Type: FUNCTION; Schema: public;
--

CREATE OR REPLACE FUNCTION public.upsert_flood_zones_batch(p_features jsonb) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  inserted_count integer := 0;
begin
  insert into flood_zones (metro, zone_id, zone_code, zone_subtype, bfe, geom)
  select
    feat->>'metro',
    feat->>'zone_id',
    feat->>'zone_code',
    nullif(feat->>'zone_subtype', ''),
    (feat->>'bfe')::numeric,
    extensions.ST_Multi(
      extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON(feat->>'geometry'), 4326)
    )::extensions.geometry(MultiPolygon, 4326)
  from jsonb_array_elements(p_features) as feat
  on conflict (metro, zone_id) do update set
    zone_code = excluded.zone_code,
    zone_subtype = excluded.zone_subtype,
    bfe = excluded.bfe,
    geom = excluded.geom;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

--
-- Name: _addr_link_map; Type: TABLE; Schema: public;
--

CREATE TABLE public._addr_link_map (
    norm_addr text,
    building_id uuid,
    metro text
);

--
-- Name: _tmp_311_building_map; Type: TABLE; Schema: public;
--

CREATE TABLE public._tmp_311_building_map (
    complaint_id uuid,
    building_id uuid
);

--
-- Name: _zip_grid_nyc; Type: TABLE; Schema: public;
--

CREATE TABLE public._zip_grid_nyc (
    glat numeric,
    glon numeric,
    zip_code character varying(5)
);

--
-- Name: _zip_lookup; Type: TABLE; Schema: public;
--

CREATE TABLE public._zip_lookup (
    glat numeric,
    glon numeric,
    zip_code character varying(5)
);

--
-- Name: backfill_runs; Type: TABLE; Schema: public;
--

CREATE TABLE public.backfill_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    metro text NOT NULL,
    source text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    records_added integer DEFAULT 0,
    last_offset integer DEFAULT 0,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_log text[],
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: building_ownership_records; Type: TABLE; Schema: public;
--

CREATE TABLE public.building_ownership_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    source_record_id text NOT NULL,
    assessment_year smallint NOT NULL,
    parcel_id text,
    owner_name text NOT NULL,
    owner_type text NOT NULL,
    owner_mailing_address text,
    owner_mailing_city text,
    owner_mailing_state text,
    owner_mailing_zip text,
    last_sale_date date,
    last_sale_price numeric(14,2),
    assessed_value numeric(14,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_type text DEFAULT 'assessor'::text NOT NULL,
    recording_date date,
    CONSTRAINT building_ownership_records_owner_type_check CHECK ((owner_type = ANY (ARRAY['company'::text, 'individual'::text])))
);

--
-- Name: building_scores; Type: TABLE; Schema: public;
--

CREATE TABLE public.building_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    category_id uuid NOT NULL,
    avg_rating numeric(3,1),
    total_ratings integer DEFAULT 0,
    public_data_score numeric(3,1),
    combined_score numeric(3,1),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: building_slug_redirects; Type: TABLE; Schema: public;
--

CREATE TABLE public.building_slug_redirects (
    old_slug text NOT NULL,
    new_slug text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: buildings; Type: TABLE; Schema: public;
--

CREATE TABLE public.buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bbl character varying(20),
    bin character varying(7),
    borough character varying(20) NOT NULL,
    house_number character varying(20),
    street_name character varying(100) NOT NULL,
    city character varying(50) DEFAULT 'New York'::character varying NOT NULL,
    state character varying(2) DEFAULT 'NY'::character varying NOT NULL,
    zip_code character varying(5),
    full_address text NOT NULL,
    year_built integer,
    num_floors integer,
    total_units integer,
    residential_units integer,
    commercial_units integer,
    building_class character varying(100),
    land_use character varying(100),
    owner_name character varying(200),
    overall_score numeric(3,1),
    review_count integer DEFAULT 0,
    violation_count integer DEFAULT 0,
    complaint_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    litigation_count integer DEFAULT 0,
    dob_violation_count integer DEFAULT 0,
    crime_count integer DEFAULT 0,
    slug text NOT NULL,
    is_rent_stabilized boolean DEFAULT false,
    stabilized_units integer,
    stabilized_year integer,
    bedbug_report_count integer DEFAULT 0,
    eviction_count integer DEFAULT 0,
    lead_violation_count integer DEFAULT 0,
    sidewalk_shed_count integer DEFAULT 0,
    permit_count integer DEFAULT 0,
    energy_star_score smallint,
    latitude numeric,
    longitude numeric,
    name text,
    metro text DEFAULT 'nyc'::text NOT NULL,
    apn character varying(20),
    is_soft_story boolean DEFAULT false,
    soft_story_status text,
    is_rso boolean DEFAULT false,
    fire_risk_zone text,
    pin text,
    ward integer,
    community_area text,
    is_rlto_protected boolean DEFAULT false,
    is_scofflaw boolean DEFAULT false,
    rlto_violation_count integer DEFAULT 0,
    lead_inspection_count integer DEFAULT 0,
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, ((((((((COALESCE(full_address, ''::text) || ' '::text) || (COALESCE(borough, ''::character varying))::text) || ' '::text) || (COALESCE(zip_code, ''::character varying))::text) || ' '::text) || (COALESCE(owner_name, ''::character varying))::text) || ' '::text) || COALESCE(name, ''::text)))) STORED,
    folio_number text,
    flood_zone text,
    forty_year_recert_status text,
    forty_year_recert_due_date date,
    is_condo boolean DEFAULT false,
    condo_association text,
    unsafe_structure_count integer DEFAULT 0,
    hcad_account text,
    hcad_land_use text,
    flood_claims_count integer DEFAULT 0,
    in_floodplain boolean DEFAULT false,
    super_neighborhood text,
    is_dangerous_building boolean DEFAULT false,
    dangerous_building_count integer DEFAULT 0,
    management_company text,
    sea_level_risk_zone text,
    sea_level_risk_feet numeric(4,1),
    parking_type character varying(30),
    parking_spaces integer,
    car_dependency_score numeric(3,1),
    assessor_sqft integer,
    assessor_lot_sqft integer,
    fair_plan_risk boolean DEFAULT false,
    assessed_land_value numeric(14,2),
    calenviroscreen_percentile numeric(5,2),
    buyout_total_amount numeric(12,2),
    calenviroscreen_tract character varying(15),
    scep_last_inspection date,
    assessed_value numeric(14,2),
    scep_compliance_status character varying(30),
    encampment_count_nearby integer DEFAULT 0,
    ellis_act_filing boolean DEFAULT false,
    ellis_act_date date,
    rent_registry_status character varying(20),
    fire_hazard_zone character varying(30),
    fire_hazard_detail text,
    buyout_count integer DEFAULT 0,
    rodent_complaint_count integer DEFAULT 0,
    building_sqft integer,
    lot_sqft integer,
    market_value numeric(14,2),
    land_value numeric(14,2),
    improvement_value numeric(14,2),
    legal_description text,
    last_sale_date date,
    hcad_state_class text,
    hcad_last_synced timestamp with time zone,
    submarket text,
    true_owner text,
    building_style text,
    external_property_id text,
    owner_type text,
    CONSTRAINT buildings_overall_score_range CHECK (((overall_score IS NULL) OR ((overall_score >= (0)::numeric) AND (overall_score <= (5)::numeric)))),
    CONSTRAINT buildings_owner_type_check CHECK (((owner_type IS NULL) OR (owner_type = ANY (ARRAY['company'::text, 'individual'::text, 'unknown'::text]))))
)
WITH (autovacuum_vacuum_cost_delay='2', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: calenviroscreen; Type: TABLE; Schema: public;
--

CREATE TABLE public.calenviroscreen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    census_tract character varying(15) NOT NULL,
    zip_code character varying(10),
    county character varying(50),
    ces_percentile numeric(5,2),
    ces_score numeric(8,2),
    ozone_percentile numeric(5,2),
    pm25_percentile numeric(5,2),
    diesel_pm_percentile numeric(5,2),
    traffic_percentile numeric(5,2),
    pesticides_percentile numeric(5,2),
    toxic_releases_percentile numeric(5,2),
    cleanup_sites_percentile numeric(5,2),
    groundwater_threats_percentile numeric(5,2),
    hazardous_waste_percentile numeric(5,2),
    solid_waste_percentile numeric(5,2),
    asthma_percentile numeric(5,2),
    cardiovascular_percentile numeric(5,2),
    low_birth_weight_percentile numeric(5,2),
    poverty_percentile numeric(5,2),
    unemployment_percentile numeric(5,2),
    housing_burden_percentile numeric(5,2),
    latitude numeric(9,6),
    longitude numeric(9,6),
    imported_at timestamp with time zone DEFAULT now()
);

--
-- Name: complaints_311; Type: TABLE; Schema: public;
--

CREATE TABLE public.complaints_311 (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    unique_key text,
    complaint_type text,
    descriptor text,
    agency text,
    status text,
    created_date timestamp with time zone,
    closed_date timestamp with time zone,
    resolution_description text,
    borough text,
    incident_address text,
    latitude numeric,
    longitude numeric,
    imported_at timestamp with time zone,
    metro text NOT NULL,
    zip_code text,
    parsed_house_num text,
    parsed_street text,
    link_attempted_at timestamp with time zone
)
PARTITION BY LIST (metro);

--
-- Name: complaints_311_chicago; Type: TABLE; Schema: public;
--

CREATE TABLE public.complaints_311_chicago (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    unique_key text,
    complaint_type text,
    descriptor text,
    agency text,
    status text,
    created_date timestamp with time zone,
    closed_date timestamp with time zone,
    resolution_description text,
    borough text,
    incident_address text,
    latitude numeric,
    longitude numeric,
    imported_at timestamp with time zone,
    metro text NOT NULL,
    zip_code text,
    parsed_house_num text,
    parsed_street text,
    link_attempted_at timestamp with time zone
)
WITH (autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: complaints_311_la; Type: TABLE; Schema: public;
--

CREATE TABLE public.complaints_311_la (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    unique_key text,
    complaint_type text,
    descriptor text,
    agency text,
    status text,
    created_date timestamp with time zone,
    closed_date timestamp with time zone,
    resolution_description text,
    borough text,
    incident_address text,
    latitude numeric,
    longitude numeric,
    imported_at timestamp with time zone,
    metro text NOT NULL,
    zip_code text,
    parsed_house_num text,
    parsed_street text,
    link_attempted_at timestamp with time zone
)
WITH (autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: complaints_311_nyc; Type: TABLE; Schema: public;
--

CREATE TABLE public.complaints_311_nyc (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    unique_key text,
    complaint_type text,
    descriptor text,
    agency text,
    status text,
    created_date timestamp with time zone,
    closed_date timestamp with time zone,
    resolution_description text,
    borough text,
    incident_address text,
    latitude numeric,
    longitude numeric,
    imported_at timestamp with time zone,
    metro text NOT NULL,
    zip_code text,
    parsed_house_num text,
    parsed_street text,
    link_attempted_at timestamp with time zone
)
WITH (autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: cook_county_sales; Type: TABLE; Schema: public;
--

CREATE TABLE public.cook_county_sales (
    pin text NOT NULL,
    buyer_name text NOT NULL,
    latest_sale_date date,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: crime_by_zip_cache; Type: TABLE; Schema: public;
--

CREATE TABLE public.crime_by_zip_cache (
    metro text NOT NULL,
    zip_code character varying(5) NOT NULL,
    borough text,
    total bigint DEFAULT 0,
    violent bigint DEFAULT 0,
    property bigint DEFAULT 0,
    quality_of_life bigint DEFAULT 0,
    current_year_total bigint DEFAULT 0,
    prior_year_total bigint DEFAULT 0,
    current_violent bigint DEFAULT 0,
    prior_violent bigint DEFAULT 0,
    current_property bigint DEFAULT 0,
    prior_property bigint DEFAULT 0,
    refreshed_at timestamp with time zone DEFAULT now()
);

--
-- Name: crime_incidents; Type: TABLE; Schema: public;
--

CREATE TABLE public.crime_incidents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    incident_id text,
    category text,
    description text,
    date timestamp with time zone,
    "time" text,
    latitude double precision,
    longitude double precision,
    zip_code text,
    precinct text,
    borough text,
    status text,
    metro text DEFAULT 'nyc'::text,
    imported_at timestamp with time zone DEFAULT now()
);

--
-- Name: dob_permits; Type: TABLE; Schema: public;
--

CREATE TABLE public.dob_permits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    bbl character varying(10),
    bin character varying(10),
    work_permit character varying(50) NOT NULL,
    house_no character varying(50),
    street_name character varying(150),
    borough character varying(100),
    zip_code character varying(10),
    block character varying(10),
    lot character varying(10),
    work_type character varying(100),
    permit_status character varying(60),
    filing_reason character varying(100),
    issued_date date,
    expired_date date,
    job_description text,
    estimated_job_costs numeric(12,2),
    owner_business_name character varying(200),
    permittee_business_name character varying(200),
    latitude numeric(10,6),
    longitude numeric(10,6),
    imported_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL,
    full_address text
)
WITH (autovacuum_vacuum_cost_delay='2', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: dob_violations; Type: TABLE; Schema: public;
--

CREATE TABLE public.dob_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    bbl character varying(20),
    bin character varying(7),
    isn_dob_bis_vio character varying(20),
    violation_type character varying(100),
    violation_category character varying(100),
    description text,
    issue_date date,
    disposition_date date,
    disposition_comments text,
    penalty_amount numeric(12,2),
    borough character varying(20),
    house_number character varying(20),
    street_name character varying(100),
    raw_data jsonb,
    imported_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL
)
WITH (autovacuum_vacuum_cost_delay='2', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: energy_benchmarks; Type: TABLE; Schema: public;
--

CREATE TABLE public.energy_benchmarks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    bbl character varying(10),
    property_id character varying(20),
    property_name character varying(300),
    property_type character varying(100),
    report_year smallint NOT NULL,
    address character varying(300),
    borough character varying(20),
    zip_code character varying(10),
    energy_star_score smallint,
    site_eui numeric(10,2),
    weather_normalized_eui numeric(10,2),
    total_ghg_emissions numeric(12,2),
    electricity_use numeric(14,2),
    natural_gas_use numeric(14,2),
    water_use numeric(12,2),
    year_built smallint,
    number_of_buildings smallint,
    property_gfa numeric(14,2),
    imported_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL,
    apn text,
    pin text
);

--
-- Name: flood_zones; Type: TABLE; Schema: public;
--

CREATE TABLE public.flood_zones (
    id bigint NOT NULL,
    metro text NOT NULL,
    zone_id text NOT NULL,
    zone_code text NOT NULL,
    zone_subtype text,
    bfe numeric,
    effective_date date,
    source_agency text DEFAULT 'FEMA NFHL'::text NOT NULL,
    geom extensions.geometry(MultiPolygon,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: flood_zones_id_seq; Type: SEQUENCE; Schema: public;
--

CREATE SEQUENCE public.flood_zones_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: harris_county_owners; Type: TABLE; Schema: public;
--

CREATE TABLE public.harris_county_owners (
    account text NOT NULL,
    owner_name text NOT NULL,
    loaded_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: helpful_votes; Type: TABLE; Schema: public;
--

CREATE TABLE public.helpful_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    review_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: hpd_litigations; Type: TABLE; Schema: public;
--

CREATE TABLE public.hpd_litigations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    bbl text,
    litigation_id text NOT NULL,
    case_type text,
    case_status text,
    case_open_date date,
    case_close_date date,
    case_judgment text,
    penalty text,
    respondent text,
    borough text,
    house_number text,
    street_name text,
    zip text,
    raw_data jsonb,
    imported_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL
)
WITH (autovacuum_vacuum_scale_factor='0.05', autovacuum_analyze_scale_factor='0.02', autovacuum_vacuum_cost_delay='2');

--
-- Name: hpd_violations; Type: TABLE; Schema: public;
--

CREATE TABLE public.hpd_violations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    bbl character varying(20),
    bin character varying(7),
    violation_id character varying(50),
    class text,
    inspection_date date,
    approved_date date,
    nov_description text,
    nov_issue_date date,
    status character varying(50),
    status_date date,
    borough character varying(20),
    house_number character varying(20),
    street_name character varying(100),
    apartment character varying(20),
    imported_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL
)
WITH (autovacuum_vacuum_cost_delay='2', autovacuum_vacuum_scale_factor='0.02', autovacuum_analyze_scale_factor='0.02');

--
-- Name: la_assessor_parcels; Type: TABLE; Schema: public;
--

CREATE TABLE public.la_assessor_parcels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    apn character varying(20) NOT NULL,
    building_id uuid,
    owner_name text,
    use_code character varying(10),
    use_description text,
    year_built integer,
    effective_year integer,
    sqft_building integer,
    sqft_lot integer,
    units integer,
    assessed_total numeric(14,2),
    assessed_land numeric(14,2),
    assessed_improvement numeric(14,2),
    tax_rate_area character varying(10),
    latitude numeric(9,6),
    longitude numeric(9,6),
    imported_at timestamp with time zone DEFAULT now()
);

--
-- Name: la_earthquake_retrofit; Type: TABLE; Schema: public;
--

CREATE TABLE public.la_earthquake_retrofit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    apn text,
    address text,
    retrofit_type text,
    compliance_status text,
    ordinance text,
    deadline date,
    completion_date date,
    permit_number text,
    notes text,
    raw_data jsonb,
    metro text DEFAULT 'los-angeles'::text NOT NULL,
    imported_at timestamp with time zone DEFAULT now()
);

--
-- Name: lahd_scep_inspections; Type: TABLE; Schema: public;
--

CREATE TABLE public.lahd_scep_inspections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid,
    apn character varying(20),
    address text,
    zip_code character varying(10),
    case_number character varying(50),
    inspection_date date,
    next_inspection_date date,
    cycle_year integer,
    violations_found integer DEFAULT 0,
    violations_cleared integer DEFAULT 0,
    compliance_status character varying(30),
    inspector character varying(100),
    metro text DEFAULT 'los-angeles'::text NOT NULL,
    imported_at timestamp with time zone DEFAULT now()
);

--
-- Name: landlord_stats; Type: TABLE; Schema: public;
--

CREATE TABLE public.landlord_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    building_count integer DEFAULT 0,
    total_violations integer DEFAULT 0,
    total_complaints integer DEFAULT 0,
    total_litigations integer DEFAULT 0,
    total_dob_violations integer DEFAULT 0,
    avg_score numeric(5,2),
    worst_building_id uuid,
    worst_building_address text,
    worst_building_violations integer DEFAULT 0,
    updated_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text,
    total_units integer
);

--
-- Name: profiles; Type: TABLE; Schema: public;
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    display_name character varying(100),
    email character varying(255),
    avatar_url text,
    bio text,
    is_verified_renter boolean DEFAULT false,
    neighborhoods_lived text[],
    review_count integer DEFAULT 0,
    helpful_count integer DEFAULT 0,
    reputation integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: review_categories; Type: TABLE; Schema: public;
--

CREATE TABLE public.review_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    icon character varying(50),
    display_order integer DEFAULT 0
);

--
-- Name: review_category_ratings; Type: TABLE; Schema: public;
--

CREATE TABLE public.review_category_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    category_id uuid NOT NULL,
    rating integer NOT NULL,
    subcategory_flags jsonb DEFAULT '[]'::jsonb,
    CONSTRAINT review_category_ratings_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: review_subcategories; Type: TABLE; Schema: public;
--

CREATE TABLE public.review_subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    slug character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    display_order integer DEFAULT 0
);

--
-- Name: reviews; Type: TABLE; Schema: public;
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    building_id uuid NOT NULL,
    unit_id uuid,
    overall_rating integer NOT NULL,
    title character varying(200),
    body text,
    move_in_date date,
    move_out_date date,
    rent_amount integer,
    lease_type character varying(50),
    status character varying(20) DEFAULT 'published'::character varying,
    helpful_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metro text DEFAULT 'nyc'::text NOT NULL,
    reviewer_name text,
    landlord_name text,
    would_recommend boolean,
    is_pet_friendly boolean,
    reviewer_display_preference text DEFAULT 'name'::text NOT NULL,
    pro_tags text[] DEFAULT '{}'::text[],
    con_tags text[] DEFAULT '{}'::text[],
    bedrooms text,
    bathrooms text,
    source text DEFAULT 'user'::text NOT NULL,
    CONSTRAINT reviews_lease_type_check CHECK (((lease_type)::text = ANY ((ARRAY['rent_stabilized'::character varying, 'market_rate'::character varying, 'rent_controlled'::character varying])::text[]))),
    CONSTRAINT reviews_overall_rating_check CHECK (((overall_rating >= 1) AND (overall_rating <= 5))),
    CONSTRAINT reviews_reviewer_display_preference_check CHECK ((reviewer_display_preference = ANY (ARRAY['name'::text, 'anonymous'::text]))),
    CONSTRAINT reviews_source_check CHECK ((source = ANY (ARRAY['user'::text, 'google'::text, 'apartmentratings'::text, 'yelp'::text, 'openigloo'::text]))),
    CONSTRAINT reviews_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'approved'::character varying, 'flagged'::character varying, 'removed'::character varying])::text[])))
);

--
-- Name: saved_buildings; Type: TABLE; Schema: public;
--

CREATE TABLE public.saved_buildings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    building_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: search_index; Type: TABLE; Schema: public;
--

CREATE TABLE public.search_index (
    id uuid NOT NULL,
    metro text NOT NULL,
    full_address text NOT NULL,
    borough text,
    slug text,
    name text,
    zip_code text,
    overall_score numeric,
    review_count integer DEFAULT 0,
    violation_count integer DEFAULT 0,
    complaint_count integer DEFAULT 0
);

--
-- Name: sitemap_building_cursors; Type: TABLE; Schema: public;
--

CREATE TABLE public.sitemap_building_cursors (
    batch_index integer NOT NULL,
    cursor_id uuid NOT NULL
);

--
-- Name: sitemap_landlord_cursors; Type: TABLE; Schema: public;
--

CREATE TABLE public.sitemap_landlord_cursors (
    batch_index integer NOT NULL,
    cursor_name text NOT NULL
);

--
-- Name: sync_log; Type: TABLE; Schema: public;
--

CREATE TABLE public.sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_type text NOT NULL,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    records_added integer DEFAULT 0,
    records_linked integer DEFAULT 0,
    errors text[],
    status text DEFAULT 'running'::text
);

--
-- Name: units; Type: TABLE; Schema: public;
--

CREATE TABLE public.units (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    building_id uuid NOT NULL,
    unit_number character varying(20) NOT NULL,
    floor integer,
    bedrooms integer,
    bathrooms numeric(3,1),
    overall_score numeric(3,1),
    review_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: complaints_311_chicago; Type: TABLE ATTACH; Schema: public;
--

ALTER TABLE ONLY public.complaints_311 ATTACH PARTITION public.complaints_311_chicago FOR VALUES IN ('chicago');

--
-- Name: complaints_311_la; Type: TABLE ATTACH; Schema: public;
--

ALTER TABLE ONLY public.complaints_311 ATTACH PARTITION public.complaints_311_la FOR VALUES IN ('los-angeles');

--
-- Name: complaints_311_nyc; Type: TABLE ATTACH; Schema: public;
--

ALTER TABLE ONLY public.complaints_311 ATTACH PARTITION public.complaints_311_nyc FOR VALUES IN ('nyc');

--
-- Name: flood_zones id; Type: DEFAULT; Schema: public;
--

ALTER TABLE ONLY public.flood_zones ALTER COLUMN id SET DEFAULT nextval('public.flood_zones_id_seq'::regclass);

--
-- Name: backfill_runs backfill_runs_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.backfill_runs
    ADD CONSTRAINT backfill_runs_pkey PRIMARY KEY (id);

--
-- Name: building_ownership_records building_ownership_records_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_ownership_records
    ADD CONSTRAINT building_ownership_records_pkey PRIMARY KEY (id);

--
-- Name: building_ownership_records building_ownership_records_source_record_id_assessment_year_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_ownership_records
    ADD CONSTRAINT building_ownership_records_source_record_id_assessment_year_key UNIQUE (source_record_id, assessment_year);

--
-- Name: building_scores building_scores_building_id_category_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_scores
    ADD CONSTRAINT building_scores_building_id_category_id_key UNIQUE (building_id, category_id);

--
-- Name: building_scores building_scores_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_scores
    ADD CONSTRAINT building_scores_pkey PRIMARY KEY (id);

--
-- Name: building_slug_redirects building_slug_redirects_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_slug_redirects
    ADD CONSTRAINT building_slug_redirects_pkey PRIMARY KEY (old_slug);

--
-- Name: buildings buildings_bbl_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_bbl_key UNIQUE (bbl);

--
-- Name: buildings buildings_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.buildings
    ADD CONSTRAINT buildings_pkey PRIMARY KEY (id);

--
-- Name: calenviroscreen calenviroscreen_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.calenviroscreen
    ADD CONSTRAINT calenviroscreen_pkey PRIMARY KEY (id);

--
-- Name: complaints_311 complaints_311_part_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.complaints_311
    ADD CONSTRAINT complaints_311_part_pkey PRIMARY KEY (id, metro);

--
-- Name: complaints_311_chicago complaints_311_chicago_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.complaints_311_chicago
    ADD CONSTRAINT complaints_311_chicago_pkey PRIMARY KEY (id, metro);

--
-- Name: complaints_311_la complaints_311_la_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.complaints_311_la
    ADD CONSTRAINT complaints_311_la_pkey PRIMARY KEY (id, metro);

--
-- Name: complaints_311_nyc complaints_311_nyc_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.complaints_311_nyc
    ADD CONSTRAINT complaints_311_nyc_pkey PRIMARY KEY (id, metro);

--
-- Name: cook_county_sales cook_county_sales_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.cook_county_sales
    ADD CONSTRAINT cook_county_sales_pkey PRIMARY KEY (pin);

--
-- Name: crime_by_zip_cache crime_by_zip_cache_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.crime_by_zip_cache
    ADD CONSTRAINT crime_by_zip_cache_pkey PRIMARY KEY (metro, zip_code);

--
-- Name: crime_incidents crime_incidents_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.crime_incidents
    ADD CONSTRAINT crime_incidents_pkey PRIMARY KEY (id);

--
-- Name: dob_permits dob_permits_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_permits
    ADD CONSTRAINT dob_permits_pkey PRIMARY KEY (id);

--
-- Name: dob_permits dob_permits_work_permit_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_permits
    ADD CONSTRAINT dob_permits_work_permit_key UNIQUE (work_permit);

--
-- Name: dob_violations dob_violations_isn_dob_bis_vio_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_violations
    ADD CONSTRAINT dob_violations_isn_dob_bis_vio_key UNIQUE (isn_dob_bis_vio);

--
-- Name: dob_violations dob_violations_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_violations
    ADD CONSTRAINT dob_violations_pkey PRIMARY KEY (id);

--
-- Name: energy_benchmarks energy_benchmarks_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.energy_benchmarks
    ADD CONSTRAINT energy_benchmarks_pkey PRIMARY KEY (id);

--
-- Name: energy_benchmarks energy_benchmarks_property_id_report_year_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.energy_benchmarks
    ADD CONSTRAINT energy_benchmarks_property_id_report_year_key UNIQUE (property_id, report_year);

--
-- Name: flood_zones flood_zones_metro_zone_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.flood_zones
    ADD CONSTRAINT flood_zones_metro_zone_id_key UNIQUE (metro, zone_id);

--
-- Name: flood_zones flood_zones_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.flood_zones
    ADD CONSTRAINT flood_zones_pkey PRIMARY KEY (id);

--
-- Name: harris_county_owners harris_county_owners_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.harris_county_owners
    ADD CONSTRAINT harris_county_owners_pkey PRIMARY KEY (account);

--
-- Name: helpful_votes helpful_votes_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.helpful_votes
    ADD CONSTRAINT helpful_votes_pkey PRIMARY KEY (id);

--
-- Name: helpful_votes helpful_votes_user_id_review_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.helpful_votes
    ADD CONSTRAINT helpful_votes_user_id_review_id_key UNIQUE (user_id, review_id);

--
-- Name: hpd_litigations hpd_litigations_litigation_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_litigations
    ADD CONSTRAINT hpd_litigations_litigation_id_key UNIQUE (litigation_id);

--
-- Name: hpd_litigations hpd_litigations_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_litigations
    ADD CONSTRAINT hpd_litigations_pkey PRIMARY KEY (id);

--
-- Name: hpd_violations hpd_violations_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_violations
    ADD CONSTRAINT hpd_violations_pkey PRIMARY KEY (id);

--
-- Name: hpd_violations hpd_violations_violation_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_violations
    ADD CONSTRAINT hpd_violations_violation_id_key UNIQUE (violation_id);

--
-- Name: la_assessor_parcels la_assessor_parcels_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.la_assessor_parcels
    ADD CONSTRAINT la_assessor_parcels_pkey PRIMARY KEY (id);

--
-- Name: la_earthquake_retrofit la_earthquake_retrofit_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.la_earthquake_retrofit
    ADD CONSTRAINT la_earthquake_retrofit_pkey PRIMARY KEY (id);

--
-- Name: lahd_scep_inspections lahd_scep_inspections_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.lahd_scep_inspections
    ADD CONSTRAINT lahd_scep_inspections_pkey PRIMARY KEY (id);

--
-- Name: landlord_stats landlord_stats_name_metro_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.landlord_stats
    ADD CONSTRAINT landlord_stats_name_metro_key UNIQUE (name, metro);

--
-- Name: landlord_stats landlord_stats_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.landlord_stats
    ADD CONSTRAINT landlord_stats_pkey PRIMARY KEY (id);

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: review_categories review_categories_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_categories
    ADD CONSTRAINT review_categories_pkey PRIMARY KEY (id);

--
-- Name: review_categories review_categories_slug_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_categories
    ADD CONSTRAINT review_categories_slug_key UNIQUE (slug);

--
-- Name: review_category_ratings review_category_ratings_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_category_ratings
    ADD CONSTRAINT review_category_ratings_pkey PRIMARY KEY (id);

--
-- Name: review_category_ratings review_category_ratings_review_id_category_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_category_ratings
    ADD CONSTRAINT review_category_ratings_review_id_category_id_key UNIQUE (review_id, category_id);

--
-- Name: review_subcategories review_subcategories_category_id_slug_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_subcategories
    ADD CONSTRAINT review_subcategories_category_id_slug_key UNIQUE (category_id, slug);

--
-- Name: review_subcategories review_subcategories_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_subcategories
    ADD CONSTRAINT review_subcategories_pkey PRIMARY KEY (id);

--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

--
-- Name: saved_buildings saved_buildings_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.saved_buildings
    ADD CONSTRAINT saved_buildings_pkey PRIMARY KEY (id);

--
-- Name: saved_buildings saved_buildings_user_id_building_id_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.saved_buildings
    ADD CONSTRAINT saved_buildings_user_id_building_id_key UNIQUE (user_id, building_id);

--
-- Name: search_index search_index_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.search_index
    ADD CONSTRAINT search_index_pkey PRIMARY KEY (id);

--
-- Name: sitemap_building_cursors sitemap_building_cursors_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.sitemap_building_cursors
    ADD CONSTRAINT sitemap_building_cursors_pkey PRIMARY KEY (batch_index);

--
-- Name: sitemap_landlord_cursors sitemap_landlord_cursors_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.sitemap_landlord_cursors
    ADD CONSTRAINT sitemap_landlord_cursors_pkey PRIMARY KEY (batch_index);

--
-- Name: sync_log sync_log_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.sync_log
    ADD CONSTRAINT sync_log_pkey PRIMARY KEY (id);

--
-- Name: units units_building_id_unit_number_key; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_building_id_unit_number_key UNIQUE (building_id, unit_number);

--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);

--
-- Name: _zip_grid_nyc_glat_glon_idx; Type: INDEX; Schema: public;
--

CREATE INDEX _zip_grid_nyc_glat_glon_idx ON public._zip_grid_nyc USING btree (glat, glon);

--
-- Name: complaints_311_chicago_bld_date_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_chicago_bld_date_idx ON public.complaints_311_chicago USING btree (building_id, created_date DESC);

--
-- Name: complaints_311_part_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_part_building_id ON ONLY public.complaints_311 USING btree (building_id);

--
-- Name: complaints_311_chicago_building_id_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_chicago_building_id_idx ON public.complaints_311_chicago USING btree (building_id);

--
-- Name: complaints_311_part_created_date; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_part_created_date ON ONLY public.complaints_311 USING btree (created_date DESC);

--
-- Name: complaints_311_chicago_created_date_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_chicago_created_date_idx ON public.complaints_311_chicago USING btree (created_date DESC);

--
-- Name: complaints_311_part_metro; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_part_metro ON ONLY public.complaints_311 USING btree (metro);

--
-- Name: complaints_311_chicago_metro_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_chicago_metro_idx ON public.complaints_311_chicago USING btree (metro);

--
-- Name: complaints_311_part_unique_key; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX complaints_311_part_unique_key ON ONLY public.complaints_311 USING btree (unique_key, metro);

--
-- Name: complaints_311_chicago_unique_key_metro_idx; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX complaints_311_chicago_unique_key_metro_idx ON public.complaints_311_chicago USING btree (unique_key, metro);

--
-- Name: complaints_311_la_bld_date_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_la_bld_date_idx ON public.complaints_311_la USING btree (building_id, created_date DESC);

--
-- Name: complaints_311_la_building_id_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_la_building_id_idx ON public.complaints_311_la USING btree (building_id);

--
-- Name: complaints_311_la_created_date_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_la_created_date_idx ON public.complaints_311_la USING btree (created_date DESC);

--
-- Name: complaints_311_la_metro_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_la_metro_idx ON public.complaints_311_la USING btree (metro);

--
-- Name: complaints_311_la_unique_key_metro_idx; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX complaints_311_la_unique_key_metro_idx ON public.complaints_311_la USING btree (unique_key, metro);

--
-- Name: complaints_311_nyc_building_id_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_nyc_building_id_idx ON public.complaints_311_nyc USING btree (building_id);

--
-- Name: complaints_311_nyc_created_date_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_nyc_created_date_idx ON public.complaints_311_nyc USING btree (created_date DESC);

--
-- Name: complaints_311_nyc_metro_idx; Type: INDEX; Schema: public;
--

CREATE INDEX complaints_311_nyc_metro_idx ON public.complaints_311_nyc USING btree (metro);

--
-- Name: complaints_311_nyc_unique_key_metro_idx; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX complaints_311_nyc_unique_key_metro_idx ON public.complaints_311_nyc USING btree (unique_key, metro);

--
-- Name: flood_zones_geom_idx; Type: INDEX; Schema: public;
--

CREATE INDEX flood_zones_geom_idx ON public.flood_zones USING gist (geom);

--
-- Name: flood_zones_metro_idx; Type: INDEX; Schema: public;
--

CREATE INDEX flood_zones_metro_idx ON public.flood_zones USING btree (metro);

--
-- Name: idx_addr_link_map; Type: INDEX; Schema: public;
--

CREATE INDEX idx_addr_link_map ON public._addr_link_map USING btree (norm_addr, metro);

--
-- Name: idx_backfill_runs_metro_source; Type: INDEX; Schema: public;
--

CREATE INDEX idx_backfill_runs_metro_source ON public.backfill_runs USING btree (metro, source);

--
-- Name: idx_backfill_runs_status; Type: INDEX; Schema: public;
--

CREATE INDEX idx_backfill_runs_status ON public.backfill_runs USING btree (status);

--
-- Name: idx_bor_building; Type: INDEX; Schema: public;
--

CREATE INDEX idx_bor_building ON public.building_ownership_records USING btree (building_id);

--
-- Name: idx_bor_mailing; Type: INDEX; Schema: public;
--

CREATE INDEX idx_bor_mailing ON public.building_ownership_records USING btree (owner_mailing_zip, owner_mailing_address) WHERE (owner_mailing_address IS NOT NULL);

--
-- Name: idx_bor_owner_name; Type: INDEX; Schema: public;
--

CREATE INDEX idx_bor_owner_name ON public.building_ownership_records USING btree (owner_name);

--
-- Name: idx_bor_recording_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_bor_recording_date ON public.building_ownership_records USING btree (recording_date) WHERE (recording_date IS NOT NULL);

--
-- Name: idx_bor_source_type; Type: INDEX; Schema: public;
--

CREATE INDEX idx_bor_source_type ON public.building_ownership_records USING btree (source_type);

--
-- Name: idx_building_scores_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_building_scores_building_id ON public.building_scores USING btree (building_id);

--
-- Name: idx_building_scores_category_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_building_scores_category_id ON public.building_scores USING btree (category_id);

--
-- Name: idx_building_slug_redirects_new; Type: INDEX; Schema: public;
--

CREATE INDEX idx_building_slug_redirects_new ON public.building_slug_redirects USING btree (new_slug);

--
-- Name: idx_buildings_borough; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_borough ON public.buildings USING btree (borough);

--
-- Name: idx_buildings_chicago_norm; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_chicago_norm ON public.buildings USING btree (public.normalize_street((street_name)::text), upper((house_number)::text)) WHERE (metro = 'chicago'::text);

--
-- Name: idx_buildings_fair_plan; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_fair_plan ON public.buildings USING btree (fair_plan_risk) WHERE (fair_plan_risk = true);

--
-- Name: idx_buildings_full_address_trgm; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_full_address_trgm ON public.buildings USING gin (full_address extensions.gin_trgm_ops);

--
-- Name: idx_buildings_la_norm; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_la_norm ON public.buildings USING btree (public.normalize_street((street_name)::text), upper((house_number)::text)) WHERE (metro = 'los-angeles'::text);

--
-- Name: idx_buildings_metro_best; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_metro_best ON public.buildings USING btree (metro, overall_score DESC, review_count DESC) WHERE ((overall_score > (0)::numeric) AND (review_count > 0));

--
-- Name: idx_buildings_metro_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_metro_id ON public.buildings USING btree (metro, id);

--
-- Name: idx_buildings_metro_stabilized; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_metro_stabilized ON public.buildings USING btree (metro, borough) WHERE (is_rent_stabilized = true);

--
-- Name: idx_buildings_metro_units; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_metro_units ON public.buildings USING btree (metro, residential_units DESC NULLS LAST);

--
-- Name: idx_buildings_nyc_norm; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_nyc_norm ON public.buildings USING btree (public.normalize_street((street_name)::text), upper((house_number)::text)) WHERE (metro = 'nyc'::text);

--
-- Name: idx_buildings_owner_name; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_owner_name ON public.buildings USING btree (owner_name);

--
-- Name: idx_buildings_owner_type; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_owner_type ON public.buildings USING btree (owner_type) WHERE (owner_type IS NOT NULL);

--
-- Name: idx_buildings_street_address; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_street_address ON public.buildings USING btree (street_name, house_number);

--
-- Name: idx_buildings_zip_code; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_zip_code ON public.buildings USING btree (zip_code);

--
-- Name: idx_buildings_zipless_with_coords; Type: INDEX; Schema: public;
--

CREATE INDEX idx_buildings_zipless_with_coords ON public.buildings USING btree (metro, id) WHERE ((zip_code IS NULL) AND (latitude IS NOT NULL) AND (longitude IS NOT NULL));

--
-- Name: idx_calenviroscreen_percentile; Type: INDEX; Schema: public;
--

CREATE INDEX idx_calenviroscreen_percentile ON public.calenviroscreen USING btree (ces_percentile DESC);

--
-- Name: idx_calenviroscreen_tract; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX idx_calenviroscreen_tract ON public.calenviroscreen USING btree (census_tract);

--
-- Name: idx_calenviroscreen_zip; Type: INDEX; Schema: public;
--

CREATE INDEX idx_calenviroscreen_zip ON public.calenviroscreen USING btree (zip_code);

--
-- Name: idx_complaints_311_chicago_unlinked_by_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_complaints_311_chicago_unlinked_by_date ON public.complaints_311_chicago USING btree (created_date DESC) WHERE (building_id IS NULL);

--
-- Name: idx_complaints_311_la_unlinked_by_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_complaints_311_la_unlinked_by_date ON public.complaints_311_la USING btree (created_date DESC) WHERE (building_id IS NULL);

--
-- Name: idx_complaints_311_nyc_imported_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_complaints_311_nyc_imported_unlinked ON public.complaints_311_nyc USING btree (imported_at) WHERE (building_id IS NULL);

--
-- Name: idx_complaints_311_nyc_unlinked_by_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_complaints_311_nyc_unlinked_by_date ON public.complaints_311_nyc USING btree (created_date) WHERE (building_id IS NULL);

--
-- Name: idx_crime_incidents_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_crime_incidents_date ON public.crime_incidents USING btree (date);

--
-- Name: idx_crime_incidents_lat_lng; Type: INDEX; Schema: public;
--

CREATE INDEX idx_crime_incidents_lat_lng ON public.crime_incidents USING btree (latitude, longitude);

--
-- Name: idx_crime_incidents_metro; Type: INDEX; Schema: public;
--

CREATE INDEX idx_crime_incidents_metro ON public.crime_incidents USING btree (metro);

--
-- Name: idx_crime_incidents_zip; Type: INDEX; Schema: public;
--

CREATE INDEX idx_crime_incidents_zip ON public.crime_incidents USING btree (zip_code);

--
-- Name: idx_dob_permits_miami_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_permits_miami_unlinked ON public.dob_permits USING btree (metro, building_id) WHERE (building_id IS NULL);

--
-- Name: idx_dob_permits_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_permits_unlinked ON public.dob_permits USING btree (metro, id) WHERE (building_id IS NULL);

--
-- Name: idx_dob_violations_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_bbl ON public.dob_violations USING btree (bbl);

--
-- Name: idx_dob_violations_bin; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_bin ON public.dob_violations USING btree (bin);

--
-- Name: idx_dob_violations_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_building_id ON public.dob_violations USING btree (building_id);

--
-- Name: idx_dob_violations_issue_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_issue_date ON public.dob_violations USING btree (issue_date DESC);

--
-- Name: idx_dob_violations_miami_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_miami_unlinked ON public.dob_violations USING btree (metro, building_id) WHERE (building_id IS NULL);

--
-- Name: idx_dob_violations_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_unlinked ON public.dob_violations USING btree (metro, id) WHERE (building_id IS NULL);

--
-- Name: idx_dob_violations_unlinked_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_unlinked_bbl ON public.dob_violations USING btree (bbl) WHERE ((building_id IS NULL) AND (bbl IS NOT NULL) AND ((bbl)::text <> ''::text));

--
-- Name: idx_dob_violations_unlinked_cursor; Type: INDEX; Schema: public;
--

CREATE INDEX idx_dob_violations_unlinked_cursor ON public.dob_violations USING btree (metro, id) WHERE ((building_id IS NULL) AND (street_name IS NOT NULL));

--
-- Name: idx_energy_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_bbl ON public.energy_benchmarks USING btree (bbl);

--
-- Name: idx_energy_benchmarks_pin; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_benchmarks_pin ON public.energy_benchmarks USING btree (pin) WHERE (pin IS NOT NULL);

--
-- Name: idx_energy_borough; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_borough ON public.energy_benchmarks USING btree (borough);

--
-- Name: idx_energy_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_building_id ON public.energy_benchmarks USING btree (building_id);

--
-- Name: idx_energy_report_year; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_report_year ON public.energy_benchmarks USING btree (report_year DESC);

--
-- Name: idx_energy_score; Type: INDEX; Schema: public;
--

CREATE INDEX idx_energy_score ON public.energy_benchmarks USING btree (energy_star_score);

--
-- Name: idx_helpful_votes_review_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_helpful_votes_review_id ON public.helpful_votes USING btree (review_id);

--
-- Name: idx_helpful_votes_user_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_helpful_votes_user_id ON public.helpful_votes USING btree (user_id);

--
-- Name: idx_hpd_litigations_building; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_litigations_building ON public.hpd_litigations USING btree (building_id);

--
-- Name: idx_hpd_violations_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_bbl ON public.hpd_violations USING btree (bbl);

--
-- Name: idx_hpd_violations_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_building_id ON public.hpd_violations USING btree (building_id);

--
-- Name: idx_hpd_violations_houston_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_houston_unlinked ON public.hpd_violations USING btree (upper((house_number)::text), upper((street_name)::text)) WHERE ((metro = 'houston'::text) AND (building_id IS NULL));

--
-- Name: idx_hpd_violations_inspection_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_inspection_date ON public.hpd_violations USING btree (inspection_date DESC);

--
-- Name: idx_hpd_violations_nov_issue_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_nov_issue_date ON public.hpd_violations USING btree (nov_issue_date);

--
-- Name: idx_hpd_violations_unlinked; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_unlinked ON public.hpd_violations USING btree (metro, id) WHERE (building_id IS NULL);

--
-- Name: idx_hpd_violations_unlinked_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_hpd_violations_unlinked_bbl ON public.hpd_violations USING btree (bbl) WHERE ((building_id IS NULL) AND (bbl IS NOT NULL) AND ((bbl)::text <> ''::text));

--
-- Name: idx_la_assessor_apn; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX idx_la_assessor_apn ON public.la_assessor_parcels USING btree (apn);

--
-- Name: idx_la_assessor_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_la_assessor_building_id ON public.la_assessor_parcels USING btree (building_id);

--
-- Name: idx_la_earthquake_apn; Type: INDEX; Schema: public;
--

CREATE INDEX idx_la_earthquake_apn ON public.la_earthquake_retrofit USING btree (apn) WHERE (apn IS NOT NULL);

--
-- Name: idx_la_earthquake_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_la_earthquake_building_id ON public.la_earthquake_retrofit USING btree (building_id) WHERE (building_id IS NOT NULL);

--
-- Name: idx_la_earthquake_status; Type: INDEX; Schema: public;
--

CREATE INDEX idx_la_earthquake_status ON public.la_earthquake_retrofit USING btree (compliance_status);

--
-- Name: idx_lahd_scep_apn; Type: INDEX; Schema: public;
--

CREATE INDEX idx_lahd_scep_apn ON public.lahd_scep_inspections USING btree (apn);

--
-- Name: idx_lahd_scep_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_lahd_scep_building_id ON public.lahd_scep_inspections USING btree (building_id);

--
-- Name: idx_lahd_scep_imported_at; Type: INDEX; Schema: public;
--

CREATE INDEX idx_lahd_scep_imported_at ON public.lahd_scep_inspections USING btree (imported_at);

--
-- Name: idx_lahd_scep_unique; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX idx_lahd_scep_unique ON public.lahd_scep_inspections USING btree (COALESCE(case_number, ''::character varying), COALESCE(apn, ''::character varying));

--
-- Name: idx_landlord_stats_buildings; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_buildings ON public.landlord_stats USING btree (building_count DESC);

--
-- Name: idx_landlord_stats_complaints; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_complaints ON public.landlord_stats USING btree (total_complaints DESC);

--
-- Name: idx_landlord_stats_metro; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_metro ON public.landlord_stats USING btree (metro);

--
-- Name: idx_landlord_stats_search_cover; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_search_cover ON public.landlord_stats USING btree (metro, upper(btrim(name)) text_pattern_ops, total_violations DESC) INCLUDE (name, slug, building_count, total_complaints, total_litigations, total_dob_violations, avg_score, worst_building_id, worst_building_address, worst_building_violations);

--
-- Name: idx_landlord_stats_slug; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_slug ON public.landlord_stats USING btree (slug);

--
-- Name: idx_landlord_stats_violations; Type: INDEX; Schema: public;
--

CREATE INDEX idx_landlord_stats_violations ON public.landlord_stats USING btree (total_violations DESC);

--
-- Name: idx_permits_bbl; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_bbl ON public.dob_permits USING btree (bbl);

--
-- Name: idx_permits_borough; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_borough ON public.dob_permits USING btree (borough);

--
-- Name: idx_permits_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_building_id ON public.dob_permits USING btree (building_id);

--
-- Name: idx_permits_issued_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_issued_date ON public.dob_permits USING btree (issued_date DESC);

--
-- Name: idx_permits_miami_addr; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_miami_addr ON public.dob_permits USING btree (upper((house_no)::text), upper((street_name)::text)) WHERE ((metro = 'miami'::text) AND (building_id IS NULL));

--
-- Name: idx_permits_status; Type: INDEX; Schema: public;
--

CREATE INDEX idx_permits_status ON public.dob_permits USING btree (permit_status);

--
-- Name: idx_review_category_ratings_category_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_review_category_ratings_category_id ON public.review_category_ratings USING btree (category_id);

--
-- Name: idx_review_category_ratings_review_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_review_category_ratings_review_id ON public.review_category_ratings USING btree (review_id);

--
-- Name: idx_reviews_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_building_id ON public.reviews USING btree (building_id);

--
-- Name: idx_reviews_created_at; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_created_at ON public.reviews USING btree (created_at DESC);

--
-- Name: idx_reviews_source; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_source ON public.reviews USING btree (source);

--
-- Name: idx_reviews_status; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_status ON public.reviews USING btree (status);

--
-- Name: idx_reviews_unit_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_unit_id ON public.reviews USING btree (unit_id);

--
-- Name: idx_reviews_user_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_reviews_user_id ON public.reviews USING btree (user_id);

--
-- Name: idx_saved_buildings_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_saved_buildings_building_id ON public.saved_buildings USING btree (building_id);

--
-- Name: idx_saved_buildings_user_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_saved_buildings_user_id ON public.saved_buildings USING btree (user_id);

--
-- Name: idx_search_index_metro_addr; Type: INDEX; Schema: public;
--

CREATE INDEX idx_search_index_metro_addr ON public.search_index USING btree (metro, full_address text_pattern_ops);

--
-- Name: idx_sync_log_status; Type: INDEX; Schema: public;
--

CREATE INDEX idx_sync_log_status ON public.sync_log USING btree (status);

--
-- Name: idx_sync_log_type_date; Type: INDEX; Schema: public;
--

CREATE INDEX idx_sync_log_type_date ON public.sync_log USING btree (sync_type, started_at DESC);

--
-- Name: idx_units_building_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_units_building_id ON public.units USING btree (building_id);

--
-- Name: idx_violations_houston_unlinked_id; Type: INDEX; Schema: public;
--

CREATE INDEX idx_violations_houston_unlinked_id ON public.hpd_violations USING btree (id) WHERE ((metro = 'houston'::text) AND (building_id IS NULL) AND (house_number IS NOT NULL) AND (street_name IS NOT NULL));

--
-- Name: idx_zip_lookup; Type: INDEX; Schema: public;
--

CREATE INDEX idx_zip_lookup ON public._zip_lookup USING btree (glat, glon);

--
-- Name: complaints_311_chicago_building_id_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_building_id ATTACH PARTITION public.complaints_311_chicago_building_id_idx;

--
-- Name: complaints_311_chicago_created_date_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_created_date ATTACH PARTITION public.complaints_311_chicago_created_date_idx;

--
-- Name: complaints_311_chicago_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_metro ATTACH PARTITION public.complaints_311_chicago_metro_idx;

--
-- Name: complaints_311_chicago_pkey; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_pkey ATTACH PARTITION public.complaints_311_chicago_pkey;

--
-- Name: complaints_311_chicago_unique_key_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_unique_key ATTACH PARTITION public.complaints_311_chicago_unique_key_metro_idx;

--
-- Name: complaints_311_la_building_id_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_building_id ATTACH PARTITION public.complaints_311_la_building_id_idx;

--
-- Name: complaints_311_la_created_date_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_created_date ATTACH PARTITION public.complaints_311_la_created_date_idx;

--
-- Name: complaints_311_la_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_metro ATTACH PARTITION public.complaints_311_la_metro_idx;

--
-- Name: complaints_311_la_pkey; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_pkey ATTACH PARTITION public.complaints_311_la_pkey;

--
-- Name: complaints_311_la_unique_key_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_unique_key ATTACH PARTITION public.complaints_311_la_unique_key_metro_idx;

--
-- Name: complaints_311_nyc_building_id_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_building_id ATTACH PARTITION public.complaints_311_nyc_building_id_idx;

--
-- Name: complaints_311_nyc_created_date_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_created_date ATTACH PARTITION public.complaints_311_nyc_created_date_idx;

--
-- Name: complaints_311_nyc_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_metro ATTACH PARTITION public.complaints_311_nyc_metro_idx;

--
-- Name: complaints_311_nyc_pkey; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_pkey ATTACH PARTITION public.complaints_311_nyc_pkey;

--
-- Name: complaints_311_nyc_unique_key_metro_idx; Type: INDEX ATTACH; Schema: public;
--

ALTER INDEX public.complaints_311_part_unique_key ATTACH PARTITION public.complaints_311_nyc_unique_key_metro_idx;

--
-- Name: buildings trg_buildings_updated_at; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_buildings_updated_at BEFORE UPDATE ON public.buildings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: dob_permits trg_dob_permits_stmt_dec; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_dob_permits_stmt_dec AFTER DELETE ON public.dob_permits REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_decrement_building_count('permit_count');

--
-- Name: dob_permits trg_dob_permits_stmt_inc; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_dob_permits_stmt_inc AFTER INSERT ON public.dob_permits REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_increment_building_count('permit_count');

--
-- Name: dob_violations trg_dob_violations_stmt_dec; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_dob_violations_stmt_dec AFTER DELETE ON public.dob_violations REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_decrement_building_count('dob_violation_count');

--
-- Name: dob_violations trg_dob_violations_stmt_inc; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_dob_violations_stmt_inc AFTER INSERT ON public.dob_violations REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_increment_building_count('dob_violation_count');

--
-- Name: hpd_litigations trg_hpd_litigations_stmt_dec; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_hpd_litigations_stmt_dec AFTER DELETE ON public.hpd_litigations REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_decrement_building_count('litigation_count');

--
-- Name: hpd_litigations trg_hpd_litigations_stmt_inc; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_hpd_litigations_stmt_inc AFTER INSERT ON public.hpd_litigations REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_increment_building_count('litigation_count');

--
-- Name: hpd_violations trg_hpd_violations_stmt_dec; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_hpd_violations_stmt_dec AFTER DELETE ON public.hpd_violations REFERENCING OLD TABLE AS old_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_decrement_building_count('violation_count');

--
-- Name: hpd_violations trg_hpd_violations_stmt_inc; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_hpd_violations_stmt_inc AFTER INSERT ON public.hpd_violations REFERENCING NEW TABLE AS new_rows FOR EACH STATEMENT EXECUTE FUNCTION public.stmt_increment_building_count('violation_count');

--
-- Name: profiles trg_profiles_updated_at; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: reviews trg_reviews_updated_at; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_reviews_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: units trg_units_updated_at; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_units_updated_at BEFORE UPDATE ON public.units FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: reviews trg_update_building_review_stats; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_update_building_review_stats AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_building_review_stats();

--
-- Name: helpful_votes trg_update_helpful_count; Type: TRIGGER; Schema: public;
--

CREATE TRIGGER trg_update_helpful_count AFTER INSERT OR DELETE ON public.helpful_votes FOR EACH ROW EXECUTE FUNCTION public.update_helpful_count();

--
-- Name: building_ownership_records building_ownership_records_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_ownership_records
    ADD CONSTRAINT building_ownership_records_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;

--
-- Name: building_scores building_scores_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_scores
    ADD CONSTRAINT building_scores_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;

--
-- Name: building_scores building_scores_category_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.building_scores
    ADD CONSTRAINT building_scores_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.review_categories(id) ON DELETE CASCADE;

--
-- Name: complaints_311 complaints_311_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE public.complaints_311
    ADD CONSTRAINT complaints_311_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: dob_permits dob_permits_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_permits
    ADD CONSTRAINT dob_permits_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: dob_violations dob_violations_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.dob_violations
    ADD CONSTRAINT dob_violations_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: energy_benchmarks energy_benchmarks_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.energy_benchmarks
    ADD CONSTRAINT energy_benchmarks_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: helpful_votes helpful_votes_review_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.helpful_votes
    ADD CONSTRAINT helpful_votes_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;

--
-- Name: helpful_votes helpful_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.helpful_votes
    ADD CONSTRAINT helpful_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: hpd_litigations hpd_litigations_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_litigations
    ADD CONSTRAINT hpd_litigations_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: hpd_violations hpd_violations_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.hpd_violations
    ADD CONSTRAINT hpd_violations_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: la_earthquake_retrofit la_earthquake_retrofit_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.la_earthquake_retrofit
    ADD CONSTRAINT la_earthquake_retrofit_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id);

--
-- Name: lahd_scep_inspections lahd_scep_inspections_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.lahd_scep_inspections
    ADD CONSTRAINT lahd_scep_inspections_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: review_category_ratings review_category_ratings_category_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_category_ratings
    ADD CONSTRAINT review_category_ratings_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.review_categories(id) ON DELETE CASCADE;

--
-- Name: review_category_ratings review_category_ratings_review_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_category_ratings
    ADD CONSTRAINT review_category_ratings_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;

--
-- Name: review_subcategories review_subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.review_subcategories
    ADD CONSTRAINT review_subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.review_categories(id) ON DELETE CASCADE;

--
-- Name: reviews reviews_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;

--
-- Name: reviews reviews_unit_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;

--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: saved_buildings saved_buildings_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.saved_buildings
    ADD CONSTRAINT saved_buildings_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;

--
-- Name: saved_buildings saved_buildings_user_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.saved_buildings
    ADD CONSTRAINT saved_buildings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

--
-- Name: units units_building_id_fkey; Type: FK CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_building_id_fkey FOREIGN KEY (building_id) REFERENCES public.buildings(id) ON DELETE CASCADE;

--
-- Name: landlord_stats Allow public read; Type: POLICY; Schema: public;
--

CREATE POLICY "Allow public read" ON public.landlord_stats FOR SELECT USING (true);

--
-- Name: sitemap_building_cursors Allow public read; Type: POLICY; Schema: public;
--

CREATE POLICY "Allow public read" ON public.sitemap_building_cursors FOR SELECT USING (true);

--
-- Name: sitemap_landlord_cursors Allow public read; Type: POLICY; Schema: public;
--

CREATE POLICY "Allow public read" ON public.sitemap_landlord_cursors FOR SELECT USING (true);

--
-- Name: crime_by_zip_cache Public read; Type: POLICY; Schema: public;
--

CREATE POLICY "Public read" ON public.crime_by_zip_cache FOR SELECT USING (true);

--
-- Name: building_ownership_records Public read building_ownership_records; Type: POLICY; Schema: public;
--

CREATE POLICY "Public read building_ownership_records" ON public.building_ownership_records FOR SELECT USING (true);

--
-- Name: _addr_link_map; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public._addr_link_map ENABLE ROW LEVEL SECURITY;

--
-- Name: _tmp_311_building_map; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public._tmp_311_building_map ENABLE ROW LEVEL SECURITY;

--
-- Name: _zip_grid_nyc; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public._zip_grid_nyc ENABLE ROW LEVEL SECURITY;

--
-- Name: _zip_lookup; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public._zip_lookup ENABLE ROW LEVEL SECURITY;

--
-- Name: backfill_runs; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.backfill_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: building_ownership_records; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.building_ownership_records ENABLE ROW LEVEL SECURITY;

--
-- Name: building_scores; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.building_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: building_scores building_scores_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY building_scores_select_public ON public.building_scores FOR SELECT USING (true);

--
-- Name: building_slug_redirects; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.building_slug_redirects ENABLE ROW LEVEL SECURITY;

--
-- Name: buildings; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

--
-- Name: buildings buildings_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY buildings_select_public ON public.buildings FOR SELECT USING (true);

--
-- Name: calenviroscreen; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.calenviroscreen ENABLE ROW LEVEL SECURITY;

--
-- Name: calenviroscreen calenviroscreen_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY calenviroscreen_select_public ON public.calenviroscreen FOR SELECT USING (true);

--
-- Name: complaints_311; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.complaints_311 ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_311_chicago; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.complaints_311_chicago ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_311_la; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.complaints_311_la ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_311_nyc; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.complaints_311_nyc ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_311 complaints_311_public_read; Type: POLICY; Schema: public;
--

CREATE POLICY complaints_311_public_read ON public.complaints_311 FOR SELECT TO authenticated, anon USING (true);

--
-- Name: cook_county_sales; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.cook_county_sales ENABLE ROW LEVEL SECURITY;

--
-- Name: crime_by_zip_cache; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.crime_by_zip_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: crime_incidents; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.crime_incidents ENABLE ROW LEVEL SECURITY;

--
-- Name: dob_permits; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.dob_permits ENABLE ROW LEVEL SECURITY;

--
-- Name: dob_violations; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.dob_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: dob_violations dob_violations_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY dob_violations_select_public ON public.dob_violations FOR SELECT USING (true);

--
-- Name: energy_benchmarks; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.energy_benchmarks ENABLE ROW LEVEL SECURITY;

--
-- Name: energy_benchmarks energy_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY energy_select_public ON public.energy_benchmarks FOR SELECT USING (true);

--
-- Name: flood_zones; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.flood_zones ENABLE ROW LEVEL SECURITY;

--
-- Name: flood_zones flood_zones_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY flood_zones_select_public ON public.flood_zones FOR SELECT USING (true);

--
-- Name: harris_county_owners; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.harris_county_owners ENABLE ROW LEVEL SECURITY;

--
-- Name: helpful_votes; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.helpful_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: helpful_votes helpful_votes_delete_own; Type: POLICY; Schema: public;
--

CREATE POLICY helpful_votes_delete_own ON public.helpful_votes FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: helpful_votes helpful_votes_insert_own; Type: POLICY; Schema: public;
--

CREATE POLICY helpful_votes_insert_own ON public.helpful_votes FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: helpful_votes helpful_votes_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY helpful_votes_select_public ON public.helpful_votes FOR SELECT USING (true);

--
-- Name: hpd_litigations; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.hpd_litigations ENABLE ROW LEVEL SECURITY;

--
-- Name: hpd_violations; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.hpd_violations ENABLE ROW LEVEL SECURITY;

--
-- Name: hpd_violations hpd_violations_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY hpd_violations_select_public ON public.hpd_violations FOR SELECT USING (true);

--
-- Name: la_assessor_parcels; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.la_assessor_parcels ENABLE ROW LEVEL SECURITY;

--
-- Name: la_assessor_parcels la_assessor_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY la_assessor_select_public ON public.la_assessor_parcels FOR SELECT USING (true);

--
-- Name: la_earthquake_retrofit; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.la_earthquake_retrofit ENABLE ROW LEVEL SECURITY;

--
-- Name: la_earthquake_retrofit la_earthquake_retrofit_select; Type: POLICY; Schema: public;
--

CREATE POLICY la_earthquake_retrofit_select ON public.la_earthquake_retrofit FOR SELECT USING (true);

--
-- Name: lahd_scep_inspections; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.lahd_scep_inspections ENABLE ROW LEVEL SECURITY;

--
-- Name: lahd_scep_inspections lahd_scep_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY lahd_scep_select_public ON public.lahd_scep_inspections FOR SELECT USING (true);

--
-- Name: landlord_stats; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.landlord_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: dob_permits permits_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY permits_select_public ON public.dob_permits FOR SELECT USING (true);

--
-- Name: profiles; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_insert_own; Type: POLICY; Schema: public;
--

CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = id));

--
-- Name: profiles profiles_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY profiles_select_public ON public.profiles FOR SELECT USING (true);

--
-- Name: profiles profiles_update_own; Type: POLICY; Schema: public;
--

CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

--
-- Name: review_categories; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.review_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: review_categories review_categories_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY review_categories_select_public ON public.review_categories FOR SELECT USING (true);

--
-- Name: review_category_ratings; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.review_category_ratings ENABLE ROW LEVEL SECURITY;

--
-- Name: review_category_ratings review_category_ratings_delete_own; Type: POLICY; Schema: public;
--

CREATE POLICY review_category_ratings_delete_own ON public.review_category_ratings FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.reviews
  WHERE ((reviews.id = review_category_ratings.review_id) AND (reviews.user_id = ( SELECT auth.uid() AS uid))))));

--
-- Name: review_category_ratings review_category_ratings_insert_own; Type: POLICY; Schema: public;
--

CREATE POLICY review_category_ratings_insert_own ON public.review_category_ratings FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.reviews
  WHERE ((reviews.id = review_category_ratings.review_id) AND (reviews.user_id = ( SELECT auth.uid() AS uid))))));

--
-- Name: review_category_ratings review_category_ratings_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY review_category_ratings_select_public ON public.review_category_ratings FOR SELECT USING (true);

--
-- Name: review_category_ratings review_category_ratings_update_own; Type: POLICY; Schema: public;
--

CREATE POLICY review_category_ratings_update_own ON public.review_category_ratings FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.reviews
  WHERE ((reviews.id = review_category_ratings.review_id) AND (reviews.user_id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.reviews
  WHERE ((reviews.id = review_category_ratings.review_id) AND (reviews.user_id = ( SELECT auth.uid() AS uid))))));

--
-- Name: review_subcategories; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.review_subcategories ENABLE ROW LEVEL SECURITY;

--
-- Name: review_subcategories review_subcategories_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY review_subcategories_select_public ON public.review_subcategories FOR SELECT USING (true);

--
-- Name: reviews; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: reviews reviews_delete_own; Type: POLICY; Schema: public;
--

CREATE POLICY reviews_delete_own ON public.reviews FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: reviews reviews_insert_own; Type: POLICY; Schema: public;
--

CREATE POLICY reviews_insert_own ON public.reviews FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: reviews reviews_select_published; Type: POLICY; Schema: public;
--

CREATE POLICY reviews_select_published ON public.reviews FOR SELECT USING (((status)::text = 'published'::text));

--
-- Name: reviews reviews_update_own; Type: POLICY; Schema: public;
--

CREATE POLICY reviews_update_own ON public.reviews FOR UPDATE USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: saved_buildings; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.saved_buildings ENABLE ROW LEVEL SECURITY;

--
-- Name: saved_buildings saved_buildings_delete_own; Type: POLICY; Schema: public;
--

CREATE POLICY saved_buildings_delete_own ON public.saved_buildings FOR DELETE USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: saved_buildings saved_buildings_insert_own; Type: POLICY; Schema: public;
--

CREATE POLICY saved_buildings_insert_own ON public.saved_buildings FOR INSERT WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: saved_buildings saved_buildings_select_own; Type: POLICY; Schema: public;
--

CREATE POLICY saved_buildings_select_own ON public.saved_buildings FOR SELECT USING ((( SELECT auth.uid() AS uid) = user_id));

--
-- Name: search_index; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.search_index ENABLE ROW LEVEL SECURITY;

--
-- Name: sitemap_building_cursors; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.sitemap_building_cursors ENABLE ROW LEVEL SECURITY;

--
-- Name: sitemap_landlord_cursors; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.sitemap_landlord_cursors ENABLE ROW LEVEL SECURITY;

--
-- Name: sync_log; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: units; Type: ROW SECURITY; Schema: public;
--

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

--
-- Name: units units_select_public; Type: POLICY; Schema: public;
--

CREATE POLICY units_select_public ON public.units FOR SELECT USING (true);

--
-- Manual additions (not derivable from the prod dump):
-- miami/houston partitions of complaints_311 existed from the April 2026
-- partition split until 20260812000000_drop_miami_houston_and_dead_tables
-- dropped them; mid-chain migrations still reference them.
--
CREATE TABLE public.complaints_311_miami PARTITION OF public.complaints_311 FOR VALUES IN ('miami');
CREATE TABLE public.complaints_311_houston PARTITION OF public.complaints_311 FOR VALUES IN ('houston');
