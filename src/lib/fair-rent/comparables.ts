import type { ComparableBuilding } from "@/components/fair-rent/types";
import { createClient } from "@/lib/supabase/server";

export async function fetchComparables(
  address: string,
  zipCode: string
): Promise<ComparableBuilding[]> {
  try {
    const supabase = await createClient();

    // Find buildings in the same ZIP with better scores, excluding the input building
    const { data } = await supabase
      .from("buildings")
      .select("full_address, borough, slug, zip_code, total_units, violation_count, complaint_count, overall_score, is_rent_stabilized, year_built")
      .eq("metro", "nyc")
      .eq("zip_code", zipCode)
      .gte("overall_score", 4.0)
      .not("full_address", "ilike", `%${address.split(",")[0].trim()}%`)
      .order("overall_score", { ascending: false })
      .order("violation_count", { ascending: true })
      .limit(6);

    return (data ?? []) as ComparableBuilding[];
  } catch {
    return [];
  }
}
