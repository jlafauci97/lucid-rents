import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 500;

interface TransitStop {
  type: string;
  stop_id: string;
  name: string;
  latitude: number;
  longitude: number;
  routes: string[];
  ada_accessible: boolean | null;
}

// ── Subway Stations (data.ny.gov) ──────────────────────────────────
async function fetchSubwayStations(): Promise<TransitStop[]> {
  const url =
    "https://data.ny.gov/resource/39hk-dx4f.json?$limit=1000&$select=gtfs_stop_id,stop_name,gtfs_latitude,gtfs_longitude,daytime_routes,ada";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Subway API ${res.status}`);
  const data = await res.json();

  return data
    .filter(
      (s: Record<string, string>) => s.gtfs_latitude && s.gtfs_longitude
    )
    .map((s: Record<string, string>) => ({
      type: "subway",
      stop_id: s.gtfs_stop_id,
      name: s.stop_name,
      latitude: parseFloat(s.gtfs_latitude),
      longitude: parseFloat(s.gtfs_longitude),
      routes: s.daytime_routes ? s.daytime_routes.split(" ").filter(Boolean) : [],
      ada_accessible: s.ada === "1" || s.ada === "true" ? true : s.ada === "0" || s.ada === "false" ? false : null,
    }));
}

// ── Bus Stops (data.ny.gov) ────────────────────────────────────────
async function fetchBusStops(): Promise<TransitStop[]> {
  const stops = new Map<string, TransitStop>();
  let offset = 0;
  const pageSize = 5000;

  // Paginate through all bus stops
  while (true) {
    const url = `https://data.ny.gov/resource/ai5j-txmn.json?$limit=${pageSize}&$offset=${offset}&$select=stop_id,stop_name,latitude,longitude,route_short_name&$where=latitude IS NOT NULL`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bus API ${res.status}`);
    const data = await res.json();
    if (data.length === 0) break;

    for (const s of data) {
      if (!s.stop_id || !s.latitude || !s.longitude) continue;
      const existing = stops.get(s.stop_id);
      if (existing) {
        // Merge route into existing stop
        if (s.route_short_name && !existing.routes.includes(s.route_short_name)) {
          existing.routes.push(s.route_short_name);
        }
      } else {
        stops.set(s.stop_id, {
          type: "bus",
          stop_id: s.stop_id,
          name: s.stop_name || `Stop ${s.stop_id}`,
          latitude: parseFloat(s.latitude),
          longitude: parseFloat(s.longitude),
          routes: s.route_short_name ? [s.route_short_name] : [],
          ada_accessible: null,
        });
      }
    }

    offset += pageSize;
    if (data.length < pageSize) break;
  }

  return Array.from(stops.values());
}

// ── Citi Bike Stations (GBFS) ──────────────────────────────────────
async function fetchCitiBikeStations(): Promise<TransitStop[]> {
  const url =
    "https://gbfs.citibikenyc.com/gbfs/en/station_information.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Citi Bike API ${res.status}`);
  const json = await res.json();
  const stations = json.data?.stations || [];

  return stations
    .filter((s: Record<string, unknown>) => s.lat && s.lon)
    .map((s: Record<string, unknown>) => ({
      type: "citibike",
      stop_id: String(s.station_id),
      name: String(s.name),
      latitude: Number(s.lat),
      longitude: Number(s.lon),
      routes: [],
      ada_accessible: null,
    }));
}

// ── Ferry Terminals (hardcoded — very stable, ~25 terminals) ───────
function getFerryTerminals(): TransitStop[] {
  const terminals: [string, string, number, number][] = [
    ["WH", "Wall St / Pier 11", 40.7034, -74.0085],
    ["MH-39", "Midtown West / Pier 79", 40.7634, -74.0003],
    ["LES", "Corlears Hook", 40.7118, -73.9780],
    ["E34", "East 34th St", 40.7441, -73.9712],
    ["SG", "St. George", 40.6433, -74.0735],
    ["DUMP", "DUMBO", 40.7035, -73.9893],
    ["BPC", "Brookfield Place", 40.7145, -74.0154],
    ["RW", "Rockaway", 40.5724, -73.8810],
    ["SB", "South Brooklyn", 40.6762, -74.0160],
    ["BB", "Bay Ridge", 40.6349, -74.0273],
    ["SP", "Sunset Park", 40.6536, -74.0120],
    ["RB", "Red Hook", 40.6731, -74.0067],
    ["AT", "Atlantic Ave", 40.6891, -73.9966],
    ["NP", "North Williamsburg", 40.7218, -73.9613],
    ["SP-WB", "South Williamsburg", 40.7086, -73.9710],
    ["AST", "Astoria", 40.7780, -73.9186],
    ["HB", "Hunters Point South", 40.7425, -73.9586],
    ["LIC", "Long Island City", 40.7484, -73.9564],
    ["CI", "Coney Island", 40.5722, -73.9795],
    ["GB", "Governors Island", 40.6895, -74.0167],
    ["BATT", "Battery Park City", 40.7065, -74.0178],
    ["OSP", "Ossining", 41.1539, -73.8674],
    ["HAV", "Haverstraw", 41.2024, -73.9651],
    ["NWK", "Newburgh", 41.4960, -74.0048],
    ["TT", "Throggs Neck", 40.8126, -73.7913],
    ["CO", "City Island", 40.8468, -73.7873],
    ["SHQ", "Soundview", 40.8193, -73.8597],
  ];

  return terminals.map(([id, name, lat, lng]) => ({
    type: "ferry",
    stop_id: id,
    name,
    latitude: lat,
    longitude: lng,
    routes: [],
    ada_accessible: true,
  }));
}

