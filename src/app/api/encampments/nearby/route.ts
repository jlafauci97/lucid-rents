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

function formatDistance(miles: number): string {
  if (miles < 0.1) {
    return `${Math.round(miles * 5280)} ft`;
  }
  return `${miles.toFixed(2)} mi`;
}

// ~0.01 degrees latitude ≈ 0.7 miles
const BBOX_DEGREES = 0.01;
const DEFAULT_RADIUS = 0.5; // miles

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "");
  const radius = parseFloat(request.nextUrl.searchParams.get("radius") || "") || DEFAULT_RADIUS;

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Bounding box query for performance
  const { data: records, error } = await supabase
    .from("encampments")
    .select("sr_number, created_date, status, request_type, address, latitude, longitude")
    .gte("latitude", lat - BBOX_DEGREES)
    .lte("latitude", lat + BBOX_DEGREES)
    .gte("longitude", lng - BBOX_DEGREES)
    .lte("longitude", lng + BBOX_DEGREES)
    .order("created_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Compute distances and filter by radius
  const withDist = (records || [])
    .filter((r) => r.latitude != null && r.longitude != null)
    .map((r) => ({
      ...r,
      dist: haversine(lat, lng, r.latitude!, r.longitude!),
    }))
    .filter((r) => r.dist <= radius)
    .sort((a, b) => a.dist - b.dist);

  // Count recent (last 90 days)
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const recentCount = withDist.filter(
    (r) => new Date(r.created_date) >= ninetyDaysAgo
  ).length;

  // Closest 5 reports
  const closest = withDist.slice(0, 5).map((r) => ({
    sr_number: r.sr_number,
    created_date: r.created_date,
    status: r.status,
    request_type: r.request_type,
    address: r.address,
    distance: formatDistance(r.dist),
  }));

  return NextResponse.json({
    total: withDist.length,
    recent: recentCount,
    radius,
    closest,
  });
}
