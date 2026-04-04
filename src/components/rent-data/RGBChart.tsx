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
import { RGB_RATES } from "@/lib/rgb-data";

export function RGBChart() {
  const data = [...RGB_RATES].reverse();

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-4">
        The NYC Rent Guidelines Board (RGB) sets maximum annual rent increases
        for rent-stabilized apartments. These rates apply to lease renewals — a
        0% increase means stabilized tenants pay the same rent upon renewal.
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="year"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            interval={1}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(v: number) => `${v}%`}
            width={40}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              `${value}%`,
              name === "oneYear" ? "1-Year Lease" : "2-Year Lease",
            ]}
            labelStyle={{ color: "#0F1D2E", fontWeight: 600 }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
          />
          <Legend
            formatter={(value: string) =>
              value === "oneYear" ? "1-Year Lease" : "2-Year Lease"
            }
            wrapperStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="oneYear" fill="#3B82F6" radius={[2, 2, 0, 0]} />
          <Bar dataKey="twoYear" fill="#8B5CF6" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
