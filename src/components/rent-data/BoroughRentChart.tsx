"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { City } from "@/lib/cities";

interface DataPoint {
  borough: string;
  date: string;
  avg_rent: number;
}

const NYC_COLORS: Record<string, string> = {
  Manhattan: "#3B82F6",
  Brooklyn: "#8B5CF6",
  Queens: "#10B981",
  Bronx: "#F59E0B",
  "Staten Island": "#64748B",
};

/** Palette for LA areas — auto-assigned from a pool of distinguishable colors */
const COLOR_POOL = [
  "#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444",
  "#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16",
  "#06B6D4", "#A855F7", "#64748B", "#E11D48", "#0EA5E9",
];

export function BoroughRentChart({ data, city = "nyc" }: { data: DataPoint[]; city?: City }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No area rent data available yet.
      </div>
    );
  }

  // Normalize borough/area names to title case
  const normalizeName = (b: string | null) => {
    if (!b) return "Unknown";
    if (b === "STATEN ISLAND") return "Staten Island";
    // Handle multi-word names like "NORTH HOLLYWOOD" → "North Hollywood"
    return b
      .split(/[\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(b.includes("-") ? "-" : " ");
  };

  // Filter out "Unknown" entries from the chart — they add noise without value
  const filteredData = data.filter((d) => d.borough !== null && d.borough !== "");

  // Pivot: group by date, with one column per borough/area
  const dateMap = new Map<string, Record<string, number | string>>();
  const areaSet = new Set<string>();
  for (const d of filteredData) {
    const name = normalizeName(d.borough);
    areaSet.add(name);
    if (!dateMap.has(d.date)) {
      dateMap.set(d.date, {
        date: d.date,
        label: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
      });
    }
    dateMap.get(d.date)![name] = d.avg_rent;
  }

  const chartData = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  );

  // Determine areas and their colors
  const areas = Array.from(areaSet).sort();
  const colorMap: Record<string, string> =
    city === "nyc"
      ? NYC_COLORS
      : Object.fromEntries(areas.map((a, i) => [a, COLOR_POOL[i % COLOR_POOL.length]]));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          interval={Math.floor(chartData.length / 8)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          width={70}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `$${value?.toLocaleString() ?? "—"}`,
            name,
          ]}
          labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="line"
        />
        {areas.map((a) => (
          <Line
            key={a}
            type="monotone"
            dataKey={a}
            stroke={colorMap[a] || "#94a3b8"}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
