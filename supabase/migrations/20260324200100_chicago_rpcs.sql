-- Chicago-specific RPC functions: scofflaw stats, lead stats, RLTO stats, affordable housing stats

-- Scofflaw stats by ward
CREATE OR REPLACE FUNCTION scofflaw_stats_by_ward()
RETURNS TABLE (
  ward integer,
  scofflaw_count bigint,
  total_unpaid_fines numeric,
  avg_violations numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    ward,
    count(*) AS scofflaw_count,
    sum(unpaid_fines) AS total_unpaid_fines,
    avg(violation_count)::numeric(10,1) AS avg_violations
  FROM chicago_scofflaws
  WHERE ward IS NOT NULL
  GROUP BY ward
  ORDER BY total_unpaid_fines DESC;
$$;

-- Lead inspection stats by community area
CREATE OR REPLACE FUNCTION lead_stats_by_area()
RETURNS TABLE (
  community_area text,
  total_inspections bigint,
  failed_count bigint,
  fail_rate numeric
) LANGUAGE sql STABLE AS $$
  SELECT
    community_area,
    count(*) AS total_inspections,
    count(*) FILTER (WHERE result ILIKE '%fail%' OR result ILIKE '%hazard%') AS failed_count,
    ROUND(
      count(*) FILTER (WHERE result ILIKE '%fail%' OR result ILIKE '%hazard%')::numeric / NULLIF(count(*), 0) * 100,
      1
    ) AS fail_rate
  FROM chicago_lead_inspections
  WHERE community_area IS NOT NULL
  GROUP BY community_area
  ORDER BY fail_rate DESC;
$$;

-- RLTO violation stats
CREATE OR REPLACE FUNCTION rlto_stats()
RETURNS TABLE (
  total_cases bigint,
  recent_cases bigint,
  top_violation_type text,
  top_violation_count bigint
) LANGUAGE sql STABLE AS $$
  WITH type_counts AS (
    SELECT violation_type, count(*) AS cnt
    FROM chicago_rlto_violations
    WHERE violation_type IS NOT NULL
    GROUP BY violation_type
    ORDER BY cnt DESC
    LIMIT 1
  )
  SELECT
    (SELECT count(*) FROM chicago_rlto_violations),
    (SELECT count(*) FROM chicago_rlto_violations WHERE violation_date >= CURRENT_DATE - INTERVAL '90 days'),
    (SELECT violation_type FROM type_counts),
    (SELECT cnt FROM type_counts);
$$;

-- Affordable housing stats by ward
CREATE OR REPLACE FUNCTION affordable_stats_by_ward()
RETURNS TABLE (
  ward integer,
  project_count bigint,
  total_affordable bigint,
  total_units bigint
) LANGUAGE sql STABLE AS $$
  SELECT
    ward,
    count(*) AS project_count,
    sum(affordable_units)::bigint AS total_affordable,
    sum(total_units)::bigint AS total_units
  FROM chicago_affordable_units
  WHERE ward IS NOT NULL
  GROUP BY ward
  ORDER BY total_affordable DESC;
$$;
