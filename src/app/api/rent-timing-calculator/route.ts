import { NextRequest, NextResponse } from "next/server";
import { isValidCity, type City } from "@/lib/cities";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface SeasonalRow {
  city: string;
  neighborhood: string | null;
  zip: string | null;
  month_of_year: number;
  beds: number;
  rent_index: number;
  sample_years: number;
}

interface NeighborhoodOption {
  neighborhood: string | null;
  zip: string | null;
}

async function fetchSupabase<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Supabase error: ${res.status}`);
  return res.json();
}

/**
 * GET /api/rent-timing-calculator?city=nyc&action=neighborhoods
 *   Returns distinct neighborhood/zip combos for dropdown
 *
 * GET /api/rent-timing-calculator?city=nyc&zip=10001&beds=1
 *   Returns 12-month seasonal index data
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const city = searchParams.get("city") as City | null;
  const action = searchParams.get("action");

  if (!city || !isValidCity(city)) {
    return NextResponse.json(
      { error: "Invalid or missing city parameter" },
      { status: 400 }
    );
  }

  try {
    if (action === "neighborhoods") {
      // Return distinct neighborhood/zip combos for this city
      const data = await fetchSupabase<NeighborhoodOption[]>(
        `dewey_seasonal_index?select=neighborhood,zip&city=eq.${encodeURIComponent(city)}&order=neighborhood.asc.nullsfirst,zip.asc`
      );

      // Deduplicate
      const seen = new Set<string>();
      const unique: NeighborhoodOption[] = [];
      for (const row of data) {
        const key = `${row.neighborhood ?? ""}|${row.zip ?? ""}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(row);
        }
      }

      return NextResponse.json(unique);
    }

    // Seasonal index data
    const zip = searchParams.get("zip");
    const beds = Number(searchParams.get("beds") ?? "1");

    if (beds < 0 || beds > 4) {
      return NextResponse.json(
        { error: "Beds must be 0-4" },
        { status: 400 }
      );
    }

    // Build filter
    let filter = `dewey_seasonal_index?select=month_of_year,rent_index,sample_years&city=eq.${encodeURIComponent(city)}&beds=eq.${beds}&order=month_of_year.asc`;

    if (zip) {
      filter += `&zip=eq.${encodeURIComponent(zip)}`;
    } else {
      // City-wide: zip is null
      filter += `&zip=is.null`;
    }

    const data = await fetchSupabase<SeasonalRow[]>(filter);

    return NextResponse.json(data);
  } catch (err) {
    console.error("rent-timing-calculator API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
