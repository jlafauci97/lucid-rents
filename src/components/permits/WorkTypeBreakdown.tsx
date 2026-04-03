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

interface WorkTypeStat {
  work_type: string;
  active_count: number;
  avg_cost: number;
}

export function WorkTypeBreakdown({ data }: { data: WorkTypeStat[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No work type breakdown data available yet.
      </div>
    );
  }

  // Top 10 work types by active count
  const chartData = data
    .sort((a, b) => b.active_count - a.active_count)
    .slice(0, 10)
    .map((d) => ({
      type: d.work_type.length > 18 ? d.work_type.slice(0, 16) + "..." : d.work_type,
      fullType: d.work_type,
      "Active Permits": d.active_count,
      "Avg Cost": Math.round(d.avg_cost),
    }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <YAxis
          dataKey="type"
          type="category"
          tick={{ fontSize: 11, fill: "#64748b" }}
          width={140}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === "Active Permits"
              ? value.toLocaleString()
              : `$${value.toLocaleString()}`,
            name,
          ]}
          labelFormatter={(label: string, payload) => {
            const item = payload?.[0]?.payload;
            return item?.fullType || label;
          }}
          labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Active Permits" fill="#0D9488" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
