import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl } from "@/lib/seo";
import { T, gradeColor } from "@/lib/design-tokens";
import { MapPin, AlertTriangle, Building2 } from "lucide-react";

interface NearbyBuildingsProps {
  buildingId: string;
  zipCode: string | null;
  borough: string;
  city?: import("@/lib/cities").City;
}

function letterGrade(score: number | null): { letter: string; color: string; bg: string } {
  if (score == null) return { letter: "?", color: T.blue, bg: `${T.blue}14` };
  const letter = score >= 9 ? "A+" : score >= 8 ? "A" : score >= 7 ? "B+" : score >= 6 ? "B" : score >= 5 ? "C+" : score >= 4 ? "C" : score >= 3 ? "D" : "F";
  const c = gradeColor(letter);
  return { letter, color: c, bg: `${c}14` };
}

export async function NearbyBuildings({ buildingId, zipCode, borough, city }: NearbyBuildingsProps) {
  if (!zipCode) return null;

  const supabase = await createClient();
  const { data: buildings } = await supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count, review_count, total_units, year_built, is_rent_stabilized"
    )
    .eq("zip_code", zipCode)
    .neq("id", buildingId)
    .order("review_count", { ascending: false })
    .limit(4);

  if (!buildings || buildings.length === 0) return null;

  return (
    <section>
      <h2 className="text-xl font-bold mb-4" style={{ color: T.text1 }}>
        Nearby Buildings
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                {/* Grade badge */}
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
                    {b.year_built ? ` \u00b7 Built ${b.year_built}` : ""}
                  </div>
                </div>
              </div>

              {/* Stats row */}
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
                {b.is_rent_stabilized && (
                  <span className="font-medium" style={{ color: T.sage }}>
                    Rent Stabilized
                  </span>
                )}
              </div>

              {/* Score bar */}
              {b.overall_score != null && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.subtle }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Number(b.overall_score) / 10) * 100}%`,
                        backgroundColor: grade.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold" style={{ color: T.text1 }}>
                    {b.overall_score}/10
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
