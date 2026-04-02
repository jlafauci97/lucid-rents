"use client";

import { useMemo, useState } from "react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  ComposedChart,
  Line,
} from "recharts";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

export interface NeighborhoodRentRow {
  month: string;
  beds: number;
  median_rent: number;
  p25_rent: number | null;
  p75_rent: number | null;
  listing_count: number;
}

interface NeighborhoodRentChartProps {
  rents: NeighborhoodRentRow[];
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
  median: number | null;
  p25: number | null;
  p75: number | null;
  range: [number, number] | null;
  listingCount: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartDataPoint }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const data = payload[0].payload;

  return (
    <div className="bg-white border border-[#e2e8f0] rounded-lg shadow-md px-3 py-2.5 text-xs">
      <p className="font-semibold text-[#0F1D2E] mb-1.5">
        {formatTooltipMonth(data.month)}
      </p>
      {data.median !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 bg-[#3B82F6] rounded-full inline-block" />
          <span className="text-[#334155]">
            Median:{" "}
            <span className="font-medium">{formatDollar(data.median)}</span>
          </span>
        </div>
      )}
      {data.p25 !== null && data.p75 !== null && (
        <div className="flex items-center gap-2 mb-0.5">
          <span className="w-2.5 h-0.5 bg-[#93C5FD] rounded-full inline-block" />
          <span className="text-[#64748b]">
            P25-P75: {formatDollar(data.p25)} - {formatDollar(data.p75)}
          </span>
        </div>
      )}
      {data.listingCount > 0 && (
        <p className="text-[#94a3b8] mt-1">
          {data.listingCount} listing{data.listingCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}

export function NeighborhoodRentChart({ rents }: NeighborhoodRentChartProps) {
  const availableBeds = useMemo(() => {
    const bedCounts = new Map<number, number>();
    for (const r of rents) {
      bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + 1);
    }
    return Array.from(bedCounts.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([beds, count]) => ({ beds, count }));
  }, [rents]);

  const defaultBed = useMemo(() => {
    if (availableBeds.length === 0) return 1;
    const has1br = availableBeds.find((b) => b.beds === 1);
    if (has1br) return 1;
    return availableBeds.reduce((best, cur) =>
      cur.count > best.count ? cur : best
    ).beds;
  }, [availableBeds]);

  const [selectedBed, setSelectedBed] = useState<number>(defaultBed);

  const chartData = useMemo(() => {
    const filtered = rents.filter((r) => r.beds === selectedBed);
    const sorted = filtered.sort((a, b) => a.month.localeCompare(b.month));

    return sorted.map((r): ChartDataPoint => ({
      month: r.month.slice(0, 7),
      median: r.median_rent ?? null,
      p25: r.p25_rent ?? null,
      p75: r.p75_rent ?? null,
      range:
        r.p25_rent != null && r.p75_rent != null
          ? [r.p25_rent, r.p75_rent]
          : null,
      listingCount: r.listing_count ?? 0,
    }));
  }, [rents, selectedBed]);

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
            Rent Trends
          </h3>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#64748b] py-8">
            No rent trend data available for this neighborhood.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-base font-bold text-[#0F1D2E]">
          Monthly Rent Trends
        </h3>
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
        <p className="text-xs text-[#94a3b8] mt-2">
          Median rent with 25th-75th percentile range
        </p>
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
                stroke="#e2e8f0"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                tickFormatter={(value: string, index: number) =>
                  tickIndices.has(index) ? formatYearTick(value) : ""
                }
                interval={0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                width={52}
                tickFormatter={(value: number) =>
                  `$${value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : value}`
                }
              />
              <Tooltip content={<CustomTooltip />} />
              {/* P25-P75 shaded range */}
              <Area
                type="monotone"
                dataKey="range"
                fill="#3B82F6"
                fillOpacity={0.1}
                stroke="none"
                connectNulls={false}
                isAnimationActive={false}
              />
              {/* Median line */}
              <Line
                type="monotone"
                dataKey="median"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#3B82F6" }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Based on listing data. Shaded area shows 25th-75th percentile range.
        </p>
      </CardContent>
    </Card>
  );
}
