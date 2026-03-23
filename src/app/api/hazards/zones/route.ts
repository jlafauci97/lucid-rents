import { NextRequest, NextResponse } from "next/server";

/**
 * Fetch hazard zone GeoJSON polygons from LA City ArcGIS MapServer.
 *
 * GET /api/hazards/zones?layer=faultZone|liquefaction|landslide|fireHazard|highWind
 *
 * Returns GeoJSON FeatureCollection for the requested layer.
 * Results are cached for 7 days (zone boundaries rarely change).
 */

const GEO_HYDRO =
  "https://maps.lacity.org/lahub/rest/services/Geotechnical_and_Hydrological_Information/MapServer";
const SPECIAL_AREAS =
  "https://maps.lacity.org/lahub/rest/services/Special_Areas/MapServer";

const LAYER_CONFIG: Record<string, { url: string; label: string }> = {
  faultZone: {
    url: `${GEO_HYDRO}/0/query`,
    label: "Alquist-Priolo Earthquake Fault Zone",
  },
  liquefaction: {
    url: `${GEO_HYDRO}/5/query`,
    label: "Liquefaction Zone",
  },
  landslide: {
    url: `${GEO_HYDRO}/4/query`,
    label: "Landslide Zone",
  },
  fireHazard: {
    url: `${SPECIAL_AREAS}/11/query`,
    label: "Very High Fire Hazard Severity Zone",
  },
  highWind: {
    url: `${SPECIAL_AREAS}/4/query`,
    label: "High Wind Velocity Area",
  },
};

export async function GET(request: NextRequest) {
  const layer = request.nextUrl.searchParams.get("layer");

  if (!layer || !LAYER_CONFIG[layer]) {
    return NextResponse.json(
      { error: `Invalid layer. Valid: ${Object.keys(LAYER_CONFIG).join(", ")}` },
      { status: 400 }
    );
  }

  const config = LAYER_CONFIG[layer];

  const params = new URLSearchParams({
    where: "1=1",
    outFields: "OBJECTID",
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });

  try {
    const res = await fetch(`${config.url}?${params}`, {
      next: { revalidate: 604800 }, // cache 7 days
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `ArcGIS returned ${res.status}` },
        { status: 502 }
      );
    }

    const geojson = await res.json();

    return NextResponse.json(geojson, {
      headers: {
        "Cache-Control": "public, max-age=604800, s-maxage=604800",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch from ArcGIS" },
      { status: 502 }
    );
  }
}
