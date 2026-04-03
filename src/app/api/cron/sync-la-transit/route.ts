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
  metro: string;
}

// ── LA Metro Rail Stations (GTFS via developer.metro.net) ───────────
// Uses the Metro GTFS stops + stop_times to map stops to routes
async function fetchMetroRailStations(): Promise<TransitStop[]> {
  // Metro provides a GTFS-based API — use the Socrata endpoint on data.lacity.org
  // Alternative: direct GTFS from https://gitlab.com/LACMTA/gtfs_rail
  // We use the LA Metro GTFS stops endpoint
  const stopsUrl =
    "https://data.lacity.org/resource/vbqx-zrpq.json?$limit=5000&$where=vehicle_type='3'";

  // Fallback: use the LA Metro developer API for stops with routes
  // LA Metro publishes GTFS at https://developer.metro.net/gtfs-schedule-data/
  // For simplicity, we'll use the Metro NextBus/SIRI real-time feed

  // Use the LA Metro GTFS static feed stops
  const stops = new Map<string, TransitStop>();

  // Fetch Metro Rail stops from the Metro GTFS stops.txt via their API
  // Metro GTFS feed: https://gitlab.com/LACMTA/gtfs_rail/raw/master/stops.txt
  try {
    const res = await fetch(
      "https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/stops.txt"
    );
    if (!res.ok) throw new Error(`Metro GTFS Rail stops ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split("\n");
    const headers = lines[0].split(",");
    const idIdx = headers.indexOf("stop_id");
    const nameIdx = headers.indexOf("stop_name");
    const latIdx = headers.indexOf("stop_lat");
    const lngIdx = headers.indexOf("stop_lon");

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const stopId = cols[idIdx]?.trim();
      const name = cols[nameIdx]?.trim()?.replace(/"/g, "");
      const lat = parseFloat(cols[latIdx]);
      const lng = parseFloat(cols[lngIdx]);
      if (!stopId || !name || isNaN(lat) || isNaN(lng)) continue;
      // Skip parent stations (they have child stops)
      if (stops.has(stopId)) continue;

      stops.set(stopId, {
        type: "rail",
        stop_id: `la-rail-${stopId}`,
        name,
        latitude: lat,
        longitude: lng,
        routes: [],
        ada_accessible: true, // Metro Rail stations are ADA compliant
        metro: "los-angeles",
      });
    }

    // Build route_id → route_short_name mapping from routes.txt
    const routeIdToName = new Map<string, string>();
    const routesRes = await fetch(
      "https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/routes.txt"
    );
    if (routesRes.ok) {
      const routesText = await routesRes.text();
      const routesLines = routesText.trim().split("\n");
      const rHeaders = routesLines[0].split(",");
      const rIdIdx = rHeaders.indexOf("route_id");
      const rNameIdx = rHeaders.indexOf("route_short_name");
      for (let i = 1; i < routesLines.length; i++) {
        const cols = routesLines[i].split(",");
        const id = cols[rIdIdx]?.trim();
        const name = cols[rNameIdx]?.trim()?.replace(/"/g, "");
        if (id && name) routeIdToName.set(id, name);
      }
    }

    // Fetch stop_times to map routes → stops
    const stRes = await fetch(
      "https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/stop_times.txt"
    );
    if (stRes.ok) {
      const stText = await stRes.text();
      const stLines = stText.trim().split("\n");
      const stHeaders = stLines[0].split(",");
      const tripIdx = stHeaders.indexOf("trip_id");
      const stStopIdx = stHeaders.indexOf("stop_id");

      // Build trip_id → route_id mapping from trips.txt
      const tripToRoute = new Map<string, string>();
      const tripsRes = await fetch(
        "https://gitlab.com/LACMTA/gtfs_rail/-/raw/master/trips.txt"
      );
      if (tripsRes.ok) {
        const tripsText = await tripsRes.text();
        const tripsLines = tripsText.trim().split("\n");
        const tHeaders = tripsLines[0].split(",");
        const tTripIdx = tHeaders.indexOf("trip_id");
        const tRouteIdx = tHeaders.indexOf("route_id");
        for (let i = 1; i < tripsLines.length; i++) {
          const cols = tripsLines[i].split(",");
          tripToRoute.set(cols[tTripIdx]?.trim(), cols[tRouteIdx]?.trim());
        }
      }

      // Map stops to routes using short names
      for (let i = 1; i < stLines.length; i++) {
        const cols = stLines[i].split(",");
        const tripId = cols[tripIdx]?.trim();
        const stopId = cols[stStopIdx]?.trim();
        const routeId = tripToRoute.get(tripId);
        if (!stopId || !routeId) continue;
        // Use route_short_name if available, fall back to route_id
        const routeName = routeIdToName.get(routeId) || routeId;
        const stop = stops.get(stopId);
        if (stop && !stop.routes.includes(routeName)) {
          stop.routes.push(routeName);
        }
      }
    }
  } catch (err) {
    console.error("Error fetching Metro Rail GTFS:", err);
  }

  return Array.from(stops.values());
}

// ── LA Metro Bus Stops ──────────────────────────────────────────────
// Bus GTFS is only available as a 325MB zip (stop_times.txt alone is 302MB).
// Too large for serverless. Use scripts/sync-la-bus-stops.mjs locally instead.
// That script downloads the zip, parses all files including stop_times.txt,
// and upserts stops with route assignments to Supabase.

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
    metro: s.metro,
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
    // Rail is synced via cron; bus is synced locally via scripts/sync-la-bus-stops.mjs
    const rail = await fetchMetroRailStations();

    if (rail.length > 0) {
      await upsertBatch(rail);
    }
    counts.rail = rail.length;

    return NextResponse.json({
      ok: true,
      counts,
      message: `Synced ${Object.values(counts).reduce((a, b) => a + b, 0)} LA Metro transit stops`,
    });
  } catch (err) {
    console.error("LA Transit sync error:", err);
    return NextResponse.json(
      { ok: false, error: String(err), counts },
      { status: 500 }
    );
  }
}
