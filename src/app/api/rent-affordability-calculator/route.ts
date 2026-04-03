import { NextRequest, NextResponse } from "next/server";
import { isValidCity, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** FMR column name for each bedroom count */
const FMR_COLUMNS: Record<number, string> = {
  0: "fmr_0br",
  1: "fmr_1br",
  2: "fmr_2br",
  3: "fmr_3br",
  4: "fmr_4br",
};

interface ZipRent {
  zip_code: string;
  borough: string;
  median_rent: number;
}

interface HudFmr {
  zip_code: string;
  fmr_0br: number;
  fmr_1br: number;
  fmr_2br: number;
  fmr_3br: number;
  fmr_4br: number;
}

interface BuildingRentAgg {
  zip_code: string;
  median_rent: number;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city") as City | null;
  const bedrooms = Number(searchParams.get("bedrooms") ?? "1");

  if (!city || !isValidCity(city)) {
    return NextResponse.json(
      { error: "Invalid or missing city parameter" },
      { status: 400 }
    );
  }

  if (bedrooms < 0 || bedrooms > 4) {
    return NextResponse.json(
      { error: "Bedrooms must be 0-4" },
      { status: 400 }
    );
  }

  try {
    // Fetch data from three sources in parallel
    const [zipCurrentData, hudFmrData, buildingRentData] = await Promise.all([
      // 1. ZORI zip-level median rents via RPC
      fetchRpc("rent_by_zip_current", { p_metro: city }) as Promise<ZipRent[]>,

      // 2. HUD FMR by zip code for this city's zips
      fetchSupabase<HudFmr[]>(
        `hud_fmr?select=zip_code,fmr_0br,fmr_1br,fmr_2br,fmr_3br,fmr_4br`
      ),

      // 3. Building-level aggregated median rent by zip + bedroom count
      fetchSupabase<BuildingRentAgg[]>(
        `building_rents?select=buildings!inner(zip_code),median_rent&bedrooms=eq.${bedrooms}&source=neq.hud_fmr&median_rent=gt.0`
      ),
    ]);

    // Build a map of zip -> best available median rent
    const zipRentMap = new Map<
      string,
      { medianRent: number; source: string; region: string }
    >();

    // Layer 1 (lowest priority): ZORI (all-bedroom) data
    if (zipCurrentData?.length) {
      for (const row of zipCurrentData) {
        zipRentMap.set(row.zip_code, {
          medianRent: Math.round(row.median_rent),
          source: "zori",
          region: row.borough || "",
        });
      }
    }

    // Layer 2: HUD FMR (bedroom-specific)
    const fmrCol = FMR_COLUMNS[bedrooms] as keyof HudFmr;
    if (hudFmrData?.length) {
      // Only overwrite if the zip exists in our city data or has ZORI data
      for (const row of hudFmrData) {
        const fmrVal = Number(row[fmrCol]);
        if (!fmrVal || fmrVal <= 0) continue;
        const existing = zipRentMap.get(row.zip_code);
        if (existing) {
          // HUD FMR is bedroom-specific, so prefer it over ZORI
          zipRentMap.set(row.zip_code, {
            medianRent: fmrVal,
            source: "hud_fmr",
            region: existing.region,
          });
        }
      }
    }

    // Layer 3 (highest priority): Aggregated building rent data
    if (buildingRentData?.length) {
      // Group by zip and compute median
      const zipAggMap = new Map<string, number[]>();
      for (const row of buildingRentData) {
        const zip = (row as unknown as { buildings: { zip_code: string } })
          .buildings?.zip_code;
        if (!zip) continue;
        if (!zipAggMap.has(zip)) zipAggMap.set(zip, []);
        zipAggMap.get(zip)!.push(row.median_rent);
      }
      for (const [zip, rents] of zipAggMap) {
        const sorted = rents.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        const median =
          sorted.length % 2 === 0
            ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
            : sorted[mid];
        const existing = zipRentMap.get(zip);
        if (existing) {
          zipRentMap.set(zip, {
            medianRent: median,
            source: "building_rents",
            region: existing.region,
          });
        }
      }
    }

    // Map zips to neighborhood names
    const results = Array.from(zipRentMap.entries())
      .map(([zipCode, data]) => {
        const neighborhoodName = getNeighborhoodNameByCity(zipCode, city);
        return {
          zipCode,
          neighborhood: neighborhoodName || `ZIP ${zipCode}`,
          region: data.region,
          medianRent: data.medianRent,
          source: data.source,
        };
      })
      .filter((r) => r.medianRent > 0)
      .sort((a, b) => a.medianRent - b.medianRent);

    return NextResponse.json(results, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
      },
    });
  } catch (error) {
    console.error("Rent calculator API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rent data" },
      { status: 500 }
    );
  }
}

async function fetchRpc(
  fnName: string,
  params: Record<string, string>
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchSupabase<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_KEY },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
