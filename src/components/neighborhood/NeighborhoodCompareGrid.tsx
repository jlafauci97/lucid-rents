import Link from "next/link";
import {
  MapPin,
  Building2,
  AlertTriangle,
  MessageSquare,
  Star,
  Siren,
  Users,
  Scale,
  Wrench,
} from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { neighborhoodUrl, landlordUrl } from "@/lib/seo";
import type { City } from "@/lib/cities";

interface NeighborhoodStats {
  building_count: number;
  avg_score: number | null;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  buildings_with_reviews: number;
  total_reviews: number;
  top_landlord: string | null;
  top_landlord_buildings: number;
}

interface CrimeZipRow {
  zip_code: string;
  borough: string;
  total: number;
  violent: number;
  property: number;
  quality_of_life: number;
}

interface MedianRentRow {
  zip_code: string;
  bedrooms: number;
  median_rent: number;
}

export interface NeighborhoodCompareData {
  zipCode: string;
  name: string;
  region: string;
  stats: NeighborhoodStats;
  crime: CrimeZipRow | null;
  medianRents: MedianRentRow[];
}

interface NeighborhoodCompareGridProps {
  neighborhoods: NeighborhoodCompareData[];
  city: City;
}

type CompareRowConfig = {
  label: string;
  icon: React.ReactNode;
  getValue: (n: NeighborhoodCompareData) => React.ReactNode;
  highlight?: "higher-is-better" | "lower-is-better";
  getNumericValue?: (n: NeighborhoodCompareData) => number | null;
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

  if (value === best && best !== worst)
    return "bg-emerald-50 text-emerald-700";
  if (value === worst && best !== worst) return "bg-red-50 text-red-700";
  return "";
}

function formatRent(value: number | undefined | null): string {
  if (!value) return "N/A";
  return `$${Math.round(value).toLocaleString()}`;
}

function getMedianRent(
  rents: MedianRentRow[],
  bedrooms: number
): number | null {
  const row = rents.find((r) => r.bedrooms === bedrooms);
  return row?.median_rent ?? null;
}

