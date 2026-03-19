import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import { MapPin, AlertTriangle, Building2 } from "lucide-react";

interface SameLandlordBuildingsProps {
  buildingId: string;
  ownerName: string;
}

function letterGrade(score: number | null): { letter: string; color: string; bg: string } {
  if (score == null) return { letter: "?", color: "#3B82F6", bg: "#eff6ff" };
  if (score >= 9) return { letter: "A+", color: "#15803d", bg: "#dcfce7" };
  if (score >= 8) return { letter: "A", color: "#16a34a", bg: "#dcfce7" };
  if (score >= 7) return { letter: "B+", color: "#65a30d", bg: "#ecfccb" };
  if (score >= 6) return { letter: "B", color: "#ca8a04", bg: "#fef9c3" };
  if (score >= 5) return { letter: "C+", color: "#d97706", bg: "#fef3c7" };
  if (score >= 4) return { letter: "C", color: "#ea580c", bg: "#ffedd5" };
  if (score >= 3) return { letter: "D", color: "#dc2626", bg: "#fee2e2" };
  return { letter: "F", color: "#991b1b", bg: "#fee2e2" };
}

export async function SameLandlordBuildings({ buildingId, ownerName }: SameLandlordBuildingsProps) {
  const supabase = await createClient();
  const { data: buildings } = await supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, slug, overall_score, violation_count, total_units, review_count"
    )
    .eq("owner_name", ownerName)
    .neq("id", buildingId)
    .order("review_count", { ascending: false })
    .limit(6);

  if (!buildings || buildings.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#0F1D2E]">
          More by This Landlord
        </h2>
        <Link
          href={landlordUrl(ownerName)}
          className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
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
              href={buildingUrl(b)}
              className="group bg-white border border-[#e2e8f0] rounded-xl p-4 hover:shadow-md hover:border-[#3B82F6]/40 transition-all"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ backgroundColor: grade.bg, color: grade.color }}
                >
                  {b.overall_score != null ? grade.letter : <Building2 className="w-5 h-5 text-[#3B82F6]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[#0F1D2E] group-hover:text-[#3B82F6] transition-colors text-sm truncate">
                    {b.full_address}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-[#64748b] mt-0.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" />
                    {b.borough}
                    {b.zip_code && ` \u00b7 ${b.zip_code}`}
                  </div>
                </div>
              </div>

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
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
