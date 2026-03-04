"use client";

import { useState } from "react";
import { AlertTriangle, MessageSquare, Scale, HardHat } from "lucide-react";
import { ViolationTimeline } from "./ViolationTimeline";
import { ComplaintTimeline } from "./ComplaintTimeline";
import { LitigationTimeline } from "./LitigationTimeline";
import { DobViolationTimeline } from "./DobViolationTimeline";
import type { HpdViolation, Complaint311, HpdLitigation, DobViolation } from "@/types";

type TabKey = "violations" | "complaints" | "litigations" | "dob";

interface IssuesTabsProps {
  violations: HpdViolation[];
  complaints: Complaint311[];
  litigations: HpdLitigation[];
  dobViolations: DobViolation[];
}

const tabs: { key: TabKey; label: string; icon: typeof AlertTriangle; activeColor: string }[] = [
  { key: "violations", label: "HPD Violations", icon: AlertTriangle, activeColor: "border-[#EF4444] text-[#EF4444]" },
  { key: "complaints", label: "311 Complaints", icon: MessageSquare, activeColor: "border-[#F59E0B] text-[#F59E0B]" },
  { key: "litigations", label: "HPD Litigations", icon: Scale, activeColor: "border-[#8B5CF6] text-[#8B5CF6]" },
  { key: "dob", label: "DOB Violations", icon: HardHat, activeColor: "border-[#3B82F6] text-[#3B82F6]" },
];

export function IssuesTabs({ violations, complaints, litigations, dobViolations }: IssuesTabsProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("violations");

  const counts: Record<TabKey, number> = {
    violations: violations.length,
    complaints: complaints.length,
    litigations: litigations.length,
    dob: dobViolations.length,
  };

  return (
    <section>
      {/* Tab buttons */}
      <div className="flex overflow-x-auto border-b border-[#e2e8f0] mb-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? tab.activeColor
                  : "border-transparent text-[#64748b] hover:text-[#0F1D2E]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label} ({counts[tab.key]})
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "violations" && <ViolationTimeline violations={violations} />}
      {activeTab === "complaints" && <ComplaintTimeline complaints={complaints} />}
      {activeTab === "litigations" && <LitigationTimeline litigations={litigations} />}
      {activeTab === "dob" && <DobViolationTimeline violations={dobViolations} />}
    </section>
  );
}
