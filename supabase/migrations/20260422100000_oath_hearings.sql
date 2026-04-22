-- ============================================================================
-- OATH Hearings (2026-04-22)
--
-- Adjudicated code-enforcement cases from the NYC Office of Administrative
-- Trials and Hearings. Sourced from NYC Open Data `jz4z-kudi` (~21M rows
-- citywide). We only pull DOB (Dept. of Buildings) rows — ~1.4M — since
-- those are the most directly building-related. HPD/sanitation/etc. are
-- mostly occupant-level or already covered by other tables.
--
-- Read path follows the HPD Registrations pattern: BBL-keyed lookup at
-- read-time, no buildings-table backfill required.
-- ============================================================================

CREATE TABLE IF NOT EXISTS oath_hearings (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number               varchar(30) UNIQUE NOT NULL,
    bbl                         varchar(10),
    borough                     varchar(20),
    block                       varchar(10),
    lot                         varchar(10),
    issuing_agency              varchar(60),
    violation_date              date,
    violation_details           text,
    violation_description       text,
    house_number                varchar(20),
    street_name                 varchar(100),
    zip                         varchar(10),
    charge_code                 varchar(30),
    charge_section              varchar(60),
    hearing_status              varchar(60),
    hearing_result              varchar(60),
    hearing_date                date,
    decision_date               date,
    compliance_status           varchar(60),
    total_violation_amount      numeric(12,2),
    penalty_imposed             numeric(12,2),
    paid_amount                 numeric(12,2),
    balance_due                 numeric(12,2),
    respondent_name             varchar(200),
    metro                       text NOT NULL DEFAULT 'nyc',
    imported_at                 timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oath_hearings_bbl ON oath_hearings(bbl) WHERE bbl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_oath_hearings_violation_date ON oath_hearings(violation_date DESC);
CREATE INDEX IF NOT EXISTS idx_oath_hearings_agency ON oath_hearings(issuing_agency);
CREATE INDEX IF NOT EXISTS idx_oath_hearings_imported_at ON oath_hearings(imported_at);
CREATE INDEX IF NOT EXISTS idx_oath_hearings_metro ON oath_hearings(metro);

ALTER TABLE oath_hearings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oath_hearings_select_public" ON oath_hearings;
CREATE POLICY "oath_hearings_select_public"
    ON oath_hearings FOR SELECT TO public USING (true);


-- --------------------------------------------------------------------------
-- get_oath_hearings_by_bbl
--   BBL-keyed read: returns recent hearings for a building. Never touches
--   the buildings table.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_oath_hearings_by_bbl(target_bbl text, row_limit int DEFAULT 20)
RETURNS TABLE (
  ticket_number           text,
  violation_date          date,
  issuing_agency          text,
  violation_description   text,
  hearing_status          text,
  hearing_result          text,
  hearing_date            date,
  decision_date           date,
  compliance_status       text,
  penalty_imposed         numeric,
  paid_amount             numeric,
  balance_due             numeric,
  charge_code             text,
  charge_section          text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    o.ticket_number::text,
    o.violation_date,
    o.issuing_agency::text,
    o.violation_description,
    o.hearing_status::text,
    o.hearing_result::text,
    o.hearing_date,
    o.decision_date,
    o.compliance_status::text,
    o.penalty_imposed,
    o.paid_amount,
    o.balance_due,
    o.charge_code::text,
    o.charge_section::text
  FROM oath_hearings o
  WHERE o.bbl = target_bbl
  ORDER BY o.violation_date DESC NULLS LAST
  LIMIT COALESCE(row_limit, 20);
$$;


-- --------------------------------------------------------------------------
-- get_oath_hearings_summary_by_bbl
--   Aggregate: total count, open (unpaid) count, total unpaid balance.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_oath_hearings_summary_by_bbl(target_bbl text)
RETURNS TABLE (
  total_hearings           bigint,
  unpaid_hearings          bigint,
  total_unpaid_balance     numeric,
  latest_violation_date    date
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    count(*)::bigint AS total_hearings,
    count(*) FILTER (WHERE o.balance_due > 0)::bigint AS unpaid_hearings,
    COALESCE(sum(o.balance_due) FILTER (WHERE o.balance_due > 0), 0)::numeric AS total_unpaid_balance,
    max(o.violation_date) AS latest_violation_date
  FROM oath_hearings o
  WHERE o.bbl = target_bbl;
$$;
