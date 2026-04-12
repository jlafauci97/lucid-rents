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
      <div className="flex items-center gap-2 text-gray-400 mb-3"><MapPin size={13} className="text-blue-500" /><span className="text-xs">{listing.zip_code}</span></div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-4">{listing.address}</h2>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {details.map((item) => { const Icon = item.icon; return (
          <div key={item.label} className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 px-3 py-1.5 rounded-full"><Icon size={12} className="text-gray-400" />{item.label}</div>
        ); })}
      </div>
      <div className="flex items-baseline gap-3">
        <motion.span className="text-4xl sm:text-5xl font-black text-gray-900 tracking-tight" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
          ${listing.asking_price.toLocaleString()}
        </motion.span>
        <span className="text-base text-gray-400">/mo</span>
      </div>
      <p className="text-[10px] text-gray-300 uppercase tracking-[2px] mt-1">Listed asking price</p>
    </div>
  );
}
