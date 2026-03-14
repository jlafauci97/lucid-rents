import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl } from "@/lib/seo";
import { MapPin, AlertTriangle, Building2 } from "lucide-react";

interface NearbyBuildingsProps {
  buildingId: string;
  zipCode: string | null;
  borough: string;
}

function letterGrade(score: number | null): { letter: string; color: string; bg: string } {
  if (score == null) return { letter: "?", color: "#94a3b8", bg: "#f1f5f9" };
  if (score >= 9) return { letter: "A+", color: "#15803d", bg: "#dcfce7" };
  if (score >= 8) return { letter: "A", color: "#16a34a", bg: "#dcfce7" };
  if (score >= 7) return { letter: "B+", color: "#65a30d", bg: "#ecfccb" };
  if (score >= 6) return { letter: "B", color: "#ca8a04", bg: "#fef9c3" };
  if (score >= 5) return { letter: "C+", color: "#d97706", bg: "#fef3c7" };
  if (score >= 4) return { letter: "C", color: "#ea580c", bg: "#ffedd5" };
  if (score >= 3) return { letter: "D", color: "#dc2626", bg: "#fee2e2" };
  return { letter: "F", color: "#991b1b", bg: "#fee2e2" };
}

export async function NearbyBuildings({ buildingId, zipCode, borough }: NearbyBuildingsProps) {
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
      <h2 className="text-xl font-bold text-[#0F1D2E] mb-4">
        Nearby Buildings
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {buildings.map((b) => {
          const grade = letterGrade(b.overall_score);
          return (
            <Link
              key={b.id}
              href={buildingUrl(b)}
              className="group bg-white border border-[#e2e8f0] rounded-xl p-4 hover:shadow-md hover:border-[#3B82F6]/40 transition-all"
            >
              <div className="flex items-start gap-3">
                {/* Grade badge */}
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {grade.letter}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors text-sm truncate">
                    {b.full_address}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#64748b] mt-0.5">
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
                  <span className="inline-flex items-center gap-1 font-medium text-[#ef4444]">
                    <AlertTriangle className="w-3 h-3" />
                    {b.violation_count.toLocaleString()} violations
                  </span>
                )}
                {b.total_units != null && b.total_units > 0 && (
                  <span className="inline-flex items-center gap-1 text-[#64748b]">
                    <Building2 className="w-3 h-3" />
                    {b.total_units} units
                  </span>
                )}
                {b.review_count > 0 && (
                  <span className="text-[#64748b]">
                    {b.review_count} review{b.review_count !== 1 ? "s" : ""}
                  </span>
                )}
                {b.is_rent_stabilized && (
                  <span className="text-emerald-600 font-medium">
                    Rent Stabilized
                  </span>
                )}
              </div>

              {/* Score bar */}
              {b.overall_score != null && (
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(Number(b.overall_score) / 10) * 100}%`,
                        backgroundColor:
                          Number(b.overall_score) >= 7
                            ? "#22c55e"
                            : Number(b.overall_score) >= 4
                              ? "#f59e0b"
                              : "#ef4444",
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-[#0F1D2E]">
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
