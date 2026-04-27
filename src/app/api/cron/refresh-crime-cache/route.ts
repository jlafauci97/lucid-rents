import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 300; // 5 minutes
export const dynamic = "force-dynamic";

const METROS = ["nyc", "chicago", "los-angeles", "houston"] as const;

/**
 * Refresh the crime_by_zip_cache table with pre-aggregated stats.
 * Should run after crime data syncs (monthly).
 *
 * GET /api/cron/refresh-crime-cache
 */
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const results: Record<string, { zips: number; elapsed: number }> = {};

  for (const metro of METROS) {
    const start = Date.now();
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const sinceDate = twoYearsAgo.toISOString().split("T")[0];
    const yearBoundary = oneYearAgo.toISOString().split("T")[0];

    // Get all unique zip codes for this metro (from raw table)
    const { data: zipRows } = await supabase
      .from("nypd_complaints")
      .select("zip_code")
      .eq("metro", metro)
      .not("zip_code", "is", null)
      .gte("cmplnt_date", sinceDate);

    const uniqueZips = [...new Set((zipRows || []).map((r: { zip_code: string }) => r.zip_code))];
    if (uniqueZips.length === 0) {
      results[metro] = { zips: 0, elapsed: 0 };
      continue;
    }

    // Process each zip with parallel queries
    const CONCURRENCY = 5;
    const rows: Array<Record<string, unknown>> = [];

    for (let i = 0; i < uniqueZips.length; i += CONCURRENCY) {
      const batch = uniqueZips.slice(i, i + CONCURRENCY);

      await Promise.all(batch.map(async (zip) => {
        const [totalRes, violentRes, propertyRes, currentRes, curViolentRes, curPropertyRes, boroughRes] = await Promise.all([
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", sinceDate),
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", sinceDate).eq("crime_category", "violent"),
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", sinceDate).eq("crime_category", "property"),
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", yearBoundary),
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", yearBoundary).eq("crime_category", "violent"),
          supabase.from("nypd_complaints").select("*", { count: "exact", head: true })
            .eq("metro", metro).eq("zip_code", zip).gte("cmplnt_date", yearBoundary).eq("crime_category", "property"),
          supabase.from("nypd_complaints").select("borough").eq("metro", metro).eq("zip_code", zip)
            .not("borough", "is", null).limit(1),
        ]);

        const total = totalRes.count || 0;
        const violent = violentRes.count || 0;
        const property = propertyRes.count || 0;
        const currentTotal = currentRes.count || 0;
        const currentViolent = curViolentRes.count || 0;
        const currentProperty = curPropertyRes.count || 0;

        rows.push({
          metro,
          zip_code: zip,
          borough: boroughRes.data?.[0]?.borough || null,
          total, violent, property,
          quality_of_life: total - violent - property,
          current_year_total: currentTotal,
          prior_year_total: total - currentTotal,
          current_violent: currentViolent,
          prior_violent: violent - currentViolent,
          current_property: currentProperty,
          prior_property: property - currentProperty,
          refreshed_at: new Date().toISOString(),
        });
      }));
    }

    // Upsert all rows
    await supabase
      .from("crime_by_zip_cache")
      .upsert(rows, { onConflict: "metro,zip_code" });

    results[metro] = {
      zips: rows.length,
      elapsed: Math.round((Date.now() - start) / 1000),
    };
  }

  // Miami uses miami_crime_aggregates (annual zip-level rollups, not incident-level).
  // Refresh by re-running the same INSERT/upsert the migration uses.
  const miamiStart = Date.now();
  const { error: miamiErr } = await supabase.rpc("exec_sql", {
    sql: `
      INSERT INTO crime_by_zip_cache (
        metro, zip_code, borough,
        total, violent, property, quality_of_life,
        current_year_total, prior_year_total,
        current_violent, prior_violent,
        current_property, prior_property,
        refreshed_at
      )
      SELECT
        'miami', ma.zip::varchar, NULL,
        ma.total_incidents, ma.violent_count, ma.property_count, ma.qol_count,
        ma.total_incidents, COALESCE(prev.total_incidents, 0),
        ma.violent_count, COALESCE(prev.violent_count, 0),
        ma.property_count, COALESCE(prev.property_count, 0),
        now()
      FROM miami_crime_aggregates ma
      LEFT JOIN miami_crime_aggregates prev
        ON prev.zip = ma.zip AND prev.year = ma.year - 1
      WHERE ma.year = (SELECT MAX(year) FROM miami_crime_aggregates)
      ON CONFLICT (metro, zip_code) DO UPDATE SET
        total = EXCLUDED.total,
        violent = EXCLUDED.violent,
        property = EXCLUDED.property,
        quality_of_life = EXCLUDED.quality_of_life,
        current_year_total = EXCLUDED.current_year_total,
        prior_year_total = EXCLUDED.prior_year_total,
        current_violent = EXCLUDED.current_violent,
        prior_violent = EXCLUDED.prior_violent,
        current_property = EXCLUDED.current_property,
        prior_property = EXCLUDED.prior_property,
        refreshed_at = EXCLUDED.refreshed_at;
    `,
  });

  const { count: miamiCount } = await supabase
    .from("crime_by_zip_cache")
    .select("*", { count: "exact", head: true })
    .eq("metro", "miami");

  results.miami = {
    zips: miamiErr ? 0 : (miamiCount || 0),
    elapsed: Math.round((Date.now() - miamiStart) / 1000),
  };

  return NextResponse.json({
    success: true,
    results,
    refreshed_at: new Date().toISOString(),
  });
}
