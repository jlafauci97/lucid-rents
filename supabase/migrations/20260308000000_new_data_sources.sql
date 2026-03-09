-- ============================================================================
-- New Data Sources: Bedbug Reports, Evictions, HPD Lead Paint Violations
-- ============================================================================

-- --------------------------------------------------------------------------
-- bedbug_reports — synced from SODA endpoint wz6d-d3jb
-- --------------------------------------------------------------------------
CREATE TABLE bedbug_reports (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id                 uuid REFERENCES buildings(id) ON DELETE SET NULL,
    bbl                         varchar(10),
    bin                         varchar(10),
    registration_id             varchar(20),
    house_number                varchar(20),
    street_name                 varchar(100),
    borough                     varchar(20),
    postcode                    varchar(10),
    infested_dwelling_unit_count integer,
    eradicated_unit_count       integer,
    reinfested_unit_count       integer,
    total_dwelling_units        integer,
    filing_date                 date,
    filing_period_start_date    date,
    filing_period_end_date      date,
    imported_at                 timestamptz DEFAULT now(),
    UNIQUE(bbl, filing_period_start_date)
);

CREATE INDEX idx_bedbug_bbl ON bedbug_reports(bbl);
CREATE INDEX idx_bedbug_building_id ON bedbug_reports(building_id);
CREATE INDEX idx_bedbug_filing_date ON bedbug_reports(filing_date DESC);
CREATE INDEX idx_bedbug_imported_at ON bedbug_reports(imported_at);

ALTER TABLE bedbug_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bedbug_reports_select_public"
    ON bedbug_reports FOR SELECT TO public USING (true);

-- --------------------------------------------------------------------------
-- evictions — synced from SODA endpoint 6z8x-wfk4
-- --------------------------------------------------------------------------
CREATE TABLE evictions (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id                 uuid REFERENCES buildings(id) ON DELETE SET NULL,
    bbl                         varchar(10),
    bin                         varchar(10),
    court_index_number          varchar(30) UNIQUE NOT NULL,
    docket_number               varchar(30),
    eviction_address            varchar(200),
    eviction_apt_num            varchar(20),
    eviction_zip                varchar(10),
    borough                     varchar(20),
    executed_date               date,
    residential_commercial      varchar(20),
    eviction_possession         varchar(50),
    ejectment                   varchar(50),
    marshal_first_name          varchar(50),
    marshal_last_name           varchar(50),
    imported_at                 timestamptz DEFAULT now()
);

CREATE INDEX idx_evictions_bbl ON evictions(bbl);
CREATE INDEX idx_evictions_building_id ON evictions(building_id);
CREATE INDEX idx_evictions_executed_date ON evictions(executed_date DESC);
CREATE INDEX idx_evictions_imported_at ON evictions(imported_at);

ALTER TABLE evictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evictions_select_public"
    ON evictions FOR SELECT TO public USING (true);

-- --------------------------------------------------------------------------
-- hpd_lead_violations — synced from SODA endpoint au8t-hgv2
-- --------------------------------------------------------------------------
CREATE TABLE hpd_lead_violations (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    building_id             uuid REFERENCES buildings(id) ON DELETE SET NULL,
    bbl                     varchar(10),
    bin                     varchar(10),
    violation_id            varchar(20) UNIQUE NOT NULL,
    order_number            varchar(20),
    nov_description         text,
    violation_status        varchar(20),
    current_status          varchar(50),
    inspection_date         date,
    nov_issued_date         date,
    original_correct_by_date date,
    current_status_date     date,
    borough                 varchar(20),
    house_number            varchar(20),
    street_name             varchar(100),
    zip                     varchar(10),
    apartment               varchar(20),
    story                   varchar(20),
    imported_at             timestamptz DEFAULT now()
);

CREATE INDEX idx_lead_bbl ON hpd_lead_violations(bbl);
CREATE INDEX idx_lead_building_id ON hpd_lead_violations(building_id);
CREATE INDEX idx_lead_nov_issued_date ON hpd_lead_violations(nov_issued_date DESC);
CREATE INDEX idx_lead_inspection_date ON hpd_lead_violations(inspection_date DESC);
CREATE INDEX idx_lead_imported_at ON hpd_lead_violations(imported_at);

ALTER TABLE hpd_lead_violations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hpd_lead_violations_select_public"
    ON hpd_lead_violations FOR SELECT TO public USING (true);

-- --------------------------------------------------------------------------
-- Denormalized count columns on buildings
-- --------------------------------------------------------------------------
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS bedbug_report_count integer DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS eviction_count integer DEFAULT 0;
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS lead_violation_count integer DEFAULT 0;
