import { NextResponse } from "next/server";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { isValidCity } from "@/lib/cities";

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

    const rpcParams: Record<string, string> = { since_date: sinceDateStr };
    if (cityParam) rpcParams.metro = cityParam;

    const { data, error } = await supabase.rpc("crime_by_zip", rpcParams);

    if (error) {
      console.error("crime_by_zip RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch crime data" },
        { status: 500 }
      );
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Crime by-zip API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
