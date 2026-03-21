import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCity, DEFAULT_CITY } from "@/lib/cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city") || DEFAULT_CITY;
    if (!isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }
    const months = parseInt(searchParams.get("months") || "12", 10);

    const sinceDate = new Date();
    sinceDate.setMonth(sinceDate.getMonth() - months);
    const sinceDateStr = sinceDate.toISOString().split("T")[0];

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("crime_by_zip", {
      since_date: sinceDateStr,
      metro: cityParam,
    });

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
