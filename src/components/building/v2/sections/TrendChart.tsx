"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendRow {
  month: string;
  hpd: number;
  dob: number;
  complaints: number;
  evictions: number;
}

interface Props {
  data: TrendRow[];
}

function formatMonth(m: string): string {
  try {
    const [year, month] = m.split("-");
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  } catch {
    return m;
  }
}

export function TrendChart({ data }: Props) {
  const formatted = data.map((row) => ({
    ...row,
    label: formatMonth(row.month),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart
        data={formatted}
        margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="gradHpd" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradDob" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradComplaints" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="gradEvictions" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="label"
          tick={{ fontFamily: "var(--v2-mono, monospace)", fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontFamily: "var(--v2-mono, monospace)", fontSize: 10, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            fontFamily: "var(--v2-sans, system-ui)",
            fontSize: 12,
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          }}
          labelStyle={{ fontFamily: "var(--v2-mono, monospace)", fontSize: 11, color: "#64748b" }}
          itemStyle={{ color: "#0F1D2E" }}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{
            fontFamily: "var(--v2-mono, monospace)",
            fontSize: 11,
            paddingTop: 8,
          }}
        />

        <Area
          type="monotone"
          dataKey="hpd"
          name="HPD"
          stroke="#ef4444"
          strokeWidth={2}
          fill="url(#gradHpd)"
        />
        <Area
          type="monotone"
          dataKey="dob"
          name="DOB"
          stroke="#f59e0b"
          strokeWidth={2}
          fill="url(#gradDob)"
        />
        <Area
          type="monotone"
          dataKey="complaints"
          name="311"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#gradComplaints)"
        />
        <Area
          type="monotone"
          dataKey="evictions"
          name="Evictions"
          stroke="#94a3b8"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          fill="url(#gradEvictions)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
