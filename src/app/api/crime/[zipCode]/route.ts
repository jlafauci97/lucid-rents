import { NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity } from "@/lib/cities";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params;
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }
    const months = parseInt(searchParams.get("months") || "24", 10);

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    const supabase = createCacheClient();

    // Build base query with filters that hit the composite index
    // (zip_code, cmplnt_date DESC, crime_category) WHERE zip_code IS NOT NULL
    let summaryQuery = supabase
      .from("nypd_complaints")
      .select("crime_category, law_category")
      .eq("zip_code", zipCode)
      .gte("cmplnt_date", sinceDateStr);

    let recentQuery = supabase
      .from("nypd_complaints")
      .select(
        "id, cmplnt_num, cmplnt_date, offense_description, law_category, crime_category, pd_description, precinct"
      )
      .eq("zip_code", zipCode)
      .gte("cmplnt_date", sinceDateStr)
      .order("cmplnt_date", { ascending: false })
      .limit(50);

    if (cityParam) {
      summaryQuery = summaryQuery.eq("metro", cityParam);
      recentQuery = recentQuery.eq("metro", cityParam);
    }

    // Fetch summary rows and recent crimes in parallel
    // Use limit on summary to cap the scan — aggregate client-side
    const [summaryRes, recentRes] = await Promise.all([
      summaryQuery.limit(10000),
      recentQuery,
    ]);

    if (summaryRes.error) {
      console.error("Crime summary query error:", summaryRes.error);
      return NextResponse.json(
        { error: "Failed to fetch crime summary" },
        { status: 500 }
      );
    }

    // Aggregate counts client-side from the capped result set
    const rows = summaryRes.data || [];
    const summary = {
      total: rows.length,
      violent: rows.filter((r) => r.crime_category === "violent").length,
      property: rows.filter((r) => r.crime_category === "property").length,
      quality_of_life: rows.filter((r) => r.crime_category === "quality_of_life").length,
      felonies: rows.filter((r) => r.law_category === "FELONY").length,
      misdemeanors: rows.filter((r) => r.law_category === "MISDEMEANOR").length,
      violations: rows.filter((r) => r.law_category === "VIOLATION").length,
    };

    return NextResponse.json({
      zip_code: zipCode,
      summary,
      recent_crimes: recentRes.data || [],
    });
  } catch (error) {
    console.error("Crime zip API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
