import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Haversine distance in miles
function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function walkingMinutes(miles: number): number {
  return Math.round(miles * 20); // ~3 mph walking speed
}

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(1)} mi`;
}

const LIMITS: Record<string, number> = {
  public_school: 3,
  charter_school: 2,
  private_school: 2,
  college: 2,
};

const MAX_RADIUS_MILES = 1.0;
// ~0.025 degrees latitude ≈ 1.7 miles
const BBOX_DEGREES = 0.025;

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "");
  const city = request.nextUrl.searchParams.get("city");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Query with bounding box for performance
  let query = supabase
    .from("nearby_schools")
    .select("type, school_id, name, latitude, longitude, address, grades")
    .gte("latitude", lat - BBOX_DEGREES)
    .lte("latitude", lat + BBOX_DEGREES)
    .gte("longitude", lng - BBOX_DEGREES)
    .lte("longitude", lng + BBOX_DEGREES);

  if (city) {
    const metroMap: Record<string, string> = {
      "CA/Los-Angeles": "los-angeles",
      "IL/Chicago": "chicago",
      "FL/Miami": "miami",
      "TX/Houston": "houston",
    };
    const metro = metroMap[city] || city;
    query = query.eq("metro", metro);
  }

  const { data: schools, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute distances and group by type
  const grouped: Record<
    string,
    {
      name: string;
      grades: string | null;
      distance: string;
      walkMin: number;
    }[]
  > = {};

  const withDist = (schools || [])
    .map((s) => ({
      ...s,
      dist: haversine(lat, lng, Number(s.latitude), Number(s.longitude)),
    }))
    .filter((s) => s.dist <= MAX_RADIUS_MILES)
    .sort((a, b) => a.dist - b.dist);

  for (const s of withDist) {
    const type = s.type as string;
    if (!grouped[type]) grouped[type] = [];
    if (grouped[type].length >= (LIMITS[type] || 3)) continue;
    grouped[type].push({
      name: s.name,
      grades: s.grades as string | null,
      distance: formatDistance(s.dist),
      walkMin: walkingMinutes(s.dist),
    });
  }

  return NextResponse.json({ schools: grouped });
}
