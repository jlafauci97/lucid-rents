"use client";

import { motion } from "framer-motion";
import type { ComparableBuilding } from "./types";
import { Building2, ShieldCheck, AlertTriangle, ChevronRight, Star, DollarSign } from "lucide-react";
import { AMENITY_MULTIPLIERS } from "@/lib/fair-rent/constants";

function scoreColor(score: number): string {
  if (score >= 8) return "#00D4FF";
  if (score >= 6) return "#3b82f6";
  if (score >= 4) return "#fbbf24";
  return "#ef4444";
}

function amenityPremium(amenities: string[]): number {
  const amenityMap: Record<string, string> = {
    "Doorman": "doorman", "Elevator": "elevator", "Gym": "gym", "Fitness Center": "gym",
    "Parking": "parking", "Garage": "parking", "Washer/Dryer": "in_unit_laundry", "In-Unit Laundry": "in_unit_laundry",
    "Roof Deck": "private_outdoor_space", "Outdoor Space": "private_outdoor_space", "Balcony": "private_outdoor_space", "Terrace": "private_outdoor_space",
  };
  const seen = new Set<string>();
  let total = 0;
  for (const a of amenities) {
    const key = amenityMap[a];
    if (key && !seen.has(key) && AMENITY_MULTIPLIERS[key]) {
      seen.add(key);
      total += AMENITY_MULTIPLIERS[key];
    }
  }
  return Math.min(total, 0.20);
}

export function ComparablesCard({ comparables, currentZip }: { comparables: ComparableBuilding[]; currentZip: string }) {
  if (comparables.length === 0) return null;

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl overflow-hidden backdrop-blur-sm">
      <div className="px-6 sm:px-8 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div>
          <p className="text-[10px] font-mono font-bold tracking-[2px] uppercase text-[#00D4FF]/50">Better Options Nearby</p>
          <p className="text-[10px] font-mono text-white/15 mt-0.5">Higher-rated buildings in {currentZip}</p>
        </div>
        <Building2 size={16} className="text-white/10" />
      </div>

      <div className="divide-y divide-white/[0.04]">
        {comparables.map((b, i) => {
          const score = parseFloat(b.overall_score);
          const premium = amenityPremium(b.amenities);
          const href = `/nyc/building/${encodeURIComponent(b.borough.toLowerCase())}/${b.slug}`;

          return (
            <motion.a key={b.slug} href={href}
              className="flex items-center gap-4 px-6 sm:px-8 py-4 hover:bg-white/[0.03] transition-colors group"
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.3, duration: 0.35 }}>

              <div className="w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center text-[10px] font-mono font-bold text-white/30 flex-shrink-0">{i + 1}</div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono font-semibold text-white/70 truncate group-hover:text-[#00D4FF] transition-colors">
                  {b.full_address.split(",")[0]}
                </p>
                <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-white/20">
                  {b.total_units != null && <span>{b.total_units} units</span>}
                  {b.year_built != null && <span>{b.year_built}</span>}
                  <span>{b.violation_count} viol.</span>
                </div>
              </div>

              {/* Amenity & rent badges */}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                {b.median_rent != null && (
                  <span className="flex items-center gap-1 text-[9px] font-mono bg-white/[0.05] text-white/30 px-2 py-0.5 rounded">
                    <DollarSign size={9} />${b.median_rent.toLocaleString()}
                  </span>
                )}
                {premium > 0 && (
                  <span className="text-[9px] font-mono bg-[#00D4FF]/10 text-[#00D4FF]/60 px-2 py-0.5 rounded">
                    +{(premium * 100).toFixed(0)}% amenity
                  </span>
                )}
                {b.is_rent_stabilized && (
                  <span className="flex items-center gap-1 text-[9px] font-mono bg-[#00D4FF]/10 text-[#00D4FF]/60 px-2 py-0.5 rounded">
                    <ShieldCheck size={9} />RS
                  </span>
                )}
              </div>

              {/* Score */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star size={11} style={{ color: scoreColor(score) }} fill="currentColor" />
                <span className="text-sm font-bold font-mono" style={{ color: scoreColor(score) }}>{score.toFixed(1)}</span>
              </div>

              <ChevronRight size={14} className="text-white/10 group-hover:text-[#00D4FF]/60 transition-colors flex-shrink-0" />
            </motion.a>
          );
        })}
      </div>

      <div className="px-6 sm:px-8 py-3 border-t border-white/[0.04]">
        <p className="text-[8px] font-mono text-white/10 text-center">
          Scores from Lucid Rents · Amenity premiums from Furman Center / NMHC research
        </p>
      </div>
    </div>
  );
}
