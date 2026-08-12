-- Restore untracked objects that depend on tables created mid-chain.
-- These exist in production (created via dashboard/MCP) but no migration file creates them.
--
-- Name: mv_neighborhood_median_rents; Type: MATERIALIZED VIEW; Schema: public;
--

CREATE MATERIALIZED VIEW public.mv_neighborhood_median_rents AS
 SELECT b.zip_code,
    br.bedrooms,
    (percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((br.median_rent)::double precision)))::numeric AS median_rent
   FROM (public.building_rents br
     JOIN public.buildings b ON ((b.id = br.building_id)))
  WHERE ((br.median_rent > 0) AND (b.zip_code IS NOT NULL))
  GROUP BY b.zip_code, br.bedrooms
  WITH NO DATA;

--
-- Name: scaffolding_address_runs; Type: MATERIALIZED VIEW; Schema: public;
--

CREATE MATERIALIZED VIEW public.scaffolding_address_runs AS
 WITH active_addrs AS (
         SELECT DISTINCT sidewalk_sheds.house_no,
            sidewalk_sheds.street_name,
            sidewalk_sheds.borough
           FROM public.sidewalk_sheds
          WHERE (((sidewalk_sheds.source)::text = 'dob_now'::text) AND ((sidewalk_sheds.permit_status)::text = 'Permit Issued'::text) AND (sidewalk_sheds.house_no IS NOT NULL) AND (sidewalk_sheds.street_name IS NOT NULL))
        ), permits AS (
         SELECT s.house_no,
            s.street_name,
            s.borough,
            s.zip_code,
            s.issued_date,
            s.owner_business_name,
            s.permit_status,
            s.source,
            lag(s.issued_date) OVER (PARTITION BY s.house_no, s.street_name, s.borough ORDER BY s.issued_date) AS prev_issued
           FROM (public.sidewalk_sheds s
             JOIN active_addrs a USING (house_no, street_name, borough))
          WHERE (s.issued_date IS NOT NULL)
        ), with_run_id AS (
         SELECT permits.house_no,
            permits.street_name,
            permits.borough,
            permits.zip_code,
            permits.issued_date,
            permits.owner_business_name,
            permits.permit_status,
            permits.source,
            permits.prev_issued,
            sum(
                CASE
                    WHEN (permits.prev_issued IS NULL) THEN 1
                    WHEN ((permits.issued_date - permits.prev_issued) > 365) THEN 1
                    ELSE 0
                END) OVER (PARTITION BY permits.house_no, permits.street_name, permits.borough ORDER BY permits.issued_date) AS run_id
           FROM permits
        ), current_run AS (
         SELECT DISTINCT ON (with_run_id.house_no, with_run_id.street_name, with_run_id.borough) with_run_id.house_no,
            with_run_id.street_name,
            with_run_id.borough,
            with_run_id.run_id AS current_run_id
           FROM with_run_id
          ORDER BY with_run_id.house_no, with_run_id.street_name, with_run_id.borough, with_run_id.issued_date DESC
        )
 SELECT w.house_no,
    w.street_name,
    w.borough,
    min((w.zip_code)::text) AS zip_code,
    count(*) AS run_permit_count,
    min(w.issued_date) AS run_start,
    max(w.issued_date) AS run_end,
    count(*) FILTER (WHERE (((w.source)::text = 'dob_now'::text) AND ((w.permit_status)::text = 'Permit Issued'::text))) AS run_active_permits,
    min((w.owner_business_name)::text) AS owner_business_name
   FROM (with_run_id w
     JOIN current_run c USING (house_no, street_name, borough))
  WHERE (w.run_id = c.current_run_id)
  GROUP BY w.house_no, w.street_name, w.borough
  WITH NO DATA;

--
-- Name: idx_addr_runs_active; Type: INDEX; Schema: public;
--

CREATE INDEX idx_addr_runs_active ON public.scaffolding_address_runs USING btree (run_active_permits) WHERE (run_active_permits > 0);

--
-- Name: idx_addr_runs_start; Type: INDEX; Schema: public;
--

CREATE INDEX idx_addr_runs_start ON public.scaffolding_address_runs USING btree (run_start);

--
-- Name: idx_mv_neighborhood_median_rents; Type: INDEX; Schema: public;
--

CREATE UNIQUE INDEX idx_mv_neighborhood_median_rents ON public.mv_neighborhood_median_rents USING btree (zip_code, bedrooms);

--
-- Columns added directly in prod (no migration file recorded them)
--
ALTER TABLE marketing_reddit_threads ADD COLUMN IF NOT EXISTS selftext text;
ALTER TABLE marketing_reddit_threads ADD COLUMN IF NOT EXISTS post_score integer;
ALTER TABLE marketing_reddit_threads ADD COLUMN IF NOT EXISTS num_comments integer;

--
-- Stale function overloads that were dropped directly in prod; the working
-- p_metro / 3-arg versions created earlier in the chain remain.
--
DROP FUNCTION IF EXISTS buildings_near_transit_line(text, text, integer, integer);
DROP FUNCTION IF EXISTS crime_by_zip(date);
DROP FUNCTION IF EXISTS crime_zip_summary(character varying, date);
DROP FUNCTION IF EXISTS crime_zip_summary(character varying, date, text);
DROP FUNCTION IF EXISTS crime_zip_trends(character varying, date);
