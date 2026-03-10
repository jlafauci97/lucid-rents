import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 60;

const PLUTO_API = "https://data.cityofnewyork.us/resource/64uk-42ks.json";
const PAGE_SIZE = 5000;

/**
 * Backfill building coordinates from NYC PLUTO dataset.
 * Matches buildings by BBL to get centroid lat/lng.
 * Call with ?offset=0 (then 5000, 10000, etc.) to page through.
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
    .range(offset, offset + PAGE_SIZE - 1);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!buildings || buildings.length === 0) {
    return NextResponse.json({ message: "No more buildings to geocode", done: true });
  }

  // Collect unique BBLs and build lookup
  const bblMap = new Map<string, string[]>(); // bbl -> building ids
  for (const b of buildings) {
    const bbl = b.bbl?.trim();
    if (!bbl) continue;
    if (!bblMap.has(bbl)) bblMap.set(bbl, []);
    bblMap.get(bbl)!.push(b.id);
  }

  const uniqueBbls = Array.from(bblMap.keys());
  let updated = 0;
  let plutoFetched = 0;

  // Query PLUTO in chunks (SoQL WHERE bbl IN (...) has limits, so chunk by 200)
  const chunkSize = 200;
  for (let i = 0; i < uniqueBbls.length; i += chunkSize) {
    const chunk = uniqueBbls.slice(i, i + chunkSize);
    // PLUTO stores BBL as decimal (e.g. "4061730023.00000000")
    // Our buildings store as integer string (e.g. "4061730023")
    // Use numeric cast to match
    const whereClause = chunk.map((b) => `${b}`).join(",");
    const url = `${PLUTO_API}?$select=bbl,latitude,longitude&$where=bbl in(${whereClause})&$limit=${chunkSize}`;

    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) continue;

      const plutoData: { bbl: string; latitude: string; longitude: string }[] =
        await res.json();
      plutoFetched += plutoData.length;

      // Update buildings for each matched PLUTO record
      for (const p of plutoData) {
        const lat = parseFloat(p.latitude);
        const lng = parseFloat(p.longitude);
        if (isNaN(lat) || isNaN(lng)) continue;
        if (lat < 40.4 || lat > 41.0 || lng < -74.3 || lng > -73.6) continue;

        // PLUTO returns "4049950001.00000000", strip decimal part to match our BBL format
        const cleanBbl = p.bbl.split(".")[0];
        const buildingIds = bblMap.get(cleanBbl);
        if (!buildingIds) continue;

        const { error: updateErr } = await supabase
          .from("buildings")
          .update({ latitude: lat, longitude: lng })
          .in("id", buildingIds)
          .is("latitude", null);

        if (!updateErr) updated += buildingIds.length;
      }
    } catch {
      // Continue with next chunk on fetch errors
    }
  }

  return NextResponse.json({
    ok: true,
    batch: { offset, size: buildings.length },
    uniqueBbls: uniqueBbls.length,
    plutoMatched: plutoFetched,
    updated,
    nextOffset: offset + PAGE_SIZE,
    message: `Geocoded ${updated} buildings from PLUTO (batch starting at ${offset})`,
  });
}
