"use client";

import { useState } from "react";
import { AlertTriangle, MessageSquare, Scale, HardHat, Bug, DoorOpen, ClipboardList } from "lucide-react";
import { ViolationTimeline } from "./ViolationTimeline";
import { ViolationSummaryTable } from "./ViolationSummaryTable";
import { ComplaintTimeline } from "./ComplaintTimeline";
import { LitigationTimeline } from "./LitigationTimeline";
import { DobViolationTimeline } from "./DobViolationTimeline";
import { BedBugTimeline } from "./BedBugTimeline";
import { EvictionTimeline } from "./EvictionTimeline";
import { PermitTimeline } from "./PermitTimeline";
import type { HpdViolation, Complaint311, HpdLitigation, DobViolation, BedBugReport, Eviction, DobPermit, LahdViolationSummary } from "@/types";
import { type City, DEFAULT_CITY } from "@/lib/cities";
import { VIOLATION_AGENCIES } from "@/lib/constants";

type TabKey = "violations" | "complaints" | "litigations" | "dob" | "bedbugs" | "evictions" | "permits";

/**
 * Stored totals from the buildings row (buildings.violation_count etc.).
 * When provided, these drive the tab count labels and are used to detect
 * when a timeline is showing an empty state despite the building having
 * records on file (typically after dedup orphans FKs).
 */
export interface IssuesTotalCounts {
  violations?: number;
  complaints?: number;
  litigations?: number;
  dob?: number;
  bedbugs?: number;
  evictions?: number;
  permits?: number;
}

interface IssuesTabsProps {
  violations: HpdViolation[];
  complaints: Complaint311[];
  litigations: HpdLitigation[];
  dobViolations: DobViolation[];
  bedbugs: BedBugReport[];
  evictions: Eviction[];
  permits: DobPermit[];
  lahdViolationSummary?: LahdViolationSummary[];
  city?: City;
  totalCounts?: IssuesTotalCounts;
  /** Base building URL; used for "view all" deep links into /violations, /complaints, etc. */
  buildingHref?: string;
}

// Tabs available per city
const CITY_TABS: Record<City, TabKey[]> = {
  nyc: ["violations", "complaints", "litigations", "dob", "bedbugs", "evictions", "permits"],
  chicago: ["dob", "complaints", "permits"],
  "los-angeles": ["violations", "complaints", "permits"],
  miami: ["violations", "complaints", "permits"],
  houston: ["violations", "complaints", "permits"],
};

function getTabs(city: City) {
  const agencies = VIOLATION_AGENCIES[city] || VIOLATION_AGENCIES.nyc;
  const allTabs: Record<TabKey, { key: TabKey; label: string; icon: typeof AlertTriangle; activeBg: string; activeText: string }> = {
    violations: { key: "violations", label: `${agencies.housing} Violations`, icon: AlertTriangle, activeBg: "bg-red-50 ring-1 ring-[#EF4444]", activeText: "text-[#EF4444]" },
    complaints: { key: "complaints", label: "311 Complaints", icon: MessageSquare, activeBg: "bg-amber-50 ring-1 ring-[#F59E0B]", activeText: "text-[#F59E0B]" },
    litigations: { key: "litigations", label: `${agencies.housing} Litigations`, icon: Scale, activeBg: "bg-violet-50 ring-1 ring-[#8B5CF6]", activeText: "text-[#8B5CF6]" },
    dob: { key: "dob", label: `${agencies.building} Violations`, icon: HardHat, activeBg: "bg-blue-50 ring-1 ring-[#3B82F6]", activeText: "text-[#3B82F6]" },
    bedbugs: { key: "bedbugs", label: "Bedbugs", icon: Bug, activeBg: "bg-purple-50 ring-1 ring-[#9333EA]", activeText: "text-[#9333EA]" },
    evictions: { key: "evictions", label: "Evictions", icon: DoorOpen, activeBg: "bg-pink-50 ring-1 ring-[#EC4899]", activeText: "text-[#EC4899]" },
    permits: { key: "permits", label: city === "los-angeles" ? "LADBS Permits" : city === "chicago" ? "CDBS Permits" : "Permits", icon: ClipboardList, activeBg: "bg-teal-50 ring-1 ring-[#0D9488]", activeText: "text-[#0D9488]" },
  };
  const enabledKeys = CITY_TABS[city] || CITY_TABS.nyc;
  return enabledKeys.map(k => allTabs[k]);
}

export function IssuesTabs({ violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, lahdViolationSummary = [], city = DEFAULT_CITY, totalCounts }: IssuesTabsProps) {
  const enabledTabs = CITY_TABS[city] || CITY_TABS.nyc;
  const [activeTab, setActiveTab] = useState<TabKey>(enabledTabs[0]);

  // Prefer stored totals from the buildings row (accurate even when we only
  // fetched the first N rows for the timeline). Fall back to loaded length.
  const pick = (stored: number | undefined, loaded: number) =>
    typeof stored === "number" && stored >= loaded ? stored : loaded;

  const counts: Record<TabKey, number> = {
    violations: city === "los-angeles"
      ? lahdViolationSummary.length
      : pick(totalCounts?.violations, violations.length),
    complaints: pick(totalCounts?.complaints, complaints.length),
    litigations: pick(totalCounts?.litigations, litigations.length),
    dob: pick(totalCounts?.dob, dobViolations.length),
    bedbugs: pick(totalCounts?.bedbugs, bedbugs.length),
    evictions: pick(totalCounts?.evictions, evictions.length),
    permits: pick(totalCounts?.permits, permits.length),
  };

  return (
    <section>
      {/* Tab buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {getTabs(city).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? `${tab.activeBg} ${tab.activeText}`
                  : "bg-gray-100 text-[#64748b] hover:bg-gray-200 hover:text-[#0F1D2E]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label} ({counts[tab.key]})
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {(() => {
        const agencies = VIOLATION_AGENCIES[city] || VIOLATION_AGENCIES.nyc;
        return (
          <>
            {activeTab === "violations" && (
              city === "los-angeles"
                ? <ViolationSummaryTable violations={lahdViolationSummary} agencyLabel={agencies.housing} />
                : <ViolationTimeline violations={violations} agencyLabel={agencies.housing} total={totalCounts?.violations} />
            )}
            {activeTab === "complaints" && <ComplaintTimeline complaints={complaints} total={totalCounts?.complaints} />}
            {activeTab === "litigations" && <LitigationTimeline litigations={litigations} agencyLabel={agencies.housing} total={totalCounts?.litigations} />}
            {activeTab === "dob" && <DobViolationTimeline violations={dobViolations} agencyLabel={agencies.building} total={totalCounts?.dob} />}
            {activeTab === "bedbugs" && <BedBugTimeline reports={bedbugs} total={totalCounts?.bedbugs} />}
            {activeTab === "evictions" && <EvictionTimeline evictions={evictions} total={totalCounts?.evictions} />}
            {activeTab === "permits" && <PermitTimeline permits={permits} agencyLabel={agencies.building} total={totalCounts?.permits} />}
          </>
        );
      })()}
    </section>
  );
}
