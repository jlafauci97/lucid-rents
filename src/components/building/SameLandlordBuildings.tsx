import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import { T, gradeColor } from "@/lib/design-tokens";
import { MapPin, AlertTriangle, Building2 } from "lucide-react";

interface SameLandlordBuildingsProps {
  buildingId: string;
  ownerName: string;
  managementCompany?: string | null;
  city?: import("@/lib/cities").City;
  currentBuildingRent?: number;
  landlordRentGrowth?: number;
  marketRentGrowth?: number;
}

function letterGrade(score: number | null): { letter: string; color: string; bg: string } {
  if (score == null) return { letter: "?", color: T.blue, bg: `${T.blue}14` };
  const letter = score >= 9 ? "A+" : score >= 8 ? "A" : score >= 7 ? "B+" : score >= 6 ? "B" : score >= 5 ? "C+" : score >= 4 ? "C" : score >= 3 ? "D" : "F";
  const c = gradeColor(letter);
  return { letter, color: c, bg: `${c}14` };
}

export async function SameLandlordBuildings({
  buildingId,
  ownerName,
  managementCompany,
  city,
  currentBuildingRent,
  landlordRentGrowth,
  marketRentGrowth,
}: SameLandlordBuildingsProps) {
  const supabase = await createClient();

  // Prefer grouping by management company (who tenants interact with),
  // fall back to property owner
  const groupByCompany = !!managementCompany;
  const groupByField = groupByCompany ? "management_company" : "owner_name";
  const groupByValue = groupByCompany ? managementCompany : ownerName;
  const displayName = groupByValue;

  const { data: buildings } = await supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, slug, overall_score, violation_count, total_units, review_count"
    )
    .eq(groupByField, groupByValue)
    .neq("id", buildingId)
    .order("review_count", { ascending: false })
    .limit(6);

  // Fetch 1BR median rents for sibling buildings when we have rent context
  let rentMap = new Map<string, number>();
  if (currentBuildingRent != null && buildings && buildings.length > 0) {
    const ids = buildings.map((b) => b.id);
    const { data: rents } = await supabase
      .from("building_rents")
      .select("building_id, median_rent")
      .in("building_id", ids)
      .eq("bedrooms", 1)
      .gt("median_rent", 0);
    if (rents) {
      for (const r of rents) {
        rentMap.set(r.building_id, r.median_rent);
      }
    }
  }

  if (!buildings || buildings.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold" style={{ color: T.text1 }}>
          More {groupByCompany ? `Managed by ${displayName}` : `by This Owner`}
        </h2>
        <Link
          href={landlordUrl(groupByValue)}
          className="text-sm font-medium transition-colors hover:opacity-80"
          style={{ color: T.blue }}
        >
          View all &rarr;
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {buildings.map((b) => {
          const grade = letterGrade(b.overall_score);
          return (
            <Link
              key={b.id}
              href={buildingUrl(b, city)}
              className="group rounded-2xl border p-4 hover:shadow-md transition-all"
              style={{ backgroundColor: T.surface, borderColor: T.border }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {b.overall_score != null ? grade.letter : <Building2 className="w-5 h-5" style={{ color: T.blue }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold transition-colors text-sm truncate" style={{ color: T.text1 }}>
                    {b.full_address}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#5E6687] mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {b.borough}
                    {b.zip_code && ` \u00b7 ${b.zip_code}`}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs">
                {b.violation_count > 0 && (
                  <span className="inline-flex items-center gap-1 font-medium text-[#EF4444]">
                    <AlertTriangle className="w-3 h-3" />
                    {b.violation_count.toLocaleString()} violations
                  </span>
                )}
                {b.total_units != null && b.total_units > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#5E6687]">
                    <Building2 className="w-3 h-3" />
                    {b.total_units} units
                  </span>
                )}
                {b.review_count > 0 && (
                  <span className="text-[#5E6687]">
                    {b.review_count} review{b.review_count !== 1 ? "s" : ""}
                  </span>
                )}
                {rentMap.has(b.id) && (
                  <span className="text-[#1A1F36] font-medium">
                    1BR: ${rentMap.get(b.id)!.toLocaleString()}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Rent summary across landlord portfolio */}
      {currentBuildingRent != null && rentMap.size > 0 && (() => {
        const allRents = [...rentMap.values(), currentBuildingRent].sort(
          (a, b) => b - a
        );
        const rank = allRents.indexOf(currentBuildingRent) + 1;
        const total = allRents.length;

        return (
          <div className="mt-4 space-y-1 text-xs text-[#5E6687]">
            <p>
              This is their{" "}
              <span className="font-medium text-[#1A1F36]">
                {rank === 1
                  ? "most expensive"
                  : rank === total
                    ? "least expensive"
                    : `#${rank} most expensive`}
              </span>{" "}
              property (of {total}).
            </p>
            {landlordRentGrowth != null && marketRentGrowth != null && (
              <p>
                Landlord avg rent growth:{" "}
                <span className="font-medium text-[#1A1F36]">
                  {landlordRentGrowth > 0 ? "+" : ""}
                  {landlordRentGrowth.toFixed(1)}%/yr
                </span>{" "}
                (market:{" "}
                <span className="font-medium text-[#1A1F36]">
                  {marketRentGrowth > 0 ? "+" : ""}
                  {marketRentGrowth.toFixed(1)}%/yr
                </span>
                )
              </p>
            )}
          </div>
        );
      })()}
    </section>
  );
}
