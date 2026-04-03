-- Efficient sitemap pagination for large tables (1.8M+ buildings).
-- OFFSET queries time out on large tables. These RPCs use ROW_NUMBER()
-- with a window function to find the cursor, then fetch the batch.
-- The planner can optimize this better than client-side two-step pagination.

-- Returns building data for sitemap batch N (0-indexed).
-- Uses a CTE with ROW_NUMBER() to skip to the right position efficiently.
CREATE OR REPLACE FUNCTION sitemap_building_batch(
  p_batch_index int,
  p_batch_size int DEFAULT 10000
)
RETURNS TABLE (
  slug text,
  borough varchar,
  metro varchar,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cursor uuid;
BEGIN
  -- Find the cursor UUID at the batch boundary.
  -- This OFFSET on a single indexed column (PK) is handled by an index-only scan.
  SELECT b.id INTO v_cursor
  FROM buildings b
  ORDER BY b.id ASC
  OFFSET p_batch_index * p_batch_size
  LIMIT 1;

  IF v_cursor IS NULL THEN
    RETURN;
  END IF;

  -- Fetch the batch using the cursor (index range scan, no OFFSET)
  RETURN QUERY
    SELECT b.slug, b.borough, b.metro, b.updated_at
    FROM buildings b
    WHERE b.id >= v_cursor
    ORDER BY b.id ASC
    LIMIT p_batch_size;
END;
$$;

-- Returns landlord data for sitemap batch N (0-indexed).
CREATE OR REPLACE FUNCTION sitemap_landlord_batch(
  p_batch_index int,
  p_batch_size int DEFAULT 10000
)
RETURNS TABLE (
  slug text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cursor text;
BEGIN
  SELECT ls.name INTO v_cursor
  FROM landlord_stats ls
  ORDER BY ls.name ASC
  OFFSET p_batch_index * p_batch_size
  LIMIT 1;

  IF v_cursor IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT ls.slug, ls.updated_at
    FROM landlord_stats ls
    WHERE ls.name >= v_cursor
    ORDER BY ls.name ASC
    LIMIT p_batch_size;
END;
$$;