// ── CTA L Stops (data.cityofchicago.org) ────────────────────────────
async function fetchCTALStops(): Promise<TransitStop[]> {
  const url =
    "https://data.cityofchicago.org/resource/8pix-ypme.json?$limit=500";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CTA L API ${res.status}`);
  const data = await res.json();

  const lineNames: Record<string, string> = {
    red: "Red",
    blue: "Blue",
    g: "Green",
    brn: "Brown",
    p: "Purple",
    pnk: "Pink",
    o: "Orange",
    y: "Yellow",
  };

  return data
    .filter((s: Record<string, unknown>) => s.location)
    .map((s: Record<string, unknown>) => {
      const loc = s.location as
        | { latitude?: string; longitude?: string }
        | undefined;
      const lat = loc?.latitude ? parseFloat(loc.latitude) : null;
      const lng = loc?.longitude ? parseFloat(loc.longitude) : null;
      if (!lat || !lng) return null;

      const routes: string[] = [];
      for (const [key, name] of Object.entries(lineNames)) {
        if (s[key] === true || s[key] === "true") routes.push(name);
      }

      return {
        type: "rail" as const,
        stop_id: `CTA-L-${s.stop_id || s.map_id}`,
        name: s.station_name
          ? String(s.station_name)
          : String(s.stop_name || ""),
        latitude: lat,
        longitude: lng,
        routes,
        ada_accessible:
          s.ada === true || s.ada === "true"
            ? true
            : s.ada === false || s.ada === "false"
              ? false
              : null,
      };
    })
    .filter(Boolean) as TransitStop[];
}

// ── CTA Bus Stops (data.cityofchicago.org) ──────────────────────────
async function fetchCTABusStops(): Promise<TransitStop[]> {
  const url =
    "https://data.cityofchicago.org/resource/hvnx-qtky.json?$limit=50000";
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    console.warn(
      `CTA Bus SODA API returned ${res.status}, skipping bus stops`
    );
    return [];
  }
  const data = await res.json();
  if (!data || data.length === 0) return [];

  return data
    .filter((s: Record<string, unknown>) => {
      const geom = s.the_geom as
        | { coordinates?: number[] }
        | undefined;
      return geom?.coordinates && geom.coordinates.length >= 2;
    })
    .map((s: Record<string, unknown>) => {
      const geom = s.the_geom as { coordinates: number[] };
      return {
        type: "bus" as const,
        stop_id: `CTA-BUS-${s.systemstop || s.public_nam}`,
        name: s.public_nam
          ? String(s.public_nam)
          : `${s.street || ""} & ${s.cross_st || ""}`.trim(),
        latitude: geom.coordinates[1],
        longitude: geom.coordinates[0],
        routes: s.routesstpg
          ? String(s.routesstpg)
              .split(",")
              .map((r: string) => r.trim())
          : [],
        ada_accessible: null,
      };
    });
}

// ── Upsert helpers ─────────────────────────────────────────────────
async function upsertBatch(stops: TransitStop[], metro = "nyc") {
  const rows = stops.map((s) => ({
    type: s.type,
    stop_id: s.stop_id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    routes: s.routes,
    ada_accessible: s.ada_accessible,
    metro,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("transit_stops")
      .upsert(batch, { onConflict: "type,stop_id" });
    if (error) throw new Error(`Upsert error: ${error.message}`);
  }
}

// ── Main handler ───────────────────────────────────────────────────
export async function GET() {
  const counts: Record<string, number> = {};

  try {
    // Fetch all sources
    const [subway, bus, citibike] = await Promise.all([
      fetchSubwayStations(),
      fetchBusStops(),
      fetchCitiBikeStations(),
    ]);
    const ferry = getFerryTerminals();

    // Upsert each NYC type
    for (const [type, stops] of Object.entries({ subway, bus, citibike, ferry })) {
      await upsertBatch(stops, "nyc");
      counts[type] = stops.length;
    }

    // ── Chicago CTA ──
    try {
      const [lStops, busStopsCTA] = await Promise.all([
        fetchCTALStops(),
        fetchCTABusStops(),
      ]);

      if (lStops.length > 0) {
        await upsertBatch(lStops, "chicago");
      }
      counts["cta_l"] = lStops.length;

      if (busStopsCTA.length > 0) {
        await upsertBatch(busStopsCTA, "chicago");
      }
      counts["cta_bus"] = busStopsCTA.length;
    } catch (err) {
      console.error("CTA sync error:", err);
      counts["cta_l"] = 0;
      counts["cta_bus"] = 0;
    }

    return NextResponse.json({
      ok: true,
      counts,
      message: `Synced ${Object.values(counts).reduce((a, b) => a + b, 0)} transit stops`,
    });
  } catch (err) {
    console.error("Transit sync error:", err);
    return NextResponse.json(
      { ok: false, error: String(err), counts },
      { status: 500 }
    );
  }
}
