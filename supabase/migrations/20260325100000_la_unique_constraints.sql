-- Add simple unique constraints for PostgREST onConflict compatibility.
-- The existing COALESCE-based indexes (idx_lahd_*_unique) remain for query performance;
-- these new constraints enable Supabase JS .upsert({ onConflict: "col1,col2" }) to work.

ALTER TABLE lahd_evictions
  ADD CONSTRAINT lahd_evictions_uq UNIQUE (apn, notice_date, notice_type);

ALTER TABLE lahd_tenant_buyouts
  ADD CONSTRAINT lahd_buyouts_uq UNIQUE (apn, disclosure_date);

ALTER TABLE lahd_ccris_cases
  ADD CONSTRAINT lahd_ccris_uq UNIQUE (apn, start_date, case_type);

ALTER TABLE lahd_violation_summary
  ADD CONSTRAINT lahd_violation_summary_uq UNIQUE (apn, violation_type);
