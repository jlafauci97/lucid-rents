"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

interface BoroughStat {
  borough: string;
  active_count: number;
  avg_days_up: number;
}

const BOROUGH_NAME: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  BRONX: "Bronx",
  "STATEN ISLAND": "Staten Island",
};

export function BoroughBreakdown({ data }: { data: BoroughStat[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No borough breakdown data available yet.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    borough: BOROUGH_NAME[d.borough?.toUpperCase()] || d.borough,
    "Active Sheds": d.active_count,
    "Avg Days Up": d.avg_days_up,
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="borough"
          tick={{ fontSize: 11, fill: "#64748b" }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => v.toLocaleString()}
          width={55}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => `${v}d`}
          width={50}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === "Active Sheds"
              ? value.toLocaleString()
              : `${value} days`,
            name,
          ]}
          labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar yAxisId="left" dataKey="Active Sheds" fill="#F59E0B" radius={[4, 4, 0, 0]} />
        <Bar yAxisId="right" dataKey="Avg Days Up" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
