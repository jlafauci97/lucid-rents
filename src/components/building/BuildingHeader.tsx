import Link from "next/link";
import { MapPin, Building2, Calendar, Layers, Users, ShieldCheck, AlertTriangle, MessageSquareWarning, Bug, Gavel } from "lucide-react";
import { getLetterGrade, deriveScore } from "@/lib/constants";
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
  const grade = getLetterGrade(score);

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
      colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
    },
    building.complaint_count > 0 && {
      icon: MessageSquareWarning,
      count: building.complaint_count,
      label: "complaint",
      colorClass: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
    building.bedbug_report_count > 0 && {
      icon: Bug,
      count: building.bedbug_report_count,
      label: "bedbug report",
      colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
    },
    building.eviction_count > 0 && {
      icon: Gavel,
      count: building.eviction_count,
      label: "eviction",
      colorClass: "text-red-400 bg-red-500/10 border-red-500/20",
    },
  ].filter(Boolean) as { icon: typeof AlertTriangle; count: number; label: string; colorClass: string }[];

  return (
    <div className="bg-[#0F1D2E]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-5">
          {/* Score shield */}
          <div className="shrink-0">
            <div
              className="w-16 h-16 rounded-2xl bg-[#3B82F6] flex flex-col items-center justify-center"
              style={{ boxShadow: "0 8px 25px rgba(59,130,246,0.25)" }}
            >
              <span className="text-2xl font-bold text-white">{grade}</span>
              <span className="text-[10px] font-semibold text-white/75 -mt-0.5">
                {score.toFixed(1)}
              </span>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Building name */}
            {building.name && (
              <p className="text-xs font-semibold text-[#60a5fa] uppercase tracking-widest mb-1">
                {building.name}
              </p>
            )}

            {/* Address */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
              {building.full_address}
            </h1>

            {/* Meta details — white text */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
              {meta.map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 text-sm text-white/70"
                >
                  <Icon className="w-3.5 h-3.5 text-white/50" />
                  {text}
                </span>
              ))}
            </div>

            {/* Stats + badges row */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {stats.map(({ icon: Icon, count, label, colorClass }) => (
                <span
                  key={label}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${colorClass}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {count.toLocaleString()} {label}{count !== 1 ? "s" : ""}
                </span>
              ))}

              {building.review_count > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20">
                  <Users className="w-3.5 h-3.5" />
                  {building.review_count} review{building.review_count !== 1 ? "s" : ""}
                </span>
              )}

              {building.is_rent_stabilized && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Rent Stabilized
                </span>
              )}

              {building.owner_name && (
                <Link
                  href={landlordUrl(building.owner_name)}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-[#94a3b8] bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
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
