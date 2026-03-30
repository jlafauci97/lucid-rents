import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  AlertTriangle,
  Bug,
  DollarSign,
  Shield,
  ShieldCheck,
  ShieldX,
  Activity,
  Gavel,
  MessageSquareWarning,
} from "lucide-react";
import type { Building } from "@/types";

interface QuickSummaryProps {
  building: Building;
  rents: { bedrooms: number; min_rent: number; max_rent: number }[];
  violationCount: number;
  complaintCount: number;
  bedbugCount: number;
  evictionCount: number;
}

function getWorstIssue(counts: {
  violations: number;
  complaints: number;
  bedbugs: number;
  evictions: number;
}) {
  const issues = [
    {
      label: "Violations",
      count: counts.violations,
      icon: AlertTriangle,
      weight: 1,
    },
    {
      label: "Complaints",
      count: counts.complaints,
      icon: MessageSquareWarning,
      weight: 0.8,
    },
    {
      label: "Bed Bugs",
      count: counts.bedbugs,
      icon: Bug,
      weight: 3,
    },
    {
      label: "Evictions",
      count: counts.evictions,
      icon: Gavel,
      weight: 5,
    },
  ];

  // Score each by count * weight to find the most concerning
  const scored = issues
    .filter((i) => i.count > 0)
    .sort((a, b) => b.count * b.weight - a.count * a.weight);

  if (scored.length === 0) {
    return {
      label: "No Issues",
      count: 0,
      icon: ShieldCheck,
      severity: "low" as const,
    };
  }

  const worst = scored[0];
  const score = worst.count * worst.weight;
  const severity = score >= 50 ? ("high" as const) : score >= 10 ? ("medium" as const) : ("low" as const);

  return { ...worst, severity };
}

function getRentRange(rents: { min_rent: number; max_rent: number }[]) {
  if (!rents || rents.length === 0) return null;

  const allMins = rents.map((r) => r.min_rent).filter((v) => v > 0);
  const allMaxes = rents.map((r) => r.max_rent).filter((v) => v > 0);

  if (allMins.length === 0 && allMaxes.length === 0) return null;

  const min = allMins.length > 0 ? Math.min(...allMins) : null;
  const max = allMaxes.length > 0 ? Math.max(...allMaxes) : null;

  if (min && max && min !== max) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}/mo`;
  }
  if (min) return `$${min.toLocaleString()}/mo`;
  if (max) return `$${max.toLocaleString()}/mo`;
  return null;
}

function getNeighborhoodConcern(violationCount: number, complaintCount: number, residentialUnits: number | null) {
  const units = residentialUnits || 1;
  const density = (violationCount + complaintCount) / units;

  if (density >= 5) return { level: "High", variant: "danger" as const };
  if (density >= 2) return { level: "Medium", variant: "warning" as const };
  return { level: "Low", variant: "success" as const };
}

const severityColors = {
  high: { bg: "bg-red-50", text: "text-red-700", icon: "text-red-500" },
  medium: { bg: "bg-amber-50", text: "text-amber-700", icon: "text-amber-500" },
  low: { bg: "bg-emerald-50", text: "text-emerald-700", icon: "text-emerald-500" },
};

export function QuickSummary({
  building,
  rents,
  violationCount,
  complaintCount,
  bedbugCount,
  evictionCount,
}: QuickSummaryProps) {
  const worstIssue = getWorstIssue({
    violations: violationCount,
    complaints: complaintCount,
    bedbugs: bedbugCount,
    evictions: evictionCount,
  });

  const rentRange = getRentRange(rents);
  const isStabilized = building.is_rent_stabilized;
  const concern = getNeighborhoodConcern(violationCount, complaintCount, building.residential_units);
  const colors = severityColors[worstIssue.severity];
  const WorstIcon = worstIssue.icon;

  return (
    <Card>
      <CardContent className="py-5">
        <h3 className="text-sm font-semibold text-[#0F1D2E] mb-4 uppercase tracking-wide">
          Quick Summary
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Worst Issue */}
          <div className={`rounded-lg p-3 ${colors.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <WorstIcon className={`w-4 h-4 ${colors.icon}`} />
              <span className="text-xs font-medium text-[#64748b]">
                Top Concern
              </span>
            </div>
            <p className={`text-sm font-semibold ${colors.text}`}>
              {worstIssue.label}
            </p>
            {worstIssue.count > 0 && (
              <p className={`text-xs ${colors.text} opacity-80`}>
                {worstIssue.count.toLocaleString()} recorded
              </p>
            )}
          </div>

          {/* Rent Range */}
          <div className="rounded-lg p-3 bg-blue-50">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-medium text-[#64748b]">
                Rent Range
              </span>
            </div>
            <p className="text-sm font-semibold text-blue-700">
              {rentRange || "No rent data"}
            </p>
          </div>

          {/* Rent Stabilized */}
          <div
            className={`rounded-lg p-3 ${
              isStabilized ? "bg-emerald-50" : "bg-gray-50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              {isStabilized ? (
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
              ) : (
                <ShieldX className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-xs font-medium text-[#64748b]">
                Rent Stabilized
              </span>
            </div>
            <p
              className={`text-sm font-semibold ${
                isStabilized ? "text-emerald-700" : "text-gray-500"
              }`}
            >
              {isStabilized ? "Yes" : "No"}
            </p>
          </div>

          {/* Issue Density */}
          <div className="rounded-lg p-3 bg-gray-50">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-4 h-4 text-[#64748b]" />
              <span className="text-xs font-medium text-[#64748b]">
                Issue Density
              </span>
            </div>
            <Badge variant={concern.variant}>{concern.level}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
