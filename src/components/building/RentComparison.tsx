import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { BarChart3, TrendingDown, TrendingUp, Minus } from "lucide-react";

interface BuildingRent {
  bedrooms: number;
  min_rent: number;
  max_rent: number;
  median_rent: number;
}

interface NeighborhoodRent {
  bedrooms: number;
  median_rent: number;
}

interface RentComparisonProps {
  buildingRents: BuildingRent[];
  neighborhoodRents: NeighborhoodRent[];
  zipCode: string;
  borough: string;
  historicalContext?: string;
  rentTrajectory?: {
    buildingYoY: number;
    neighborhoodYoY: number;
  };
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1 Bed",
  2: "2 Bed",
  3: "3 Bed",
  4: "4+ Bed",
};

function formatRent(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function getComparisonInfo(buildingMedian: number, neighborhoodMedian: number) {
  if (neighborhoodMedian === 0) return null;
  const pctDiff = ((buildingMedian - neighborhoodMedian) / neighborhoodMedian) * 100;
  const absPct = Math.abs(Math.round(pctDiff));

  if (pctDiff > 20) {
    return {
      label: "Above average",
      color: "text-red-600",
      bgColor: "bg-red-50",
      pct: `+${absPct}%`,
      Icon: TrendingUp,
    };
  }
  if (pctDiff < -20) {
    return {
      label: "Below average",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
      pct: `-${absPct}%`,
      Icon: TrendingDown,
    };
  }
  return {
    label: "Average",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
    pct: absPct > 0 ? `${pctDiff > 0 ? "+" : "-"}${absPct}%` : "0%",
    Icon: Minus,
  };
}

function getOverallAssessment(
  buildingRents: BuildingRent[],
  neighborhoodMap: Map<number, number>,
) {
  let totalBuildingMedian = 0;
  let totalNeighborhoodMedian = 0;
  let count = 0;

  for (const br of buildingRents) {
    const nm = neighborhoodMap.get(br.bedrooms);
    if (nm && nm > 0 && br.median_rent > 0) {
      totalBuildingMedian += br.median_rent;
      totalNeighborhoodMedian += nm;
      count++;
    }
  }

  if (count === 0) return null;

  const avgBuildingMedian = totalBuildingMedian / count;
  const avgNeighborhoodMedian = totalNeighborhoodMedian / count;
  const pctDiff =
    ((avgBuildingMedian - avgNeighborhoodMedian) / avgNeighborhoodMedian) * 100;

  if (pctDiff > 20) {
    return {
      message: "Rents are above average for this area",
      color: "text-red-700",
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
      Icon: TrendingUp,
    };
  }
  if (pctDiff < -20) {
    return {
      message: "Rents are below average for this area",
      color: "text-emerald-700",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      Icon: TrendingDown,
    };
  }
  return {
    message: "Rents are typical for this area",
    color: "text-gray-700",
    bgColor: "bg-gray-50",
    borderColor: "border-gray-200",
    Icon: Minus,
  };
}

export function RentComparison({
  buildingRents,
  neighborhoodRents,
  zipCode,
  borough,
  historicalContext,
  rentTrajectory,
}: RentComparisonProps) {
  if (!buildingRents || buildingRents.length === 0) {
    return null;
  }

  // Build a map of neighborhood medians by bedroom count
  const neighborhoodMap = new Map<number, number>();
  for (const nr of neighborhoodRents) {
    if (nr.median_rent > 0) {
      neighborhoodMap.set(nr.bedrooms, nr.median_rent);
    }
  }

  // Only show bedroom types where we have both building and neighborhood data
  const comparableEntries = buildingRents
    .filter((br) => br.median_rent > 0 && neighborhoodMap.has(br.bedrooms))
    .sort((a, b) => a.bedrooms - b.bedrooms);

  if (comparableEntries.length === 0) {
    return null;
  }

  const overall = getOverallAssessment(buildingRents, neighborhoodMap);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-[18px] h-[18px] text-[#2563EB]" />
          <h3 className="font-semibold text-[#0F1D2E]">Rent Comparison</h3>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* "Is My Rent Fair?" overall indicator */}
          {overall && (
            <div
              className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border ${overall.bgColor} ${overall.borderColor}`}
            >
              <overall.Icon className={`w-4 h-4 ${overall.color} shrink-0`} />
              <span className={`text-sm font-medium ${overall.color}`}>
                {overall.message}
              </span>
            </div>
          )}

          {/* Per-bedroom comparison */}
          <div className="space-y-3">
            {comparableEntries.map((entry) => {
              const neighborhoodMedian = neighborhoodMap.get(entry.bedrooms)!;
              const comparison = getComparisonInfo(
                entry.median_rent,
                neighborhoodMedian,
              );

              return (
                <div key={entry.bedrooms} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#0F1D2E]">
                      {BED_LABELS[entry.bedrooms] || `${entry.bedrooms} Bed`}
                    </span>
                    {comparison && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${comparison.bgColor} ${comparison.color}`}
                      >
                        <comparison.Icon className="w-3 h-3" />
                        {comparison.label} ({comparison.pct})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#64748b]">
                      This building:{" "}
                      <span className="font-medium text-[#334155]">
                        {entry.min_rent === entry.max_rent
                          ? formatRent(entry.median_rent)
                          : `${formatRent(entry.min_rent)} – ${formatRent(entry.max_rent)}`}
                      </span>
                    </span>
                    <span className="text-[#64748b]">
                      Area:{" "}
                      <span className="font-medium text-[#334155]">
                        {formatRent(neighborhoodMedian)}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Historical context & trajectory */}
          {(historicalContext || rentTrajectory) && (
            <>
              <div className="border-t border-[#e2e8f0]" />

              {historicalContext && (
                <p className="text-xs text-[#64748b]">{historicalContext}</p>
              )}

              {rentTrajectory && (() => {
                const faster = rentTrajectory.buildingYoY > rentTrajectory.neighborhoodYoY;
                const arrow = faster ? "\u2197" : "\u2198";
                const label = faster
                  ? "Rising faster than neighborhood"
                  : "Rising slower than neighborhood";
                const color = faster ? "text-red-600" : "text-emerald-600";
                const sign = (v: number) => (v >= 0 ? `+${v}` : `${v}`);
                return (
                  <p className={`text-xs font-medium ${color}`}>
                    Trajectory: {arrow} {label} ({sign(rentTrajectory.buildingYoY)}% vs{" "}
                    {sign(rentTrajectory.neighborhoodYoY)}% YoY)
                  </p>
                );
              })()}
            </>
          )}

          <p className="text-[10px] text-[#94a3b8]">
            Compared to median rents in {zipCode}, {borough}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
