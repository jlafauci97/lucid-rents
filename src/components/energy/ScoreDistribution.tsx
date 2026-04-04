"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

interface BucketRow {
  bucket: string;
  count: number;
}

// Color by score bucket
function bucketColor(bucket: string): string {
  if (bucket.startsWith("9")) return "#059669";
  if (bucket.startsWith("8")) return "#10b981";
  if (bucket.startsWith("7")) return "#34d399";
  if (bucket.startsWith("6")) return "#6ee7b7";
  if (bucket.startsWith("5")) return "#fbbf24";
  if (bucket.startsWith("4")) return "#f59e0b";
  if (bucket.startsWith("3")) return "#f97316";
  if (bucket.startsWith("2")) return "#ef4444";
  if (bucket.startsWith("1") && bucket.includes("-19")) return "#dc2626";
  return "#b91c1c";
}

export function ScoreDistribution({ data }: { data: BucketRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-[#94a3b8]">
        No score distribution data available yet.
      </div>
    );
  }

  // Sort buckets from low to high
  const sorted = [...data].sort((a, b) => {
    const aNum = parseInt(a.bucket.split("-")[0]);
    const bNum = parseInt(b.bucket.split("-")[0]);
    return aNum - bNum;
  });

  const chartData = sorted.map((d) => ({
    bucket: d.bucket,
    Buildings: d.count,
    fill: bucketColor(d.bucket),
  }));

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="bucket"
          tick={{ fontSize: 11, fill: "#64748b" }}
          label={{ value: "ENERGY STAR Score", position: "insideBottom", offset: -5, fill: "#94a3b8", fontSize: 11 }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickFormatter={(v: number) => v.toLocaleString()}
        />
        <Tooltip
          formatter={(value: number) => [value.toLocaleString(), "Buildings"]}
          labelFormatter={(label: string) => `Score: ${label}`}
          labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="Buildings" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
