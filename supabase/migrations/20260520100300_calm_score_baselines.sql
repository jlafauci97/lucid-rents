-- supabase/migrations/20260520100300_calm_score_baselines.sql

CREATE TABLE IF NOT EXISTS calm_score_baselines (
  metric TEXT PRIMARY KEY,
  median_value NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE calm_score_baselines IS 'Pre-computed NYC medians (per 0.25 mi circle) for block-level penalties in calm-score.';
