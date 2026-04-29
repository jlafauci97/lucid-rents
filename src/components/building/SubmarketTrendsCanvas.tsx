"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";

interface ChartRow {
  quarter: string;
  label: string;
  asking: number | null;
  effective: number | null;
  studio: number | null;
  br1: number | null;
  br2: number | null;
  br3: number | null;
}

interface Props {
  chartData: ChartRow[];
  beds: "all" | "studio" | "1br" | "2br" | "3br";
  latestQuarter: string;
  buildingCurrentRent?: number | null;
}

function fmtDollar(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString()}`;
}

function quarterLabelLong(q: string): string {
  const d = new Date(q + "T00:00:00Z");
  const y = d.getUTCFullYear();
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${quarter} ${y}`;
}

export default function SubmarketTrendsCanvas({
  chartData,
  beds,
  latestQuarter,
  buildingCurrentRent,
}: Props) {
  const isForecastQuarter = (q: string) => q === latestQuarter;

  return (
    <div style={{ height: 320, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="#f1f5f9" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickMargin={6}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
            width={48}
            domain={["dataMin - 100", "dataMax + 100"]}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
            formatter={(v: number, name: string) => [fmtDollar(v), name]}
            labelFormatter={(l, payload) => {
              const q = payload?.[0]?.payload?.quarter;
              return q ? quarterLabelLong(q) : l;
            }}
          />
          <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
          {chartData.some((d) => isForecastQuarter(d.quarter)) && (
            <ReferenceLine
              x={chartData.find((d) => isForecastQuarter(d.quarter))?.label}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={{
                value: "forecast",
                position: "insideTopRight",
                fontSize: 10,
                fill: "#64748b",
              }}
            />
          )}
          {buildingCurrentRent != null && buildingCurrentRent > 0 && (
            <ReferenceLine
              y={buildingCurrentRent}
              stroke="#0891b2"
              strokeDasharray="3 3"
              label={{
                value: `This building ${fmtDollar(buildingCurrentRent)}`,
                position: "insideBottomRight",
                fontSize: 11,
                fill: "#0e7490",
              }}
            />
          )}
          {beds === "all" && (
            <Line
              key="studio"
              type="monotone"
              dataKey="studio"
              name="Studio"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {beds === "all" && (
            <Line
              key="br1"
              type="monotone"
              dataKey="br1"
              name="1 BR"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {beds === "all" && (
            <Line
              key="br2"
              type="monotone"
              dataKey="br2"
              name="2 BR"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {beds === "all" && (
            <Line
              key="br3"
              type="monotone"
              dataKey="br3"
              name="3 BR"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
            />
          )}
          {beds !== "all" && (
            <Line
              key="asking"
              type="monotone"
              dataKey="asking"
              name="Asking"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
          {beds !== "all" && (
            <Line
              key="effective"
              type="monotone"
              dataKey="effective"
              name="Effective (paid)"
              stroke="#14b8a6"
              strokeWidth={2}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
