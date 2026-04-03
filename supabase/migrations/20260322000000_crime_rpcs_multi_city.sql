-- ============================================================================
-- Update crime RPC functions to support multi-city via metro filter
-- Migration: 20260322000000_crime_rpcs_multi_city.sql
-- ============================================================================

-- Index for metro filtering
CREATE INDEX IF NOT EXISTS idx_nypd_complaints_metro ON nypd_complaints(metro);
CREATE INDEX IF NOT EXISTS idx_nypd_complaints_metro_zip ON nypd_complaints(metro, zip_code);
CREATE INDEX IF NOT EXISTS idx_nypd_complaints_metro_date ON nypd_complaints(metro, cmplnt_date DESC);

-- --------------------------------------------------------------------------
-- RPC: crime_by_zip — now accepts optional metro filter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_by_zip(
    since_date date DEFAULT (now() - interval '1 year')::date,
    metro text DEFAULT NULL
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
      AND (crime_by_zip.metro IS NULL OR nc.metro = crime_by_zip.metro)
    GROUP BY nc.zip_code
    ORDER BY total DESC;
$$;

-- --------------------------------------------------------------------------
-- RPC: crime_zip_trends — now accepts optional metro filter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_zip_trends(
    target_zip varchar(5),
    since_date date DEFAULT (now() - interval '2 years')::date,
    metro text DEFAULT NULL
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
      AND (crime_zip_trends.metro IS NULL OR nc.metro = crime_zip_trends.metro)
    GROUP BY to_char(nc.cmplnt_date, 'YYYY-MM')
    ORDER BY month ASC;
$$;

-- --------------------------------------------------------------------------
-- RPC: crime_zip_summary — now accepts optional metro filter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION crime_zip_summary(
    target_zip varchar(5),
    since_date date DEFAULT (now() - interval '1 year')::date,
    metro text DEFAULT NULL
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
      AND nc.cmplnt_date >= since_date
      AND (crime_zip_summary.metro IS NULL OR nc.metro = crime_zip_summary.metro);
$$;

-- --------------------------------------------------------------------------
-- RPC: backfill_crime_zip_codes — updated for multi-city
-- Uses zip_centroids (renamed from nyc_zip_centroids) with metro filter
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION backfill_crime_zip_codes(target_metro text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
    updated_count integer;
BEGIN
    UPDATE nypd_complaints nc
    SET zip_code = nearest.zip_code
    FROM (
        SELECT DISTINCT ON (nc2.id)
            nc2.id,
            z.zip_code
        FROM nypd_complaints nc2
        CROSS JOIN zip_centroids z
        WHERE nc2.zip_code IS NULL
          AND nc2.latitude IS NOT NULL
          AND nc2.longitude IS NOT NULL
          AND (target_metro IS NULL OR nc2.metro = target_metro)
          AND (target_metro IS NULL OR z.metro = target_metro)
        ORDER BY nc2.id,
            (nc2.latitude - z.avg_lat)^2 + (nc2.longitude - z.avg_lon)^2 ASC
    ) nearest
    WHERE nc.id = nearest.id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$;

-- --------------------------------------------------------------------------
-- Populate LA zip centroids from la-neighborhoods mapping
-- Uses known LA zip codes with approximate centroids
-- --------------------------------------------------------------------------
INSERT INTO zip_centroids (zip_code, avg_lat, avg_lon, sample_count, metro)
VALUES
  -- Downtown
  ('90012', 34.0622, -118.2395, 100, 'los-angeles'),
  ('90013', 34.0441, -118.2434, 100, 'los-angeles'),
  ('90014', 34.0455, -118.2530, 100, 'los-angeles'),
  ('90015', 34.0388, -118.2620, 100, 'los-angeles'),
  ('90017', 34.0525, -118.2651, 100, 'los-angeles'),
  ('90021', 34.0230, -118.2401, 100, 'los-angeles'),
  ('90071', 34.0510, -118.2560, 100, 'los-angeles'),
  -- Central LA
  ('90004', 34.0770, -118.3090, 100, 'los-angeles'),
  ('90005', 34.0590, -118.3090, 100, 'los-angeles'),
  ('90006', 34.0480, -118.2930, 100, 'los-angeles'),
  ('90010', 34.0610, -118.3150, 100, 'los-angeles'),
  ('90019', 34.0480, -118.3370, 100, 'los-angeles'),
  ('90020', 34.0660, -118.3090, 100, 'los-angeles'),
  ('90026', 34.0770, -118.2630, 100, 'los-angeles'),
  ('90027', 34.1010, -118.2930, 100, 'los-angeles'),
  ('90028', 34.1010, -118.3250, 100, 'los-angeles'),
  ('90029', 34.0890, -118.2940, 100, 'los-angeles'),
  ('90036', 34.0690, -118.3490, 100, 'los-angeles'),
  ('90038', 34.0890, -118.3300, 100, 'los-angeles'),
  ('90039', 34.1060, -118.2640, 100, 'los-angeles'),
  ('90057', 34.0620, -118.2780, 100, 'los-angeles'),
  -- East LA
  ('90031', 34.0810, -118.2180, 100, 'los-angeles'),
  ('90032', 34.0790, -118.1810, 100, 'los-angeles'),
  ('90033', 34.0500, -118.2110, 100, 'los-angeles'),
  ('90063', 34.0420, -118.1840, 100, 'los-angeles'),
  ('90065', 34.1110, -118.2290, 100, 'los-angeles'),
  -- Northeast LA
  ('90041', 34.1420, -118.2120, 100, 'los-angeles'),
  ('90042', 34.1200, -118.1950, 100, 'los-angeles'),
  -- Hollywood / Westside
  ('90046', 34.1140, -118.3650, 100, 'los-angeles'),
  ('90048', 34.0740, -118.3700, 100, 'los-angeles'),
  ('90035', 34.0530, -118.3790, 100, 'los-angeles'),
  ('90024', 34.0670, -118.4320, 100, 'los-angeles'),
  ('90025', 34.0480, -118.4370, 100, 'los-angeles'),
  ('90034', 34.0280, -118.3960, 100, 'los-angeles'),
  ('90064', 34.0360, -118.4260, 100, 'los-angeles'),
  ('90049', 34.0770, -118.4760, 100, 'los-angeles'),
  -- Venice / Mar Vista / Playa
  ('90066', 34.0020, -118.4300, 100, 'los-angeles'),
  ('90291', 33.9930, -118.4630, 100, 'los-angeles'),
  ('90292', 33.9740, -118.4540, 100, 'los-angeles'),
  ('90094', 33.9750, -118.4200, 100, 'los-angeles'),
  -- South LA
  ('90003', 33.9640, -118.2730, 100, 'los-angeles'),
  ('90007', 34.0260, -118.2830, 100, 'los-angeles'),
  ('90008', 34.0090, -118.3380, 100, 'los-angeles'),
  ('90011', 34.0070, -118.2560, 100, 'los-angeles'),
  ('90016', 34.0280, -118.3500, 100, 'los-angeles'),
  ('90018', 34.0340, -118.3130, 100, 'los-angeles'),
  ('90037', 34.0030, -118.2870, 100, 'los-angeles'),
  ('90043', 33.9830, -118.3230, 100, 'los-angeles'),
  ('90044', 33.9530, -118.2920, 100, 'los-angeles'),
  ('90047', 33.9530, -118.3090, 100, 'los-angeles'),
  ('90059', 33.9280, -118.2490, 100, 'los-angeles'),
  ('90062', 34.0070, -118.3060, 100, 'los-angeles'),
  -- Harbor / San Pedro / Wilmington
  ('90710', 33.8220, -118.2930, 100, 'los-angeles'),
  ('90731', 33.7350, -118.2920, 100, 'los-angeles'),
  ('90732', 33.7450, -118.3080, 100, 'los-angeles'),
  ('90744', 33.7980, -118.2640, 100, 'los-angeles'),
  -- Valley - North Hollywood / Studio City / Sherman Oaks
  ('91601', 34.1700, -118.3770, 100, 'los-angeles'),
  ('91602', 34.1530, -118.3740, 100, 'los-angeles'),
  ('91604', 34.1430, -118.3920, 100, 'los-angeles'),
  ('91605', 34.2030, -118.4060, 100, 'los-angeles'),
  ('91606', 34.1910, -118.3860, 100, 'los-angeles'),
  ('91607', 34.1560, -118.4050, 100, 'los-angeles'),
  ('91403', 34.1530, -118.4500, 100, 'los-angeles'),
  ('91423', 34.1530, -118.4330, 100, 'los-angeles'),
  -- Valley - Van Nuys / Encino / Tarzana
  ('91401', 34.1820, -118.4470, 100, 'los-angeles'),
  ('91402', 34.2190, -118.4320, 100, 'los-angeles'),
  ('91405', 34.2000, -118.4480, 100, 'los-angeles'),
  ('91406', 34.2000, -118.4880, 100, 'los-angeles'),
  ('91411', 34.1860, -118.4560, 100, 'los-angeles'),
  ('91316', 34.1630, -118.5440, 100, 'los-angeles'),
  ('91436', 34.1570, -118.4730, 100, 'los-angeles'),
  -- Valley - Reseda / Northridge / Chatsworth
  ('91324', 34.2360, -118.5400, 100, 'los-angeles'),
  ('91325', 34.2360, -118.5580, 100, 'los-angeles'),
  ('91335', 34.2000, -118.5360, 100, 'los-angeles'),
  ('91343', 34.2400, -118.5100, 100, 'los-angeles'),
  ('91344', 34.2820, -118.5200, 100, 'los-angeles'),
  ('91311', 34.2580, -118.5870, 100, 'los-angeles'),
  ('91303', 34.1920, -118.5960, 100, 'los-angeles'),
  ('91304', 34.2290, -118.6000, 100, 'los-angeles'),
  ('91306', 34.2130, -118.5690, 100, 'los-angeles'),
  ('91307', 34.2090, -118.6230, 100, 'los-angeles'),
  -- Valley - Woodland Hills / Canoga Park
  ('91364', 34.1680, -118.6050, 100, 'los-angeles'),
  ('91367', 34.1800, -118.6050, 100, 'los-angeles'),
  -- Northeast Valley - Sylmar / Pacoima / Sun Valley
  ('91040', 34.2550, -118.3000, 100, 'los-angeles'),
  ('91042', 34.2390, -118.2540, 100, 'los-angeles'),
  ('91331', 34.3060, -118.4190, 100, 'los-angeles'),
  ('91342', 34.3130, -118.4420, 100, 'los-angeles'),
  ('91352', 34.2090, -118.3570, 100, 'los-angeles')
ON CONFLICT (zip_code) DO NOTHING;
