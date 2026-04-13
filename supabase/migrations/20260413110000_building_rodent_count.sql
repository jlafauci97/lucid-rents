-- Add rodent complaint count column to buildings
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS rodent_complaint_count integer DEFAULT 0;

-- RPC to refresh rodent complaint counts from chicago_rodent_complaints
CREATE OR REPLACE FUNCTION refresh_rodent_complaint_counts()
RETURNS void
LANGUAGE sql
AS $$
  UPDATE buildings b
  SET rodent_complaint_count = COALESCE(sub.cnt, 0)
  FROM (
    SELECT building_id, COUNT(*) AS cnt
    FROM chicago_rodent_complaints
    WHERE building_id IS NOT NULL
    GROUP BY building_id
  ) sub
  WHERE b.id = sub.building_id AND b.metro = 'chicago';
$$;