export function NeighborhoodCompareGrid({
  neighborhoods,
  city,
}: NeighborhoodCompareGridProps) {
  const rows: CompareRowConfig[] = [
    {
      label: "Region",
      icon: <MapPin className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm text-[#0F1D2E]">{n.region || "—"}</span>
      ),
    },
    {
      label: "Avg. Score",
      icon: <Star className="w-4 h-4" />,
      getValue: (n) =>
        n.stats.avg_score !== null ? (
          <LetterGrade score={Number(n.stats.avg_score)} size="sm" showScore />
        ) : (
          <span className="text-sm text-[#94a3b8]">No data</span>
        ),
      highlight: "higher-is-better",
      getNumericValue: (n) =>
        n.stats.avg_score !== null ? Number(n.stats.avg_score) : null,
    },
    {
      label: "Buildings",
      icon: <Building2 className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold text-[#0F1D2E]">
          {Number(n.stats.building_count).toLocaleString()}
        </span>
      ),
    },
    {
      label: "Violations",
      icon: <AlertTriangle className="w-4 h-4" />,
      getValue: (n) => (
        <div>
          <span className="text-sm font-semibold">
            {Number(n.stats.total_violations).toLocaleString()}
          </span>
          <span className="text-xs text-[#94a3b8] block">
            {Number(n.stats.building_count) > 0
              ? `${(Number(n.stats.total_violations) / Number(n.stats.building_count)).toFixed(1)}/bldg`
              : ""}
          </span>
        </div>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) =>
        Number(n.stats.building_count) > 0
          ? Number(n.stats.total_violations) / Number(n.stats.building_count)
          : null,
    },
    {
      label: "Complaints",
      icon: <MessageSquare className="w-4 h-4" />,
      getValue: (n) => (
        <div>
          <span className="text-sm font-semibold">
            {Number(n.stats.total_complaints).toLocaleString()}
          </span>
          <span className="text-xs text-[#94a3b8] block">
            {Number(n.stats.building_count) > 0
              ? `${(Number(n.stats.total_complaints) / Number(n.stats.building_count)).toFixed(1)}/bldg`
              : ""}
          </span>
        </div>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) =>
        Number(n.stats.building_count) > 0
          ? Number(n.stats.total_complaints) / Number(n.stats.building_count)
          : null,
    },
    {
      label: "Litigations",
      icon: <Scale className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold">
          {Number(n.stats.total_litigations).toLocaleString()}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => Number(n.stats.total_litigations),
    },
    {
      label: "Reviews",
      icon: <Users className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm text-[#0F1D2E]">
          {Number(n.stats.total_reviews).toLocaleString()}
        </span>
      ),
      highlight: "higher-is-better",
      getNumericValue: (n) => Number(n.stats.total_reviews),
    },
    {
      label: "Top Landlord",
      icon: <Users className="w-4 h-4" />,
      getValue: (n) =>
        n.stats.top_landlord ? (
          <Link
            href={landlordUrl(n.stats.top_landlord)}
            className="text-[#3B82F6] hover:underline text-sm"
          >
            {n.stats.top_landlord}
            <span className="text-xs text-[#94a3b8] block">
              {Number(n.stats.top_landlord_buildings)} buildings
            </span>
          </Link>
        ) : (
          <span className="text-sm text-[#94a3b8]">—</span>
        ),
    },
    {
      label: "Total Crime",
      icon: <Siren className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold">
          {n.crime ? n.crime.total.toLocaleString() : "No data"}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => (n.crime ? n.crime.total : null),
    },
    {
      label: "Violent Crime",
      icon: <Siren className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold text-[#EF4444]">
          {n.crime ? n.crime.violent.toLocaleString() : "—"}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => (n.crime ? n.crime.violent : null),
    },
    {
      label: "Property Crime",
      icon: <Siren className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold text-[#F59E0B]">
          {n.crime ? n.crime.property.toLocaleString() : "—"}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => (n.crime ? n.crime.property : null),
    },
    {
      label: "Studio Rent",
      icon: <Wrench className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold">
          {formatRent(getMedianRent(n.medianRents, 0))}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => getMedianRent(n.medianRents, 0),
    },
    {
      label: "1BR Rent",
      icon: <Wrench className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold">
          {formatRent(getMedianRent(n.medianRents, 1))}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => getMedianRent(n.medianRents, 1),
    },
    {
      label: "2BR Rent",
      icon: <Wrench className="w-4 h-4" />,
      getValue: (n) => (
        <span className="text-sm font-semibold">
          {formatRent(getMedianRent(n.medianRents, 2))}
        </span>
      ),
      highlight: "lower-is-better",
      getNumericValue: (n) => getMedianRent(n.medianRents, 2),
    },
  ];

  const colCount = neighborhoods.length;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Header row */}
        <div
          className="grid gap-4 mb-2"
          style={{
            gridTemplateColumns: `180px repeat(${colCount}, 1fr)`,
          }}
        >
          <div />
          {neighborhoods.map((n) => (
            <div
              key={n.zipCode}
              className="bg-[#0F1D2E] rounded-t-xl px-4 py-3 text-center"
            >
              <Link
                href={neighborhoodUrl(n.zipCode, city)}
                className="text-white font-semibold text-sm hover:text-[#3B82F6] transition-colors leading-tight block"
              >
                {n.name}
              </Link>
              <p className="text-gray-400 text-xs mt-1">
                {n.zipCode}
                {n.region && ` · ${n.region}`}
              </p>
            </div>
          ))}
        </div>

        {/* Data rows */}
        {rows.map((row, idx) => {
          const numericValues = row.getNumericValue
            ? neighborhoods.map((n) => row.getNumericValue!(n))
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
              <div className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#64748b]">
                {row.icon}
                {row.label}
              </div>

              {neighborhoods.map((n, nIdx) => {
                const highlightClass =
                  row.highlight && numericValues
                    ? getHighlightClass(
                        numericValues[nIdx],
                        numericValues,
                        row.highlight
                      )
                    : "";

                return (
                  <div
                    key={n.zipCode}
                    className={`px-4 py-3 text-center ${highlightClass} rounded`}
                  >
                    {row.getValue(n)}
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
