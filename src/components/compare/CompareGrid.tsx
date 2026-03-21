import Link from "next/link";
import {
  MapPin,
  Building2,
  Calendar,
  Layers,
  User,
  AlertTriangle,
  MessageSquare,
  Star,
  Bug,
  Scale,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { buildingUrl, landlordUrl } from "@/lib/seo";
import type { Building } from "@/types";

interface CompareGridProps {
  buildings: Building[];
}

type CompareRowConfig = {
  label: string;
  icon: React.ReactNode;
  getValue: (b: Building) => React.ReactNode;
  highlight?: "higher-is-better" | "lower-is-better";
  getNumericValue?: (b: Building) => number | null;
};

function getHighlightClass(
  value: number | null,
  allValues: (number | null)[],
  mode: "higher-is-better" | "lower-is-better"
): string {
  if (value === null) return "";
  const validValues = allValues.filter((v): v is number => v !== null);
  if (validValues.length < 2) return "";

  const best =
    mode === "higher-is-better"
      ? Math.max(...validValues)
      : Math.min(...validValues);
  const worst =
    mode === "higher-is-better"
      ? Math.min(...validValues)
      : Math.max(...validValues);

  if (value === best && best !== worst) return "bg-emerald-50 text-emerald-700";
  if (value === worst && best !== worst) return "bg-red-50 text-red-700";
  return "";
}

export function CompareGrid({ buildings }: CompareGridProps) {
  const rows: CompareRowConfig[] = [
    {
      label: "Address",
      icon: <MapPin className="w-4 h-4" />,
      getValue: (b) => (
        <Link
          href={buildingUrl(b)}
          className="text-[#3B82F6] hover:text-[#2563EB] hover:underline font-medium text-sm leading-tight"
        >
          {b.full_address}
        </Link>
      ),
    },
    {
      label: "Borough",
      icon: <MapPin className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm text-[#0F1D2E]">{b.borough}</span>
      ),
    },
    {
      label: "Score",
      icon: <Star className="w-4 h-4" />,
      getValue: (b) => <ScoreGauge score={b.overall_score} size="sm" showLabel />,
      highlight: "higher-is-better",
      getNumericValue: (b) => b.overall_score,
    },
    {
      label: "Year Built",
      icon: <Calendar className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm text-[#0F1D2E]">
          {b.year_built ?? "Unknown"}
        </span>
      ),
    },
    {
      label: "Floors",
      icon: <Layers className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm text-[#0F1D2E]">
          {b.num_floors ?? "Unknown"}
        </span>
      ),
    },
    {
      label: "Total Units",
      icon: <Building2 className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm text-[#0F1D2E]">
          {b.total_units ?? "Unknown"}
        </span>
      ),
    },
    {
      label: "Owner",
      icon: <User className="w-4 h-4" />,
      getValue: (b) =>
        b.owner_name ? (
          <Link
            href={landlordUrl(b.owner_name)}
            className="text-[#3B82F6] hover:text-[#2563EB] hover:underline text-sm"
          >
            {b.owner_name}
          </Link>
        ) : (
          <span className="text-sm text-[#94a3b8]">Unknown</span>
        ),
    },
    {
      label: "Violations",
      icon: <AlertTriangle className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm font-semibold">{b.violation_count}</span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (b) => b.violation_count,
    },
    {
      label: "Complaints",
      icon: <MessageSquare className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm font-semibold">{b.complaint_count}</span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (b) => b.complaint_count,
    },
    {
      label: "Bedbug Reports",
      icon: <Bug className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm font-semibold">{b.bedbug_report_count || 0}</span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (b) => b.bedbug_report_count || 0,
    },
    {
      label: "Evictions",
      icon: <Scale className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm font-semibold">{b.eviction_count || 0}</span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (b) => b.eviction_count || 0,
    },
    {
      label: "Rent Stabilized",
      icon: <ShieldCheck className="w-4 h-4" />,
      getValue: (b) => (
        <span className={`text-sm font-medium ${b.is_rent_stabilized ? "text-emerald-600" : "text-[#94a3b8]"}`}>
          {b.is_rent_stabilized ? `Yes${b.stabilized_units ? ` (${b.stabilized_units} units)` : ""}` : "No"}
        </span>
      ),
    },
    {
      label: "Reviews",
      icon: <Star className="w-4 h-4" />,
      getValue: (b) => (
        <span className="text-sm text-[#0F1D2E]">{b.review_count}</span>
      ),
      highlight: "higher-is-better",
      getNumericValue: (b) => b.review_count,
    },
  ];

  const colCount = buildings.length;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row with building addresses */}
        <div
          className="grid gap-4 mb-2"
          style={{
            gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
          }}
        >
          <div />
          {buildings.map((b) => (
            <div
              key={b.id}
              className="bg-[#0F1D2E] rounded-t-xl px-4 py-3 text-center"
            >
              <Link
                href={buildingUrl(b)}
                className="text-white font-semibold text-sm hover:text-[#3B82F6] transition-colors leading-tight block"
              >
                {b.full_address}
              </Link>
              <p className="text-gray-400 text-xs mt-1">{b.borough}</p>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {rows.map((row, idx) => {
          const numericValues = row.getNumericValue
            ? buildings.map((b) => row.getNumericValue!(b))
            : null;

          return (
            <div
              key={row.label}
              className={`grid gap-4 items-center ${
                idx % 2 === 0 ? "bg-gray-50" : "bg-white"
              }`}
              style={{
                gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
              }}
            >
              {/* Row label */}
              <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#64748b]">
                {row.icon}
                {row.label}
              </div>

              {/* Building values */}
              {buildings.map((b, bIdx) => {
                const highlightClass =
                  row.highlight && numericValues
                    ? getHighlightClass(
                        numericValues[bIdx],
                        numericValues,
                        row.highlight
                      )
                    : "";

                return (
                  <div
                    key={b.id}
                    className={`px-4 py-3 text-center ${highlightClass} rounded`}
                  >
                    {row.getValue(b)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
