import { NextRequest, NextResponse } from "next/server";

/**
 * Query LA City ArcGIS MapServer for geospatial hazard zones.
 * Each hazard uses a point-in-polygon spatial query against official city data.
 *
 * GET /api/hazards/nearby?lat=34.05&lng=-118.25
 */

const GEO_HYDRO_BASE =
  "https://maps.lacity.org/lahub/rest/services/Geotechnical_and_Hydrological_Information/MapServer";
const SPECIAL_AREAS_BASE =
  "https://maps.lacity.org/lahub/rest/services/Special_Areas/MapServer";

interface LayerQuery {
  key: string;
  label: string;
  url: string;
  /** Fields to extract from the first feature */
  extractField?: string;
}

const HAZARD_LAYERS: LayerQuery[] = [
  {
    key: "faultZone",
    label: "Alquist-Priolo Earthquake Fault Zone",
    url: `${GEO_HYDRO_BASE}/0/query`,
    extractField: "HAZ_TYPE",
  },
  {
    key: "liquefaction",
    label: "Liquefaction Zone",
    url: `${GEO_HYDRO_BASE}/5/query`,
  },
  {
    key: "landslide",
    label: "Landslide Zone",
    url: `${GEO_HYDRO_BASE}/4/query`,
  },
  {
    key: "fireHazard",
    label: "Very High Fire Hazard Severity Zone",
    url: `${SPECIAL_AREAS_BASE}/11/query`,
  },
  {
    key: "highWind",
    label: "High Wind Velocity Area",
    url: `${SPECIAL_AREAS_BASE}/4/query`,
  },
];

async function queryLayer(
  layer: LayerQuery,
  lat: number,
  lng: number
): Promise<{ key: string; label: string; inZone: boolean; detail?: string }> {
  const params = new URLSearchParams({
    geometry: `${lng},${lat}`,
    geometryType: "esriGeometryPoint",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.extractField ?? "OBJECTID",
    returnGeometry: "false",
    f: "json",
  });

  try {
    const res = await fetch(`${layer.url}?${params}`, {
      next: { revalidate: 86400 }, // cache 24h
    });
    if (!res.ok) {
      return { key: layer.key, label: layer.label, inZone: false };
    }
    const json = await res.json();
    const features = json.features ?? [];
    const inZone = features.length > 0;
    const detail =
      inZone && layer.extractField
        ? features[0]?.attributes?.[layer.extractField] ?? undefined
        : undefined;
    return { key: layer.key, label: layer.label, inZone, detail };
  } catch {
    return { key: layer.key, label: layer.label, inZone: false };
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const lat = parseFloat(searchParams.get("lat") ?? "");
  const lng = parseFloat(searchParams.get("lng") ?? "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 }
    );
  }

  // Query all layers in parallel
  const results = await Promise.all(
    HAZARD_LAYERS.map((layer) => queryLayer(layer, lat, lng))
  );

  const hazards = Object.fromEntries(
    results.map((r) => [r.key, { label: r.label, inZone: r.inZone, detail: r.detail }])
  );

  const activeCount = results.filter((r) => r.inZone).length;

  return NextResponse.json({
    hazards,
    activeCount,
    totalChecked: results.length,
  });
}
