import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { buildingUrl } from "@/lib/seo";
import { deriveScore } from "@/lib/constants";
import type { Building } from "@/types";
import type { City } from "@/lib/cities";

interface TrendingBuildingsProps {
  city: City;
}

export async function TrendingBuildings({ city }: TrendingBuildingsProps) {
  const supabase = await createClient();
  const metro = city === "nyc" ? "nyc" : city;

  const { data: buildings } = await supabase
    .from("buildings")
    .select(
      "id, full_address, borough, zip_code, slug, overall_score, violation_count, complaint_count"
    )
    .eq("metro", metro)
    .gt("violation_count", 0)
    .order("violation_count", { ascending: false })
    .limit(5);

  if (!buildings || buildings.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
      <div className="px-5 py-3 border-b border-[#E2E8F0]">
        <h3 className="text-xs font-semibold text-[#A3ACBE] uppercase tracking-wider flex items-center gap-2">
          <TrendingUp className="w-3.5 h-3.5" />
          Most Violations
        </h3>
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {(buildings as Building[]).map((building) => {
          const score = building.overall_score ?? deriveScore(
            building.violation_count || 0,
            building.complaint_count || 0
          );
          return (
            <Link
              key={building.id}
              href={buildingUrl(building, city)}
              className="flex items-center justify-between px-5 py-3 hover:bg-[#FAFBFD] transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#1A1F36] truncate">
                  {building.full_address}
                </p>
                <p className="text-xs text-[#A3ACBE]">
                  {building.borough}
                  {building.violation_count > 0 &&
                    ` · ${building.violation_count.toLocaleString()} violations`}
                </p>
              </div>
              <div className="ml-3 flex-shrink-0">
                <LetterGrade score={score} size="sm" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
