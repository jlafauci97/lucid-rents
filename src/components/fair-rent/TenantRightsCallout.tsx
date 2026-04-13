"use client";

import { motion } from "framer-motion";
import type { AnalyzeResponse } from "./types";
import { Shield, AlertTriangle, AlertCircle } from "lucide-react";

interface CalloutBox { color: "green" | "yellow" | "red"; title: string; body: string; }

export function TenantRightsCallout({ result }: { result: AnalyzeResponse }) {
  const boxes: CalloutBox[] = [];
  if (result.stabilization?.is_stabilized) boxes.push({ color: "green", title: "Rent-Stabilized Tenant Rights", body: "Landlord must offer lease renewal. Increases capped by RGB. Ask for the legal registered rent before signing." });
  if (result.violations?.classification === "above_average") boxes.push({ color: "yellow", title: "Above-Average Violations", body: "Request full HPD inspection history. Lookup: hpdinline.building.nyc.gov" });
  if (result.litigations && result.litigations.active_litigations > 0) boxes.push({ color: "red", title: "Active Legal Cases", body: "Review cases at NYC OATH portal. May indicate habitability issues." });
  if (result.litigations?.has_harassment_case) boxes.push({ color: "red", title: "Harassment Case on Record", body: "History of alleged tenant harassment. Rights: metcouncilonhousing.org" });
  if (result.stabilization?.yoy_unit_change_pct != null && result.stabilization.yoy_unit_change_pct < -10) boxes.push({ color: "yellow", title: "Stabilized Units Declining", body: "Building losing stabilized units. Confirm your unit's legal status." });

  if (boxes.length === 0) return null;

  const colorMap = {
    green: { border: "border-l-blue-500", bg: "bg-blue-50", icon: <Shield size={16} className="text-blue-600 flex-shrink-0" />, title: "text-blue-700" },
    yellow: { border: "border-l-amber-500", bg: "bg-amber-50", icon: <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />, title: "text-amber-700" },
    red: { border: "border-l-red-500", bg: "bg-red-50", icon: <AlertCircle size={16} className="text-red-500 flex-shrink-0" />, title: "text-red-700" },
  };

  return (
    <div className="flex flex-col gap-3 mb-5">
      {boxes.map((box, i) => { const s = colorMap[box.color]; return (
        <motion.div key={i} className={`${s.bg} border-l-4 ${s.border} rounded-r-xl px-5 py-4 flex gap-3 items-start`}
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.2 }}>
          {s.icon}
          <div>
            <p className={`text-xs font-semibold ${s.title} mb-0.5`}>{box.title}</p>
            <p className="text-[11px] text-gray-500 leading-relaxed">{box.body}</p>
          </div>
        </motion.div>
      ); })}
    </div>
  );
}
