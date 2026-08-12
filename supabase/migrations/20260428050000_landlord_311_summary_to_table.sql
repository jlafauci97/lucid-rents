-- landlord_311_summary was converted from a materialized view to a plain table
-- directly in prod (between 20260428000000 and 20260428100000 — the next
-- migration attaches RLS policies, which only work on tables). No file
-- recorded the conversion; this reconstructs it to match the prod schema.
DROP MATERIALIZED VIEW IF EXISTS landlord_311_summary CASCADE;

CREATE TABLE IF NOT EXISTS landlord_311_summary (
    metro text NOT NULL,
    name text NOT NULL,
    building_count integer NOT NULL,
    complaint_count bigint NOT NULL,
    refreshed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT landlord_311_summary_pkey PRIMARY KEY (metro, name)
);

CREATE INDEX IF NOT EXISTS landlord_311_summary_metro_count_idx
  ON landlord_311_summary (metro, complaint_count DESC);

ALTER TABLE landlord_311_summary ENABLE ROW LEVEL SECURITY;
