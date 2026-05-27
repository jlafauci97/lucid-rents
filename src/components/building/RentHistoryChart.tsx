"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown } from "lucide-react";

// Lazy-load the recharts canvas so the recharts bundle stays out of the
// building page's main client chunk and only ships when this section renders.
const RentHistoryCanvas = dynamic(
  () => import("./RentHistoryCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: 300, width: "100%" }}
        className="bg-[#f8fafc] rounded-lg animate-pulse"
      />
    ),
  }
);

interface BuildingRent {
  month: string;
  beds: number;
  median_rent: number;
  min_rent: number;
  max_rent: number;
  listing_count: number;
}

interface NeighborhoodRent {
  month: string;
  beds: number;
  median_rent: number;
}

interface RentHistoryChartProps {
  buildingId: string;
  buildingRents: BuildingRent[];
  neighborhoodRents?: NeighborhoodRent[];
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1BR",
  2: "2BR",
  3: "3BR",
  4: "4BR+",
};

function formatYearTick(month: string): string {
  const year = month.slice(2, 4);
  return `'${year}`;
}

interface ChartDataPoint {
  month: string;
  label: string;
  buildingMedian: number | null;
  minRent: number | null;
  maxRent: number | null;
  range: [number, number] | null;
  neighborhoodMedian: number | null;
  listingCount: number;
}

function detectCovidTrough(
  data: ChartDataPoint[]
): { month: string; label: string } | null {
  const covidPoints = data.filter((d) => {
    if (!d.buildingMedian) return false;
    const m = d.month;
    return m >= "2020-03" && m <= "2021-06";
  });

  if (covidPoints.length < 3) return null;

  let minPoint = covidPoints[0];
  for (const p of covidPoints) {
    if (p.buildingMedian! < minPoint.buildingMedian!) {
      minPoint = p;
    }
  }

  // Check there's a preceding point that's notably higher
  const preCovidPoints = data.filter(
    (d) => d.buildingMedian && d.month >= "2019-06" && d.month < "2020-03"
  );
  if (preCovidPoints.length === 0) return null;

  const preCovidAvg =
    preCovidPoints.reduce((s, p) => s + p.buildingMedian!, 0) /
    preCovidPoints.length;

  // Only annotate if the trough is at least 5% below pre-COVID average
  if (minPoint.buildingMedian! < preCovidAvg * 0.95) {
    return { month: minPoint.month, label: "COVID dip" };
  }

  return null;
}

