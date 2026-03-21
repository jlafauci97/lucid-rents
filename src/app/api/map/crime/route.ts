import { NextResponse } from "next/server";
import { isValidCity } from "@/lib/cities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }
    const borough = searchParams.get("borough") || "";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Get zip centroids for lat/lon mapping
    let centroidsUrl = `${supabaseUrl}/rest/v1/nyc_zip_centroids?select=zip_code,avg_lat,avg_lon`;
    if (cityParam) centroidsUrl += `&metro=eq.${encodeURIComponent(cityParam)}`;

    const centroidsRes = await fetch(centroidsUrl, {
      headers: { apikey: supabaseKey },
      cache: "no-store",
    });
    const centroids = await centroidsRes.json();
    const centroidMap = new Map<string, { lat: number; lon: number }>();
    for (const c of centroids) {
      if (c.avg_lat && c.avg_lon) {
        centroidMap.set(c.zip_code, { lat: c.avg_lat, lon: c.avg_lon });
      }
    }

    // Fetch crime data aggregated by zip
    const rpcBody: Record<string, string> = {};
    if (cityParam) rpcBody.metro_filter = cityParam;

    const crimeRes = await fetch(
      `${supabaseUrl}/rest/v1/rpc/crime_by_zip`,
      {
        method: "POST",
        headers: {
          apikey: supabaseKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rpcBody),
        cache: "no-store",
      }
    );
    const crimeData = await crimeRes.json();

    const points = (crimeData || [])
      .filter((r: { borough: string }) => !borough || r.borough?.toLowerCase() === borough.toLowerCase())
      .map((r: { zip_code: string; borough: string; total: number; violent: number; property: number; quality_of_life: number }) => {
        const centroid = centroidMap.get(r.zip_code);
        if (!centroid) return null;

        return {
          zip: r.zip_code,
          borough: r.borough,
          total: Number(r.total),
          violent: Number(r.violent),
          property: Number(r.property),
          qol: Number(r.quality_of_life),
          lat: centroid.lat,
          lon: centroid.lon,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Map crime error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
