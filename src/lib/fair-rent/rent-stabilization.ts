import type { StabilizationSignal } from "@/components/fair-rent/types";
import { createClient } from "@/lib/supabase/server";

export async function fetchStabilization(
  address: string,
  zipCode: string
): Promise<StabilizationSignal | null> {
  try {
    const supabase = await createClient();

    const parts = address.match(/^(\d+)\s+(.+?)(?:,|\s+(?:apt|unit|#)|$)/i);
    if (!parts) return null;

    const { data: building } = await supabase
      .from("buildings")
      .select("id, rent_stabilized, stabilized_units, total_units")
      .eq("metro", "nyc")
      .eq("zip_code", zipCode)
      .ilike("full_address", `${parts[1]}%${parts[2].trim()}%`)
      .limit(1)
      .maybeSingle();

    if (!building) {
      return {
        is_stabilized: false,
        stabilized_units: null,
        total_units: null,
        yoy_unit_change_pct: null,
        summary: "We couldn't find this building in the rent stabilization registry. Market rate rules likely apply.",
      };
    }

    const is_stabilized = building.rent_stabilized === true;
    const stabilized_units = building.stabilized_units;
    const total_units = building.total_units;
    const yoy_unit_change_pct = null;

    let summary: string;
    if (is_stabilized) {
      summary = `This building is rent stabilized. ${stabilized_units ?? "Some"} of ~${total_units ?? "?"} units are covered. If your unit is stabilized, your landlord must give you a lease rider showing the legal regulated rent. Always ask before signing.`;
    } else {
      summary = "This building is not rent stabilized. Market rate rules apply.";
    }

    return { is_stabilized, stabilized_units, total_units, yoy_unit_change_pct, summary };
  } catch {
    return null;
  }
}
