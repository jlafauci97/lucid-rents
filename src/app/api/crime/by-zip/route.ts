import { NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity, VALID_CITIES } from "@/lib/cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }
    const months = parseInt(searchParams.get("months") || "24", 10);

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    // Non-cookies client so next.config.ts Cache-Control headers apply.
    // crime_by_zip is a public RPC on aggregated data.
    const supabase = createCacheClient();

    // The RPC only accepts a single optional metro and its rows carry no metro
    // column, so an unscoped call can't be post-filtered. Default scope: fan
    // out one call per publicly visible metro (miami/houston are hidden) and
    // merge, preserving the RPC's total-desc ordering.
    const metros = cityParam ? [cityParam] : VALID_CITIES;
    const results = await Promise.all(
      metros.map((metro) =>
        supabase.rpc("crime_by_zip", { since_date: sinceDateStr, metro })
      )
    );

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error("crime_by_zip RPC error:", failed.error);
      return NextResponse.json(
        { error: "Failed to fetch crime data" },
        { status: 500 }
      );
    }

    const data = results
      .flatMap((r) => r.data || [])
      .sort((a, b) => Number(b.total) - Number(a.total));

    return NextResponse.json(data);
  } catch (error) {
    console.error("Crime by-zip API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