export function RentHistoryChart({
  buildingRents,
  neighborhoodRents,
}: RentHistoryChartProps) {
  // Determine available bed counts and default selection
  const availableBeds = useMemo(() => {
    const bedCounts = new Map<number, number>();
    for (const r of buildingRents) {
      bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + 1);
    }
    return Array.from(bedCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([beds, count]) => ({ beds, count }));
  }, [buildingRents]);

  const defaultBed = useMemo(() => {
    if (availableBeds.length === 0) return 1;
    // Prefer 1BR, otherwise pick the bed count with most data
    const has1br = availableBeds.find((b) => b.beds === 1);
    if (has1br) return 1;
    return availableBeds.reduce((best, cur) =>
      cur.count > best.count ? cur : best
    ).beds;
  }, [availableBeds]);

  const [selectedBed, setSelectedBed] = useState<number>(defaultBed);
  const [showNeighborhood, setShowNeighborhood] = useState(false);

  // Build chart data for selected bed count
  const chartData = useMemo(() => {
    const buildingByMonth = new Map<string, BuildingRent>();
    for (const r of buildingRents) {
      if (r.beds === selectedBed) {
        buildingByMonth.set(r.month.slice(0, 7), r);
      }
    }

    const neighborhoodByMonth = new Map<string, NeighborhoodRent>();
    if (neighborhoodRents) {
      for (const r of neighborhoodRents) {
        if (r.beds === selectedBed) {
          neighborhoodByMonth.set(r.month.slice(0, 7), r);
        }
      }
    }

    // Collect all months
    const allMonths = new Set<string>();
    buildingByMonth.forEach((_, k) => allMonths.add(k));
    neighborhoodByMonth.forEach((_, k) => allMonths.add(k));

    const sorted = Array.from(allMonths).sort();

    return sorted.map((month): ChartDataPoint => {
      const bldg = buildingByMonth.get(month);
      const nbhd = neighborhoodByMonth.get(month);
      return {
        month,
        label: formatYearTick(month),
        buildingMedian: bldg?.median_rent ?? null,
        minRent: bldg?.min_rent ?? null,
        maxRent: bldg?.max_rent ?? null,
        range:
          bldg?.min_rent != null && bldg?.max_rent != null
            ? [bldg.min_rent, bldg.max_rent]
            : null,
        neighborhoodMedian: nbhd?.median_rent ?? null,
        listingCount: bldg?.listing_count ?? 0,
      };
    });
  }, [buildingRents, neighborhoodRents, selectedBed]);

  const covidAnnotation = useMemo(
    () => detectCovidTrough(chartData),
    [chartData]
  );

  // Compute trend indicator
  const trend = useMemo(() => {
    const withMedian = chartData.filter((d) => d.buildingMedian !== null);
    if (withMedian.length < 6) return null;

    const recent = withMedian.slice(-6);
    const older = withMedian.slice(-12, -6);
    if (older.length === 0) return null;

    const recentAvg =
      recent.reduce((s, d) => s + d.buildingMedian!, 0) / recent.length;
    const olderAvg =
      older.reduce((s, d) => s + d.buildingMedian!, 0) / older.length;

    const pctChange = ((recentAvg - olderAvg) / olderAvg) * 100;
    if (Math.abs(pctChange) < 2) return null;

    return {
      direction: pctChange > 0 ? ("up" as const) : ("down" as const),
      pct: Math.abs(pctChange),
    };
  }, [chartData]);

  // X-axis: show label only for January or every 12th point
  const tickIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = 0; i < chartData.length; i++) {
      const m = chartData[i].month;
      if (m.endsWith("-01") || (indices.length === 0 && i === 0)) {
        indices.push(i);
      }
    }
    return new Set(indices);
  }, [chartData]);

  if (availableBeds.length === 0 || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-base font-bold text-[#0F1D2E]">
            Rent History
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#64748b] py-8">
            No rent history data available for this building.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasNeighborhoodData =
    neighborhoodRents &&
    neighborhoodRents.some((r) => r.beds === selectedBed);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-bold text-[#0F1D2E]">Rent History</h3>
          {trend && (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                trend.direction === "up"
                  ? "bg-[#fee2e2] text-[#dc2626]"
                  : "bg-[#dcfce7] text-[#16a34a]"
              }`}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {trend.pct.toFixed(1)}% YoY
            </span>
          )}
        </div>
        {/* Bed tabs */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {availableBeds.map(({ beds }) => (
            <button
              key={beds}
              type="button"
              onClick={() => setSelectedBed(beds)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedBed === beds
                  ? "bg-[#3B82F6] text-white"
                  : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
              }`}
            >
              {BED_LABELS[beds] || `${beds}BR`}
            </button>
          ))}
        </div>
        {/* Neighborhood toggle */}
        {hasNeighborhoodData && (
          <label className="flex items-center gap-2 mt-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showNeighborhood}
              onChange={(e) => setShowNeighborhood(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-[#cbd5e1] text-[#3B82F6] focus:ring-[#3B82F6] focus:ring-offset-0"
            />
            <span className="text-xs text-[#64748b]">
              Show neighborhood median
            </span>
          </label>
        )}
      </CardHeader>
      <CardContent>
        <RentHistoryCanvas
          chartData={chartData}
          tickIndices={tickIndices}
          showNeighborhood={showNeighborhood}
          covidAnnotation={covidAnnotation}
        />
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Based on listing data. Range shows min-max asking rents.
        </p>
      </CardContent>
    </Card>
  );
}
