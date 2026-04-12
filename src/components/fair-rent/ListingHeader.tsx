"use client";

import { motion } from "framer-motion";
import type { ListingData } from "./types";
import { MapPin, BedDouble, Bath, Maximize2, type LucideIcon } from "lucide-react";

export function ListingHeader({ listing }: { listing: ListingData }) {
  const details: { icon: LucideIcon; label: string }[] = [
    { icon: BedDouble, label: listing.beds === 0 ? "Studio" : `${listing.beds} bed` },
    ...(listing.baths != null ? [{ icon: Bath, label: `${listing.baths} bath` }] : []),
    ...(listing.sqft != null ? [{ icon: Maximize2, label: `${listing.sqft.toLocaleString()} sqft` }] : []),
  ];

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 text-white/30 mb-3">
        <MapPin size={13} className="text-[#00D4FF]/60" />
        <span className="text-xs font-mono">{listing.zip_code}</span>
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-4">
        {listing.address}
      </h2>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {details.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-center gap-1.5 text-xs font-mono text-white/40 bg-white/[0.04] border border-white/[0.06] px-3 py-1.5 rounded-lg">
              <Icon size={12} className="text-[#00D4FF]/50" />
              {item.label}
            </div>
          );
        })}
      </div>

      <div className="flex items-baseline gap-3">
        <motion.span
          className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          ${listing.asking_price.toLocaleString()}
        </motion.span>
        <span className="text-base font-mono text-white/20">/mo</span>
      </div>
      <p className="text-[9px] font-mono text-[#00D4FF]/30 uppercase tracking-[3px] mt-1">Listed asking price</p>
    </div>
  );
}
