-- Composite (building_id, date DESC) indexes + RPC functions that use
-- LATERAL joins to fetch the most recent N records per building. This
-- replaces the .in().limit() pattern in the landlord /record loaders,
-- which was sorting the entire match-set across thousands of records.
--
-- Linden Plaza (2 buildings, 16k violations on file): .in() approach
-- was ~12s, the RPC is ~50ms.

CREATE INDEX IF NOT EXISTS complaints_311_nyc_bld_date_idx
  ON public.complaints_311_nyc (building_id, created_date DESC);

CREATE OR REPLACE FUNCTION public.landlord_violations_preview(
  p_building_ids uuid[],
  p_per_building int DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  building_id uuid,
  violation_id varchar,
  class text,
  inspection_date date,
  nov_description text,
  status varchar,
  apartment varchar
)
LANGUAGE sql STABLE
AS $$
  SELECT v.id, v.building_id, v.violation_id, v.class, v.inspection_date, v.nov_description, v.status, v.apartment
  FROM unnest(p_building_ids) AS bid
  CROSS JOIN LATERAL (
    SELECT id, building_id, violation_id, class, inspection_date, nov_description, status, apartment
    FROM hpd_violations
    WHERE building_id = bid
    ORDER BY inspection_date DESC
    LIMIT p_per_building
  ) v
$$;

CREATE OR REPLACE FUNCTION public.landlord_complaints_preview(
  p_building_ids uuid[],
  p_per_building int DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  building_id uuid,
  complaint_type text,
  descriptor text,
  agency text,
  status text,
  created_date timestamptz,
  closed_date timestamptz
)
LANGUAGE sql STABLE
AS $$
  SELECT c.id, c.building_id, c.complaint_type, c.descriptor, c.agency, c.status, c.created_date, c.closed_date
  FROM unnest(p_building_ids) AS bid
  CROSS JOIN LATERAL (
    SELECT id, building_id, complaint_type, descriptor, agency, status, created_date, closed_date
    FROM complaints_311_nyc
    WHERE building_id = bid
    ORDER BY created_date DESC
    LIMIT p_per_building
  ) c
$$;

CREATE OR REPLACE FUNCTION public.landlord_litigations_preview(
  p_building_ids uuid[],
  p_per_building int DEFAULT 8
)
RETURNS TABLE(
  id uuid,
  building_id uuid,
  litigation_id text,
  case_type text,
  case_status text,
  case_open_date date,
  case_close_date date,
  case_judgment text,
  penalty text,
  respondent text
)
LANGUAGE sql STABLE
AS $$
  SELECT l.id, l.building_id, l.litigation_id, l.case_type, l.case_status, l.case_open_date, l.case_close_date, l.case_judgment, l.penalty, l.respondent
  FROM unnest(p_building_ids) AS bid
  CROSS JOIN LATERAL (
    SELECT id, building_id, litigation_id, case_type, case_status, case_open_date, case_close_date, case_judgment, penalty, respondent
    FROM hpd_litigations
    WHERE building_id = bid
    ORDER BY case_open_date DESC
    LIMIT p_per_building
  ) l
$$;

GRANT EXECUTE ON FUNCTION public.landlord_violations_preview(uuid[], int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_complaints_preview(uuid[], int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.landlord_litigations_preview(uuid[], int) TO anon, authenticated;
