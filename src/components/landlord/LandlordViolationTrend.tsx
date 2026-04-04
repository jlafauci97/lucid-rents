"use client";

import { useEffect, useState } from "react";
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
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface MonthData {
  month: string;
  violations: number;
  complaints: number;
}

interface TrendData {
  months: MonthData[];
  trend: "improving" | "declining" | "stable";
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIndex = parseInt(m, 10) - 1;
  return `${monthNames[monthIndex]} ${year.slice(2)}`;
}

function TrendBadge({ trend }: { trend: "improving" | "declining" | "stable" }) {
  if (trend === "improving") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#dcfce7] text-[#16a34a]">
        <TrendingDown className="w-3.5 h-3.5" />
        Improving
      </span>
    );
  }
  if (trend === "declining") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#fee2e2] text-[#dc2626]">
        <TrendingUp className="w-3.5 h-3.5" />
        Worsening
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#f1f5f9] text-[#64748b]">
      <Minus className="w-3.5 h-3.5" />
      Stable
    </span>
  );
}

export function LandlordViolationTrend({ landlordName }: { landlordName: string }) {
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/landlords/${encodeURIComponent(landlordName)}/trends`)
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [landlordName]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full bg-[#f8fafc] rounded-lg animate-pulse flex items-center justify-center">
            <span className="text-[#94a3b8] text-sm">Loading trend data...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.months.length === 0) return null;

  const hasData = data.months.some((m) => m.violations + m.complaints > 0);
  if (!hasData) return null;

  const chartData = data.months.map((m, i) => ({
    ...m,
    label: formatMonthLabel(m.month),
    showLabel: i % 4 === 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0F1D2E]">Violation & Complaint Trend</h2>
          <TrendBadge trend={data.trend} />
        </div>
        <p className="text-sm text-[#64748b] mt-1">
          Monthly violations and complaints across all properties
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                interval="preserveStartEnd"
                tickFormatter={(value, index) => chartData[index]?.showLabel ? value : ""}
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
                name="Violations"
                stroke="#EF4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#EF4444" }}
              />
              <Line
                type="monotone"
                dataKey="complaints"
                name="Complaints"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#F59E0B" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
