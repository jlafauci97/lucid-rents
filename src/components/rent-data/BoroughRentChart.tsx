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

interface DataPoint {
  borough: string;
  date: string;
  avg_rent: number;
}

const BOROUGH_COLORS: Record<string, string> = {
  Manhattan: "#3B82F6",
  Brooklyn: "#8B5CF6",
  Queens: "#10B981",
  Bronx: "#F59E0B",
  "Staten Island": "#64748B",
};

export function BoroughRentChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No borough rent data available yet.
      </div>
    );
  }

  // Normalize borough names to title case for chart keys
  const normalizeBorough = (b: string) =>
    b === "STATEN ISLAND"
      ? "Staten Island"
      : b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();

  // Pivot: group by date, with one column per borough
  const dateMap = new Map<string, Record<string, number | string>>();
  for (const d of data) {
    if (!dateMap.has(d.date)) {
      dateMap.set(d.date, {
        date: d.date,
        label: new Date(d.date).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        }),
      });
    }
    dateMap.get(d.date)![normalizeBorough(d.borough)] = d.avg_rent;
  }

  const chartData = Array.from(dateMap.values()).sort(
    (a, b) => new Date(a.date as string).getTime() - new Date(b.date as string).getTime()
  );

  const boroughs = Object.keys(BOROUGH_COLORS);

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
        {boroughs.map((b) => (
          <Line
            key={b}
            type="monotone"
            dataKey={b}
            stroke={BOROUGH_COLORS[b]}
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
