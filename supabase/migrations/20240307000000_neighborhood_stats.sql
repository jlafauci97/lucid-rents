-- Neighborhood stats RPC for report cards
CREATE OR REPLACE FUNCTION neighborhood_stats(target_zip text)
RETURNS TABLE(
  building_count bigint,
  avg_score numeric,
  total_violations bigint,
  total_complaints bigint,
  total_litigations bigint,
  buildings_with_reviews bigint,
  total_reviews bigint,
  top_landlord text,
  top_landlord_buildings bigint
)
LANGUAGE sql STABLE
AS $$
  SELECT
    COUNT(*),
    AVG(overall_score)::numeric(4,2),
    COALESCE(SUM(violation_count), 0),
    COALESCE(SUM(complaint_count), 0),
    COALESCE(SUM(litigation_count), 0),
    COUNT(*) FILTER (WHERE review_count > 0),
    COALESCE(SUM(review_count), 0),
    (SELECT owner_name FROM buildings WHERE zip_code = target_zip AND owner_name IS NOT NULL
     GROUP BY owner_name ORDER BY COUNT(*) DESC LIMIT 1),
    (SELECT COUNT(*) FROM buildings b2 WHERE b2.zip_code = target_zip AND b2.owner_name = (
      SELECT owner_name FROM buildings WHERE zip_code = target_zip AND owner_name IS NOT NULL
      GROUP BY owner_name ORDER BY COUNT(*) DESC LIMIT 1
    ))
  FROM buildings
  WHERE zip_code = target_zip;
$$;

-- Borough average scores RPC
CREATE OR REPLACE FUNCTION borough_avg_scores()
RETURNS TABLE(borough text, avg_score numeric, building_count bigint)
LANGUAGE sql STABLE
AS $$
  SELECT borough, AVG(overall_score)::numeric(4,2), COUNT(*)
  FROM buildings
  WHERE overall_score IS NOT NULL
  GROUP BY borough;
$$;
