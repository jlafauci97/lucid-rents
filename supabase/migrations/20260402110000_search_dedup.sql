-- Search dedup: pick the best building per address so NYC condo lots
-- (same address, different BBLs) don't appear as multiple identical results.
-- Uses ROW_NUMBER() OVER (PARTITION BY full_address, city) to keep the row
-- with the most reviews, then highest score.

CREATE OR REPLACE FUNCTION search_buildings_ranked(
  search_query text,
  search_query_alt text DEFAULT NULL,
  city_filter text DEFAULT NULL,
  borough_filter text DEFAULT NULL,
  zip_filter text DEFAULT NULL,
  sort_by text DEFAULT 'relevance',
  page_offset int DEFAULT 0,
  page_limit int DEFAULT 10
)
RETURNS SETOF json AS $$
  WITH matched AS (
    SELECT b.*,
           ts_rank(b.search_vector, websearch_to_tsquery('english', search_query)) AS rank,
           ROW_NUMBER() OVER (
             PARTITION BY b.full_address, b.city
             ORDER BY b.review_count DESC, b.overall_score DESC NULLS LAST
           ) AS addr_rank
    FROM buildings b
    WHERE b.search_vector @@ websearch_to_tsquery('english', search_query)
      AND (city_filter IS NULL OR b.metro = city_filter)
      AND (borough_filter IS NULL OR b.borough = borough_filter)
      AND (zip_filter IS NULL OR b.zip_code = zip_filter)
  ),
  deduped AS (
    SELECT m.*,
           COUNT(*) OVER() AS total_count
    FROM matched m
    WHERE m.addr_rank = 1
  )
  SELECT row_to_json(t) FROM (
    SELECT d.id, d.metro, d.bbl, d.bin, d.apn, d.pin,
           d.folio_number, d.hcad_account,
           d.borough, d.house_number, d.street_name, d.city, d.state,
           d.zip_code, d.full_address, d.name, d.slug,
           d.year_built, d.num_floors, d.total_units,
           d.residential_units, d.commercial_units,
           d.building_class, d.land_use, d.owner_name,
           d.management_company,
           d.overall_score, d.review_count,
           d.violation_count, d.complaint_count, d.litigation_count,
           d.dob_violation_count, d.crime_count,
           d.bedbug_report_count, d.eviction_count, d.permit_count,
           d.energy_star_score, d.is_rent_stabilized,
           d.stabilized_units, d.stabilized_year,
           d.latitude, d.longitude,
           d.is_soft_story, d.soft_story_status, d.is_rso,
           d.fire_risk_zone, d.ward, d.community_area,
           d.is_rlto_protected, d.is_scofflaw,
           d.rlto_violation_count, d.lead_inspection_count,
           d.flood_zone,
           d.forty_year_recert_status, d.forty_year_recert_due_date,
           d.is_condo, d.condo_association,
           d.unsafe_structure_count,
           d.created_at, d.updated_at,
           d.total_count
    FROM deduped d
    ORDER BY
      CASE WHEN sort_by = 'score-desc' THEN d.overall_score END DESC NULLS LAST,
      CASE WHEN sort_by = 'score-asc' THEN d.overall_score END ASC NULLS LAST,
      CASE WHEN sort_by = 'violations-desc' THEN d.violation_count END DESC,
      CASE WHEN sort_by = 'reviews-desc' THEN d.review_count END DESC,
      CASE WHEN sort_by NOT IN ('score-desc','score-asc','violations-desc','reviews-desc') THEN d.rank END DESC,
      d.review_count DESC
    OFFSET page_offset
    LIMIT page_limit
  ) t;
$$ LANGUAGE sql STABLE;
