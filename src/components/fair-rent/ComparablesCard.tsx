"use client";

import { motion } from "framer-motion";
import type { ComparableBuilding } from "./types";
import { Building2, ShieldCheck, AlertTriangle, ChevronRight, Star } from "lucide-react";

interface ComparablesCardProps {
  comparables: ComparableBuilding[];
  currentZip: string;
}

function scoreColor(score: number): string {
  if (score >= 8) return "text-emerald-600";
  if (score >= 6) return "text-blue-600";
  if (score >= 4) return "text-amber-600";
  return "text-red-600";
}

function scoreBg(score: number): string {
  if (score >= 8) return "bg-emerald-50";
  if (score >= 6) return "bg-blue-50";
  if (score >= 4) return "bg-amber-50";
  return "bg-red-50";
}

export function ComparablesCard({ comparables, currentZip }: ComparablesCardProps) {
  if (comparables.length === 0) return null;

  return (
    <div className="bg-white border border-[#e8e6e1] rounded-2xl overflow-hidden">
      <div className="bg-[#0F1D2E] px-6 sm:px-8 py-5 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold tracking-[2px] uppercase text-white/50">
            Better Options Nearby
          </p>
          <p className="text-[13px] text-white/30 mt-0.5">
            Higher-rated buildings in {currentZip}
          </p>
        </div>
        <Building2 size={18} className="text-white/30" />
      </div>

      <div className="divide-y divide-gray-100">
        {comparables.map((building, i) => {
          const score = parseFloat(building.overall_score);
          const href = `/nyc/building/${encodeURIComponent(building.borough.toLowerCase())}/${building.slug}`;

          return (
            <motion.a
              key={building.slug}
              href={href}
              className="flex items-center gap-4 px-6 sm:px-8 py-4 hover:bg-[#f9f9f7] transition-colors group"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.3, duration: 0.35 }}
            >
              {/* Rank */}
              <div className="w-7 h-7 rounded-lg bg-[#f5f4f1] flex items-center justify-center text-[11px] font-bold text-gray-400 flex-shrink-0">
                {i + 1}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0b0b0b] truncate group-hover:text-[#3B82F6] transition-colors">
                  {building.full_address.split(",")[0]}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                  {building.total_units != null && <span>{building.total_units} units</span>}
                  {building.year_built != null && <span>Built {building.year_built}</span>}
                  <span>{building.violation_count} violations</span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {building.is_rent_stabilized && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={10} />
                    Stabilized
                  </span>
                )}
                {building.violation_count === 0 && (
                  <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    No violations
                  </span>
                )}
                {building.violation_count > 100 && (
                  <span className="flex items-center gap-1 text-[9px] font-semibold bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={10} />
                    {building.violation_count}
                  </span>
                )}
              </div>

              {/* Score */}
              <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg ${scoreBg(score)} flex-shrink-0`}>
                <Star size={12} className={scoreColor(score)} fill="currentColor" />
                <span className={`text-sm font-bold ${scoreColor(score)}`}>{score.toFixed(1)}</span>
              </div>

              {/* Arrow */}
              <ChevronRight size={16} className="text-gray-300 group-hover:text-[#3B82F6] transition-colors flex-shrink-0" />
            </motion.a>
          );
        })}
      </div>

      <div className="px-6 sm:px-8 py-3 bg-[#f9f9f7] text-center">
        <p className="text-[10px] text-gray-300">
          Scores based on violations, complaints, and tenant reviews from Lucid Rents database
        </p>
      </div>
    </div>
  );
}
