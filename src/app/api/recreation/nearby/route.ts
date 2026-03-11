import { NextRequest, NextResponse } from "next/server";

// Haversine distance in miles
function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8;
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
  return Math.round(miles * 20);
}

function formatDistance(miles: number): string {
  if (miles < 0.1) return `${Math.round(miles * 5280)} ft`;
  return `${miles.toFixed(1)} mi`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface RecPlace {
  name: string;
  type: string;
  distance: string;
  walkMin: number;
}

const CATEGORY_MAP: Record<string, string> = {
  park: "park",
  garden: "park",
  playground: "park",
  dog_park: "park",
  nature_reserve: "park",
  fitness_centre: "gym",
  fitness_station: "gym",
  sports_centre: "gym",
  swimming_pool: "gym",
  cinema: "entertainment",
  theatre: "entertainment",
  arts_centre: "entertainment",
  nightclub: "entertainment",
  stadium: "sports",
  pitch: "sports",
};

const LIMITS: Record<string, number> = {
  park: 4,
  gym: 3,
  entertainment: 3,
  sports: 2,
};

const MAX_RADIUS_MILES = 0.75;
// Overpass uses meters
const RADIUS_METERS = Math.round(MAX_RADIUS_MILES * 1609.34);

export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 }
    );
  }

  // Overpass API query for recreation places
  const query = `
    [out:json][timeout:10];
    (
      node["leisure"~"park|garden|playground|dog_park|nature_reserve|fitness_centre|fitness_station|sports_centre|swimming_pool|stadium|pitch"](around:${RADIUS_METERS},${lat},${lng});
      way["leisure"~"park|garden|playground|dog_park|nature_reserve|fitness_centre|fitness_station|sports_centre|swimming_pool|stadium|pitch"](around:${RADIUS_METERS},${lat},${lng});
      node["amenity"~"cinema|theatre|arts_centre|nightclub"](around:${RADIUS_METERS},${lat},${lng});
      way["amenity"~"cinema|theatre|arts_centre|nightclub"](around:${RADIUS_METERS},${lat},${lng});
    );
    out center;
  `;

  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      next: { revalidate: 86400 }, // cache 24h
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch recreation data" },
        { status: 502 }
      );
    }

    const data = await res.json();
    const elements: OverpassElement[] = data.elements || [];

    // Deduplicate by name (parks can have multiple nodes)
    const seen = new Set<string>();
    const grouped: Record<string, RecPlace[]> = {};

    const withDist = elements
      .filter((el) => {
        const tags = el.tags || {};
        const name = tags.name;
        if (!name) return false;
        const coords = el.lat != null ? el : el.center;
        if (!coords?.lat) return false;
        return true;
      })
      .map((el) => {
        const coords = el.lat != null ? el : el.center!;
        const tags = el.tags!;
        const leisure = tags.leisure || "";
        const amenity = tags.amenity || "";
        const key = leisure || amenity;
        const category = CATEGORY_MAP[key] || "other";

        return {
          name: tags.name!,
          category,
          dist: haversine(lat, lng, coords.lat!, coords.lon!),
        };
      })
      .filter((p) => p.dist <= MAX_RADIUS_MILES)
      .sort((a, b) => a.dist - b.dist);

    for (const p of withDist) {
      if (p.category === "other") continue;
      const dedupeKey = `${p.category}:${p.name.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      if (!grouped[p.category]) grouped[p.category] = [];
      if (grouped[p.category].length >= (LIMITS[p.category] || 3)) continue;

      grouped[p.category].push({
        name: p.name,
        type: p.category,
        distance: formatDistance(p.dist),
        walkMin: walkingMinutes(p.dist),
      });
    }

    return NextResponse.json({ recreation: grouped });
  } catch {
    return NextResponse.json(
      { error: "Recreation data unavailable" },
      { status: 502 }
    );
  }
}
