import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const BATCH_SIZE = 200; // buildings per call — keeps within timeout

/**
 * Backfill building coordinates from NYC PLUTO dataset.
 * Matches buildings by BBL to get centroid lat/lng.
 * Call repeatedly with ?offset=0, 200, 400, etc. until done=true.
 */
export async function GET(request: NextRequest) {
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");
  const supabase = createAdminClient();

  // Get a batch of buildings missing coordinates that have a BBL
  const { data: buildings, error: fetchErr } = await supabase
    .from("buildings")
    .select("id, bbl")
    .is("latitude", null)
    .not("bbl", "is", null)
    .neq("bbl", "")
    .order("id", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!buildings || buildings.length === 0) {
    return NextResponse.json({ message: "No more buildings to geocode", done: true });
  }

  // Build BBL -> building IDs lookup
  const bblMap = new Map<string, string[]>();
  for (const b of buildings) {
    const bbl = b.bbl?.trim();
    if (!bbl) continue;
    if (!bblMap.has(bbl)) bblMap.set(bbl, []);
    bblMap.get(bbl)!.push(b.id);
  }

  const uniqueBbls = Array.from(bblMap.keys());
  if (uniqueBbls.length === 0) {
    return NextResponse.json({ message: "No valid BBLs in batch", nextOffset: offset + BATCH_SIZE });
  }

  // Single PLUTO query for all BBLs in this batch (numeric matching)
  const whereClause = uniqueBbls.join(",");
  const plutoUrl = `${PLUTO_API}?$select=bbl,latitude,longitude&$where=bbl in(${whereClause})&$limit=${BATCH_SIZE}`;

  let plutoData: { bbl: string; latitude: string; longitude: string }[] = [];
  try {
    const res = await fetch(plutoUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return NextResponse.json({ error: `PLUTO API ${res.status}`, nextOffset: offset + BATCH_SIZE }, { status: 502 });
    }
    plutoData = await res.json();
  } catch (err) {
    return NextResponse.json({ error: "PLUTO fetch failed", nextOffset: offset + BATCH_SIZE }, { status: 502 });
  }

  // Batch all updates into one array, then do a single update per building
  let updated = 0;
  let errors = 0;
  const updatePromises: Promise<void>[] = [];

  for (const p of plutoData) {
    const lat = parseFloat(p.latitude);
    const lng = parseFloat(p.longitude);
    if (isNaN(lat) || isNaN(lng)) continue;
    if (lat < 40.4 || lat > 41.0 || lng < -74.3 || lng > -73.6) continue;

    const cleanBbl = p.bbl.split(".")[0];
    const buildingIds = bblMap.get(cleanBbl);
    if (!buildingIds) continue;

    // Run updates in parallel
    updatePromises.push(
      supabase
        .from("buildings")
        .update({ latitude: lat, longitude: lng })
        .in("id", buildingIds)
        .then(({ error }) => {
          if (error) errors++;
          else updated += buildingIds.length;
        })
    );
  }

  await Promise.all(updatePromises);

  return NextResponse.json({
    ok: true,
    batch: { offset, size: buildings.length },
    uniqueBbls: uniqueBbls.length,
    plutoMatched: plutoData.length,
    updated,
    errors,
    nextOffset: offset + BATCH_SIZE,
    message: `Geocoded ${updated} buildings (batch at offset ${offset})`,
  });
}
