import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidCity, DEFAULT_CITY } from "@/lib/cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get("lat") || "");
    const lon = parseFloat(searchParams.get("lon") || "");
    const limit = Math.min(parseInt(searchParams.get("limit") || "12", 10), 24);
    const cityParam = searchParams.get("city") || DEFAULT_CITY;

    if (!isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }

    if (isNaN(lat) || isNaN(lon)) {
      return NextResponse.json({ error: "lat and lon required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Get zip centroids
    const { data: centroids } = await supabase
      .from("zip_centroids")
      .select("zip_code, avg_lat, avg_lon")
      .eq("metro", cityParam);

    if (!centroids || centroids.length === 0) {
      return NextResponse.json({ buildings: [], zips: [] });
    }

    // Find nearest 5 zip codes by Euclidean distance
    const sorted = centroids
      .map((c) => ({
        ...c,
        dist: Math.hypot((c.avg_lat || 0) - lat, (c.avg_lon || 0) - lon),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    const nearbyZips = sorted.map((c) => c.zip_code);

    // Get buildings in those zips
    const { data: buildings } = await supabase
      .from("buildings")
      .select(
        "id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, review_count, total_units, year_built"
      )
      .eq("metro", cityParam)
      .in("zip_code", nearbyZips)
      .order("review_count", { ascending: false })
      .limit(limit);

    return NextResponse.json({
      buildings: buildings || [],
      zips: nearbyZips,
    });
  } catch (error) {
    console.error("Nearby buildings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
