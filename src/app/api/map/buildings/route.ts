import { NextResponse } from "next/server";
import { deriveScore } from "@/lib/constants";
import { isValidCity } from "@/lib/cities";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "anonymous";
    const rl = await checkRateLimit(`map:${ip}`);
    if (rl.limited) return rl.response;

    const { searchParams } = new URL(request.url);
    const cityParam = searchParams.get("city");
    if (cityParam && !isValidCity(cityParam)) {
      return NextResponse.json({ error: "Invalid city" }, { status: 400 });
    }
    const borough = searchParams.get("borough") || "";
    const minScore = parseFloat(searchParams.get("minScore") || "0");
    const maxScore = parseFloat(searchParams.get("maxScore") || "10");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    // Get zip centroids for lat/lon mapping
    let centroidsUrl = `${supabaseUrl}/rest/v1/zip_centroids?select=zip_code,avg_lat,avg_lon`;
    if (cityParam) centroidsUrl += `&metro=eq.${encodeURIComponent(cityParam)}`;

    const centroidsRes = await fetch(centroidsUrl, {
      headers: { apikey: supabaseKey },
      next: { revalidate: 600 },
    });
    const centroids = await centroidsRes.json();
    const centroidMap = new Map<string, { lat: number; lon: number }>();
    for (const c of centroids) {
      if (c.avg_lat && c.avg_lon) {
        centroidMap.set(c.zip_code, { lat: c.avg_lat, lon: c.avg_lon });
      }
    }

    // Fetch buildings with violations/complaints (the interesting ones for the map)
    let url = `${supabaseUrl}/rest/v1/buildings?select=id,full_address,borough,zip_code,slug,overall_score,violation_count,complaint_count,review_count&or=(violation_count.gt.0,complaint_count.gt.0)&limit=5000`;
    if (cityParam) url += `&metro=eq.${encodeURIComponent(cityParam)}`;
    if (borough) {
      url += `&borough=eq.${encodeURIComponent(borough)}`;
    }

    const buildingsRes = await fetch(url, {
      headers: { apikey: supabaseKey },
      next: { revalidate: 300 },
    });
    const buildings = await buildingsRes.json();

    if (!Array.isArray(buildings)) {
      return NextResponse.json({ points: [] });
    }

    // Map buildings to points with lat/lon from centroids + small random offset
    const seed = (s: string) => {
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    };

    const points = buildings
      .map((b: { id: string; full_address: string; borough: string; zip_code: string; slug: string; overall_score: number | null; violation_count: number; complaint_count: number; review_count: number }) => {
        const centroid = centroidMap.get(b.zip_code);
        if (!centroid) return null;

        // Use overall_score if available, otherwise derive from violations/complaints
        const score = b.overall_score != null
          ? b.overall_score
          : deriveScore(b.violation_count || 0, b.complaint_count || 0);

        if (score < minScore || score > maxScore) return null;

        // Deterministic offset based on building id
        const h = seed(b.id);
        const offsetLat = ((h % 1000) / 1000) * 0.008 - 0.004;
        const offsetLon = (((h >> 10) % 1000) / 1000) * 0.008 - 0.004;

        return {
          id: b.id,
          address: b.full_address,
          borough: b.borough,
          zip: b.zip_code,
          slug: b.slug,
          score,
          violations: b.violation_count || 0,
          reviews: b.review_count || 0,
          lat: centroid.lat + offsetLat,
          lon: centroid.lon + offsetLon,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ points });
  } catch (error) {
    console.error("Map buildings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
