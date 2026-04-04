"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";

interface CrimeSummary {
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
  felonies: number;
  misdemeanors: number;
  violations: number;
}

interface CrimeCategoryBreakdownProps {
  summary: CrimeSummary;
}

const CATEGORY_DATA = [
  { key: "violent", label: "Violent", color: "#EF4444" },
  { key: "property", label: "Property", color: "#F59E0B" },
  { key: "quality_of_life", label: "Quality of Life", color: "#3B82F6" },
] as const;

const SEVERITY_DATA = [
  { key: "felonies", label: "Felonies", color: "#DC2626" },
  { key: "misdemeanors", label: "Misdemeanors", color: "#EA580C" },
  { key: "violations", label: "Violations", color: "#CA8A04" },
] as const;

export function CrimeCategoryBreakdown({ summary }: CrimeCategoryBreakdownProps) {
  const categoryChartData = CATEGORY_DATA.map((c) => ({
    name: c.label,
    count: Number(summary[c.key]) || 0,
    color: c.color,
  }));

  const severityChartData = SEVERITY_DATA.map((s) => ({
    name: s.label,
    count: Number(summary[s.key]) || 0,
    color: s.color,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold text-[#1A1F36]">By Category</h3>
          <p className="text-sm text-[#5E6687]">Crime type breakdown (12 months)</p>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={categoryChartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value) => [Number(value).toLocaleString(), "Incidents"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {categoryChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="text-lg font-bold text-[#1A1F36]">By Severity</h3>
          <p className="text-sm text-[#5E6687]">Legal classification breakdown (12 months)</p>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={severityChartData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={{ stroke: "#e2e8f0" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={44}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    fontSize: "13px",
                    boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  }}
                  formatter={(value) => [Number(value).toLocaleString(), "Incidents"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {severityChartData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
