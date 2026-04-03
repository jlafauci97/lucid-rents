import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const supabase = await createClient();

    // Get summary stats and recent crimes in parallel
    const rpcParams: Record<string, string> = {
      target_zip: zipCode,
      since_date: sinceDateStr,
    };
    if (cityParam) rpcParams.metro = cityParam;

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
      recentQuery = recentQuery.eq("metro", cityParam);
    }

    const [summaryRes, recentRes] = await Promise.all([
      supabase.rpc("crime_zip_summary", rpcParams),
      recentQuery,
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
