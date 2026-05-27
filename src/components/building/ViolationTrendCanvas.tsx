"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface ChartRow {
  month: string;
  violations: number;
  complaints: number;
  label: string;
  showLabel: boolean;
}

interface Props {
  chartData: ChartRow[];
  housingAgency: string;
}

export default function ViolationTrendCanvas({
  chartData,
  housingAgency,
}: Props) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e2e8f0"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
            interval="preserveStartEnd"
            tickFormatter={(value, index) =>
              chartData[index]?.showLabel ? value : ""
            }
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              fontSize: "13px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{ fontWeight: 600, color: "#0F1D2E" }}
          />
          <Legend
            wrapperStyle={{ fontSize: "13px", paddingTop: "12px" }}
            iconType="circle"
            iconSize={8}
          />
          <Line
            type="monotone"
            dataKey="violations"
            name={`${housingAgency} Violations`}
            stroke="#EF4444"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#EF4444" }}
          />
          <Line
            type="monotone"
            dataKey="complaints"
            name="311 Complaints"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0, fill: "#F59E0B" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
