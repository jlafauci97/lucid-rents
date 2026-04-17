import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Point-in-polygon flood zone lookup backed by PostGIS + FEMA NFHL data.
 *
 * GET /api/flood-zones/for-point?lat=25.7617&lng=-80.1918
 *
 * Response:
 *   { zone_code: "AE", zone_subtype: "FLOODWAY", bfe: 9 }    // in a zone
 *   { zone_code: null, zone_subtype: null, bfe: null }        // not in any mapped zone
 *
 * Only Miami (Miami-Dade FIPS 12086) and Houston (Harris FIPS 48201) have
 * polygon data ingested. Points outside those counties return null.
 *
 * Plan: docs/superpowers/plans/2026-04-10-fema-flood-zones.md
 */
export async function GET(request: NextRequest) {
  const lat = parseFloat(request.nextUrl.searchParams.get("lat") || "");
  const lng = parseFloat(request.nextUrl.searchParams.get("lng") || "");

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("flood_zone_for_point", {
    p_lat: lat,
    p_lng: lng,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data?.[0];
  // 'UNMAPPED' is an internal sentinel used by the buildings backfill to
  // distinguish "checked, not in any polygon" from "not yet checked". The
  // flood_zone_for_point RPC itself never returns it, but we normalize
  // here in case a caller ever threads a buildings.flood_zone value through.
  const code = row?.zone_code && row.zone_code !== "UNMAPPED" ? row.zone_code : null;
  return NextResponse.json(
    {
      zone_code: code,
      zone_subtype: row?.zone_subtype ?? null,
      bfe: row?.bfe ?? null,
    },
    {
      headers: {
        // Flood zones rarely change. Cache per-coordinate for a day.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
