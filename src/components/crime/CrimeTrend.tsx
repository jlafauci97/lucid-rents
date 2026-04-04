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

interface CrimeMonthData {
  month: string;
  violent: number;
  property: number;
  quality_of_life: number;
  total: number;
}

interface CrimeTrendData {
  months: CrimeMonthData[];
  trend: "improving" | "declining" | "stable";
}

interface CrimeTrendProps {
  zipCode: string;
  city: string;
}

function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthIndex = parseInt(m, 10) - 1;
  const shortYear = year.slice(2);
  return `${monthNames[monthIndex]} ${shortYear}`;
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
        Increasing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5F7FA] text-[#5E6687]">
      <Minus className="w-3.5 h-3.5" />
      Stable
    </span>
  );
}

function SkeletonChart() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="h-6 w-48 bg-[#e2e8f0] rounded animate-pulse" />
          <div className="h-6 w-24 bg-[#e2e8f0] rounded-full animate-pulse" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full bg-[#FAFBFD] rounded-lg animate-pulse flex items-center justify-center">
          <div className="text-[#A3ACBE] text-sm">Loading chart data...</div>
        </div>
      </CardContent>
    </Card>
  );
}

export function CrimeTrend({ zipCode, city }: CrimeTrendProps) {
  const [data, setData] = useState<CrimeTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrends() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/crime/${zipCode}/trends?city=${city}`);
        if (!res.ok) {
          throw new Error("Failed to fetch crime trends");
        }
        const json: CrimeTrendData = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchTrends();
  }, [zipCode, city]);

  if (loading) return <SkeletonChart />;

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-[#1A1F36]">Crime Trends</h2>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#5E6687] py-8">
            Unable to load crime trend data. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.months.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-xl font-bold text-[#1A1F36]">Crime Trends</h2>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#5E6687] py-8">
            No crime data available for this zip code.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasAnyData = data.months.some((m) => m.total > 0);

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#1A1F36]">Crime Trends</h2>
            <TrendBadge trend="stable" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-center text-[#5E6687] py-8">
            No crimes recorded in the last 2 years.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.months.map((m, i) => ({
    ...m,
    label: formatMonthLabel(m.month),
    showLabel: i % 4 === 0,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#1A1F36]">Crime Trends</h2>
          <TrendBadge trend={data.trend} />
        </div>
        <p className="text-sm text-[#5E6687] mt-1">
          Monthly crime counts by category over the last 2 years
        </p>
      </CardHeader>
      <CardContent>
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
                dataKey="violent"
                name="Violent"
                stroke="#EF4444"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#EF4444" }}
              />
              <Line
                type="monotone"
                dataKey="property"
                name="Property"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#F59E0B" }}
              />
              <Line
                type="monotone"
                dataKey="quality_of_life"
                name="Quality of Life"
                stroke="#3B82F6"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: "#3B82F6" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
