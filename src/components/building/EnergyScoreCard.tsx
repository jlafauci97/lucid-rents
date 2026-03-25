import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { cityPath } from "@/lib/seo";
import type { EnergyBenchmark } from "@/types";
import type { City } from "@/lib/cities";

interface EnergyScoreCardProps {
  data: EnergyBenchmark | null;
  city?: City;
}

function scoreColor(score: number): { badge: string; text: string } {
  if (score >= 75) return { badge: "bg-emerald-50 text-emerald-700", text: "text-emerald-600" };
  if (score >= 50) return { badge: "bg-amber-50 text-amber-700", text: "text-amber-600" };
  return { badge: "bg-red-50 text-red-700", text: "text-red-600" };
}

function scoreLabel(score: number): string {
  if (score >= 75) return "High Efficiency";
  if (score >= 50) return "Average Efficiency";
  return "Low Efficiency";
}

const ENERGY_LINK_LABEL: Record<City, string> = {
  nyc: "NYC Energy Scores",
  "los-angeles": "LA Energy Scores",
  chicago: "Chicago Energy Scores",
  miami: "Miami Energy Scores",
};

export function EnergyScoreCard({ data, city }: EnergyScoreCardProps) {
  if (!data || data.energy_star_score == null) return null;

  const score = data.energy_star_score;
  const colors = scoreColor(score);
  const linkLabel = ENERGY_LINK_LABEL[city ?? "nyc"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className={`w-[18px] h-[18px] ${colors.text}`} />
          <h3 className="font-semibold text-[#0F1D2E]">Energy Score</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Score + Label */}
          <div className="flex items-center gap-3">
            <span className={`text-3xl font-bold ${colors.text}`}>{score}</span>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.badge}`}>
                {scoreLabel(score)}
              </span>
              <p className="text-xs text-[#94a3b8] mt-0.5">ENERGY STAR Score</p>
            </div>
          </div>

          {/* Details */}
          <dl className="space-y-1.5 text-sm">
            {data.site_eui != null && (
              <div className="flex justify-between">
                <dt className="text-[#94a3b8]">Site EUI</dt>
                <dd className="text-[#0F1D2E] font-medium">{data.site_eui.toFixed(1)} kBtu/ft&sup2;</dd>
              </div>
            )}
            {data.total_ghg_emissions != null && (
              <div className="flex justify-between">
                <dt className="text-[#94a3b8]">GHG Emissions</dt>
                <dd className="text-[#0F1D2E] font-medium">{data.total_ghg_emissions.toLocaleString()} tCO&sub2;e</dd>
              </div>
            )}
          </dl>

          {/* Year + Link */}
          <p className="text-xs text-[#94a3b8]">
            {data.report_year} benchmarking data
          </p>
          <Link
            href={cityPath("/energy", city)}
            className="text-xs text-[#3B82F6] hover:text-[#2563EB] font-medium transition-colors"
          >
            {linkLabel} &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
