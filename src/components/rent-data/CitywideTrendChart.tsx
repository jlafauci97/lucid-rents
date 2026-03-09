"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface DataPoint {
  date: string;
  avg_rent: number;
}

export function CitywideTrendChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No rent trend data available yet. Run the Zillow sync to populate.
      </div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    }),
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={formatted} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          interval={Math.floor(formatted.length / 8)}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => `$${v.toLocaleString()}`}
          width={70}
        />
        <Tooltip
          formatter={(value: number) => [`$${value.toLocaleString()}`, "Median Rent"]}
          labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Line
          type="monotone"
          dataKey="avg_rent"
          stroke="#3B82F6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#3B82F6" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
