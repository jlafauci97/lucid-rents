import Link from "next/link";
import { Zap } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { cityPath } from "@/lib/seo";
import { T } from "@/lib/design-tokens";
import type { EnergyBenchmark } from "@/types";
import type { City } from "@/lib/cities";

interface EnergyScoreCardProps {
  data: EnergyBenchmark | null;
  city?: City;
}

function scoreColor(score: number): { color: string; bg: string } {
  if (score >= 75) return { color: T.sage, bg: `${T.sage}14` };
  if (score >= 50) return { color: T.gold, bg: `${T.gold}14` };
  return { color: T.danger, bg: `${T.danger}14` };
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
  houston: "Houston Energy Scores",
};

export function EnergyScoreCard({ data, city }: EnergyScoreCardProps) {
  if (!data || data.energy_star_score == null) return null;

  const score = data.energy_star_score;
  const sc = scoreColor(score);
  const linkLabel = ENERGY_LINK_LABEL[city ?? "nyc"];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="w-[18px] h-[18px]" style={{ color: sc.color }} />
          <h3 className="font-semibold" style={{ color: T.text1 }}>Energy Score</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Score + Label */}
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold" style={{ color: sc.color }}>{score}</span>
            <div>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: sc.bg, color: sc.color }}
              >
                {scoreLabel(score)}
              </span>
              <p className="text-xs mt-0.5" style={{ color: T.text3 }}>ENERGY STAR Score</p>
            </div>
          </div>

          {/* Details */}
          <dl className="space-y-1.5 text-sm">
            {data.site_eui != null && (
              <div className="flex justify-between">
                <dt style={{ color: T.text3 }}>Site EUI</dt>
                <dd className="font-medium" style={{ color: T.text1 }}>{data.site_eui.toFixed(1)} kBtu/ft&sup2;</dd>
              </div>
            )}
            {data.total_ghg_emissions != null && (
              <div className="flex justify-between">
                <dt style={{ color: T.text3 }}>GHG Emissions</dt>
                <dd className="font-medium" style={{ color: T.text1 }}>{data.total_ghg_emissions.toLocaleString()} tCO&sub2;e</dd>
              </div>
            )}
          </dl>

          {/* Year + Link */}
          <p className="text-xs" style={{ color: T.text3 }}>
            {data.report_year} benchmarking data
          </p>
          <Link
            href={cityPath("/energy", city)}
            className="text-xs font-medium transition-colors hover:opacity-80"
            style={{ color: T.blue }}
          >
            {linkLabel} &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
