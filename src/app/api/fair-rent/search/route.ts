import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 25;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ buildings: [] });
  }

  try {
    const supabase = await createClient();

    // Extract the street number (if present) for a fast indexed lookup
    const parts = q.toUpperCase().trim().split(/\s+/);
    const hasNumber = /^\d+$/.test(parts[0]);

    let data;

    if (hasNumber && parts.length >= 2) {
      // Most specific: match house number + street name prefix
      // This hits the btree index on full_address
      const houseNum = parts[0];
      const streetPart = parts.slice(1).join(" ");
      const result = await supabase
        .from("buildings")
        .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
        .eq("metro", "nyc")
        .ilike("full_address", `${houseNum} ${streetPart}%`)
        .order("review_count", { ascending: false })
        .limit(8);
      data = result.data;
    } else {
      // Street name only search — use ilike with prefix
      const result = await supabase
        .from("buildings")
        .select("id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, total_units")
        .eq("metro", "nyc")
        .ilike("full_address", `%${parts[0]}%`)
        .order("review_count", { ascending: false })
        .limit(8);
      data = result.data;
    }

    return NextResponse.json({ buildings: data ?? [] });
  } catch {
    return NextResponse.json({ buildings: [] });
  }
}
