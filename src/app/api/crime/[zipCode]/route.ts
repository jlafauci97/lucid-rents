import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params;
    const { searchParams } = new URL(request.url);
    const months = parseInt(searchParams.get("months") || "12", 10);

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    const supabase = await createClient();

    // Get summary stats and recent crimes in parallel
    const [summaryRes, recentRes] = await Promise.all([
      supabase.rpc("crime_zip_summary", {
        target_zip: zipCode,
        since_date: sinceDateStr,
      }),
      supabase
        .from("nypd_complaints")
        .select(
          "id, cmplnt_num, cmplnt_date, offense_description, law_category, crime_category, pd_description, precinct"
        )
        .eq("zip_code", zipCode)
        .gte("cmplnt_date", sinceDateStr)
        .order("cmplnt_date", { ascending: false })
        .limit(50),
    ]);

    if (summaryRes.error) {
      console.error("crime_zip_summary RPC error:", summaryRes.error);
      return NextResponse.json(
        { error: "Failed to fetch crime summary" },
        { status: 500 }
      );
    }

    const summary = summaryRes.data?.[0] || {
      total: 0,
      violent: 0,
      property: 0,
      quality_of_life: 0,
      felonies: 0,
      misdemeanors: 0,
      violations: 0,
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
