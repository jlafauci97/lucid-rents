import Link from "next/link";
import { MapPin, Building2, Calendar, Layers, Users, ShieldCheck, AlertTriangle, MessageSquareWarning, Bug, Gavel } from "lucide-react";
import { ScoreGauge } from "@/components/ui/ScoreGauge";
import { LetterGrade } from "@/components/ui/LetterGrade";
import { deriveScore } from "@/lib/constants";
import { CITY_META, type City } from "@/lib/cities";
import { landlordUrl } from "@/lib/seo";
import type { Building } from "@/types";

interface BuildingHeaderProps {
  building: Building;
  city?: City;
  violationCount?: number;
}

export function BuildingHeader({ building, city = "nyc", violationCount }: BuildingHeaderProps) {
  const vCount = violationCount ?? building.violation_count ?? 0;
  const score = building.overall_score ?? deriveScore(
    vCount,
    building.complaint_count || 0
  );

  const meta = [
    building.borough && {
      icon: MapPin,
      text: `${building.borough}, ${CITY_META[city].stateCode} ${building.zip_code}`,
    },
    building.year_built && {
      icon: Calendar,
      text: `Built ${building.year_built}`,
    },
    building.num_floors && {
      icon: Layers,
      text: `${building.num_floors} floor${building.num_floors !== 1 ? "s" : ""}`,
    },
    building.total_units && {
      icon: Building2,
      text: `${building.total_units} unit${building.total_units !== 1 ? "s" : ""}`,
    },
  ].filter(Boolean) as { icon: typeof MapPin; text: string }[];

  const stats = [
    vCount > 0 && {
      icon: AlertTriangle,
      count: vCount,
      label: "violation",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    building.complaint_count > 0 && {
      icon: MessageSquareWarning,
      count: building.complaint_count,
      label: "complaint",
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    building.bedbug_report_count > 0 && {
      icon: Bug,
      count: building.bedbug_report_count,
      label: "bedbug report",
      color: "text-red-600",
      bg: "bg-red-50",
    },
    building.eviction_count > 0 && {
      icon: Gavel,
      count: building.eviction_count,
      label: "eviction",
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ].filter(Boolean) as { icon: typeof AlertTriangle; count: number; label: string; color: string; bg: string }[];

  return (
    <div className="bg-gradient-to-b from-[#f8fafc] to-white border-b border-[#e2e8f0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          {/* Score cluster */}
          <div className="flex items-center gap-3 shrink-0">
            <LetterGrade score={score} size="lg" />
            <ScoreGauge score={score} size="lg" showLabel />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Building name */}
            {building.name && (
              <p className="text-sm font-semibold text-[#3B82F6] tracking-wide mb-0.5">
                {building.name}
              </p>
            )}

            {/* Address */}
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] tracking-tight leading-tight">
              {building.full_address}
            </h1>

            {/* Meta details */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              {meta.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 text-sm text-[#64748b]"
                >
                  <Icon className="w-3.5 h-3.5 text-[#94a3b8]" />
                  {text}
                </span>
              ))}
            </div>

            {/* Stats + badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Issue stats as compact chips */}
              {stats.map(({ icon: Icon, count, label, color, bg }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color} ${bg}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {count.toLocaleString()} {label}{count !== 1 ? "s" : ""}
                </span>
              ))}

              {building.review_count > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50">
                  <Users className="w-3.5 h-3.5" />
                  {building.review_count} review{building.review_count !== 1 ? "s" : ""}
                </span>
              )}

              {building.is_rent_stabilized && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Rent Stabilized
                </span>
              )}

              {building.owner_name && (
                <Link
                  href={landlordUrl(building.owner_name)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[#475569] bg-[#f1f5f9] hover:bg-[#e2e8f0] transition-colors"
                >
                  Owner: {building.owner_name}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
