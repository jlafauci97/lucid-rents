import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

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

// ── Upsert helpers ─────────────────────────────────────────────────
async function upsertBatch(stops: TransitStop[]) {
  const rows = stops.map((s) => ({
    type: s.type,
    stop_id: s.stop_id,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    routes: s.routes,
    ada_accessible: s.ada_accessible,
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

    // Upsert each type
    for (const [type, stops] of Object.entries({ subway, bus, citibike, ferry })) {
      await upsertBatch(stops);
      counts[type] = stops.length;
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
