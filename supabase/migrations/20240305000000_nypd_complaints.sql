-- ============================================================================
-- NYPD Complaint Data (Crime)
-- Synced from NYC Open Data SODA API endpoint: 5uac-w243
-- Migration: 20240305000000_nypd_complaints.sql
-- ============================================================================

-- --------------------------------------------------------------------------
-- nypd_complaints
-- --------------------------------------------------------------------------
CREATE TABLE nypd_complaints (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cmplnt_num          varchar(20) UNIQUE NOT NULL,
    cmplnt_date         date,
    borough             varchar(20),
    precinct            integer,
    offense_description text,
    law_category        varchar(20),
    crime_category      varchar(20),
    pd_description      text,
    latitude            decimal(10,7),
    longitude           decimal(10,7),
    zip_code            varchar(5),
    raw_data            jsonb,
    imported_at         timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_nypd_complaints_zip_code ON nypd_complaints(zip_code);
CREATE INDEX idx_nypd_complaints_borough ON nypd_complaints(borough);
CREATE INDEX idx_nypd_complaints_cmplnt_date ON nypd_complaints(cmplnt_date DESC);
CREATE INDEX idx_nypd_complaints_crime_category ON nypd_complaints(crime_category);
CREATE INDEX idx_nypd_complaints_law_category ON nypd_complaints(law_category);
CREATE INDEX idx_nypd_complaints_lat_lon ON nypd_complaints(latitude, longitude)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- RLS: public read (matches hpd_violations, complaints_311 pattern)
ALTER TABLE nypd_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nypd_complaints_select_public"
    ON nypd_complaints FOR SELECT
    TO public
    USING (true);

-- --------------------------------------------------------------------------
-- Add crime_count to buildings (follows violation_count, complaint_count)
-- --------------------------------------------------------------------------
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS crime_count integer DEFAULT 0;

-- --------------------------------------------------------------------------
-- RPC: crime_by_zip — zip-level aggregation with category breakdowns
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_by_zip(
    since_date date DEFAULT (now() - interval '1 year')::date
)
RETURNS TABLE(
    zip_code varchar(5),
    borough varchar(20),
    total bigint,
    violent bigint,
    property bigint,
    quality_of_life bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        nc.zip_code,
        MAX(nc.borough) as borough,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE nc.crime_category = 'violent') as violent,
        COUNT(*) FILTER (WHERE nc.crime_category = 'property') as property,
        COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life') as quality_of_life
    FROM nypd_complaints nc
    WHERE nc.cmplnt_date >= since_date
      AND nc.zip_code IS NOT NULL
    GROUP BY nc.zip_code
    ORDER BY total DESC;
$$;

-- --------------------------------------------------------------------------
-- RPC: crime_zip_trends — monthly aggregation for a single zip code
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_zip_trends(
    target_zip varchar(5),
    since_date date DEFAULT (now() - interval '2 years')::date
)
RETURNS TABLE(
    month text,
    violent bigint,
    property bigint,
    quality_of_life bigint,
    total bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        to_char(nc.cmplnt_date, 'YYYY-MM') as month,
        COUNT(*) FILTER (WHERE nc.crime_category = 'violent') as violent,
        COUNT(*) FILTER (WHERE nc.crime_category = 'property') as property,
        COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life') as quality_of_life,
        COUNT(*) as total
    FROM nypd_complaints nc
    WHERE nc.zip_code = target_zip
      AND nc.cmplnt_date >= since_date
      AND nc.cmplnt_date IS NOT NULL
    GROUP BY to_char(nc.cmplnt_date, 'YYYY-MM')
    ORDER BY month ASC;
$$;

-- --------------------------------------------------------------------------
-- RPC: crime_zip_summary — summary stats for a single zip code
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_zip_summary(
    target_zip varchar(5),
    since_date date DEFAULT (now() - interval '1 year')::date
)
RETURNS TABLE(
    total bigint,
    violent bigint,
    property bigint,
    quality_of_life bigint,
    felonies bigint,
    misdemeanors bigint,
    violations bigint
)
LANGUAGE sql STABLE
AS $$
    SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE nc.crime_category = 'violent') as violent,
        COUNT(*) FILTER (WHERE nc.crime_category = 'property') as property,
        COUNT(*) FILTER (WHERE nc.crime_category = 'quality_of_life') as quality_of_life,
        COUNT(*) FILTER (WHERE nc.law_category = 'FELONY') as felonies,
        COUNT(*) FILTER (WHERE nc.law_category = 'MISDEMEANOR') as misdemeanors,
        COUNT(*) FILTER (WHERE nc.law_category = 'VIOLATION') as violations
    FROM nypd_complaints nc
    WHERE nc.zip_code = target_zip
      AND nc.cmplnt_date >= since_date;
$$;
