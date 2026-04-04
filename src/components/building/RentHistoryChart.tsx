"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  ReferenceLine,
  Label,
} from "recharts";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { T } from "@/lib/design-tokens";

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

function formatDollar(value: number): string {
  return `$${value.toLocaleString()}`;
}

function formatYearTick(month: string): string {
  const year = month.slice(2, 4);
  return `'${year}`;
}

function formatTooltipMonth(month: string): string {
  const d = new Date(month + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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

function CustomTooltip({
  active,
  payload,
  showNeighborhood,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
  showNeighborhood: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="rounded-lg shadow-md px-3 py-2.5 text-xs" style={{ backgroundColor: T.surface, border: `1px solid ${T.border}` }}>
      <p className="font-semibold mb-1.5" style={{ color: T.text1, fontFamily: "var(--font-body)" }}>
        {formatTooltipMonth(data.month)}
      </p>
      {data.buildingMedian !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: T.blue }} />
          <span style={{ color: T.text2 }}>
            Building median:{" "}
            <span className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>{formatDollar(data.buildingMedian)}</span>
          </span>
        </div>
      )}
      {data.minRent !== null && data.maxRent !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: `${T.blue}60` }} />
          <span style={{ color: T.text2 }}>
            Range: <span style={{ fontFamily: "var(--font-mono)" }}>{formatDollar(data.minRent)} - {formatDollar(data.maxRent)}</span>
          </span>
        </div>
      )}
      {showNeighborhood && data.neighborhoodMedian !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 rounded-full inline-block" style={{ backgroundColor: T.text3 }} />
          <span style={{ color: T.text2 }}>
            Neighborhood:{" "}
            <span className="font-medium" style={{ fontFamily: "var(--font-mono)" }}>
              {formatDollar(data.neighborhoodMedian)}
            </span>
          </span>
        </div>
      )}
      {data.listingCount > 0 && (
        <p className="mt-1" style={{ color: T.text3 }}>
          {data.listingCount} listing{data.listingCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
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
          <h3 className="text-base font-bold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>
            Rent History
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-center py-8" style={{ color: T.text2 }}>
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
          <h3 className="text-base font-bold" style={{ color: T.text1, fontFamily: "var(--font-display)" }}>Rent History</h3>
          {trend && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{
                color: trend.direction === "up" ? T.danger : T.sage,
                backgroundColor: trend.direction === "up" ? `${T.danger}15` : `${T.sage}15`,
              }}
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
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={{
                backgroundColor: selectedBed === beds ? T.accent : T.elevated,
                color: selectedBed === beds ? "#FFFFFF" : T.text2,
                fontFamily: "var(--font-body)",
              }}
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
              className="w-3.5 h-3.5 rounded focus:ring-offset-0"
              style={{ borderColor: T.border, accentColor: T.accent }}
            />
            <span className="text-xs" style={{ color: T.text2, fontFamily: "var(--font-body)" }}>
              Show neighborhood median
            </span>
          </label>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[250px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={T.border}
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: T.text2 }}
                tickLine={false}
                axisLine={{ stroke: T.border }}
                tickFormatter={(value: string, index: number) =>
                  tickIndices.has(index) ? formatYearTick(value) : ""
                }
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: T.text2 }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(value: number) =>
                  `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`
                }
              />
              <Tooltip
                content={
                  <CustomTooltip showNeighborhood={showNeighborhood} />
                }
              />
              {/* Min-max range area */}
              <Area
                type="monotone"
                dataKey="range"
                fill={T.accent}
                fillOpacity={0.1}
                stroke="none"
                connectNulls={false}
                isAnimationActive={false}
              />
              {/* Building median line */}
              <Line
                type="monotone"
                dataKey="buildingMedian"
                stroke={T.accent}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: T.accent }}
                connectNulls
              />
              {/* Neighborhood median line */}
              {showNeighborhood && (
                <Line
                  type="monotone"
                  dataKey="neighborhoodMedian"
                  stroke={T.text3}
                  strokeWidth={1.5}
                  strokeDasharray="6 3"
                  dot={false}
                  activeDot={{ r: 3, strokeWidth: 0, fill: T.text3 }}
                  connectNulls
                />
              )}
              {/* COVID annotation */}
              {covidAnnotation && (
                <ReferenceLine
                  x={covidAnnotation.month}
                  stroke={T.text3}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                >
                  <Label
                    value={covidAnnotation.label}
                    position="top"
                    fill={T.text3}
                    fontSize={10}
                    offset={8}
                  />
                </ReferenceLine>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] mt-3" style={{ color: T.text3 }}>
          Based on listing data. Range shows min-max asking rents.
        </p>
      </CardContent>
    </Card>
  );
}
