"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MessageSquare, Scale, HardHat, Bug, DoorOpen, ClipboardList, ChevronRight, ChevronLeft } from "lucide-react";
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

const PAGE_SIZE = 10;

export function IssuesTabs({ violations, complaints, litigations, dobViolations, bedbugs, evictions, permits, lahdViolationSummary = [], city = DEFAULT_CITY, totalCounts, buildingHref }: IssuesTabsProps) {
  const enabledTabs = CITY_TABS[city] || CITY_TABS.nyc;
  const [activeTab, setActiveTab] = useState<TabKey>(enabledTabs[0]);
  const [page, setPage] = useState(1);

  // Reset pagination when switching tabs.
  useEffect(() => {
    setPage(1);
  }, [activeTab]);

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

  // On the standalone /violations page (no buildingHref), paginate the
  // active tab's records 10 at a time. On the building summary page,
  // we still cap at 5 with a "see all" link.
  const paginated = !buildingHref;
  const sliceForPage = <T,>(arr: T[]): T[] => {
    if (!paginated) return arr;
    const start = (page - 1) * PAGE_SIZE;
    return arr.slice(start, start + PAGE_SIZE);
  };
  const renderPager = (loadedLength: number) => {
    if (!paginated || loadedLength <= PAGE_SIZE) return null;
    const totalPages = Math.ceil(loadedLength / PAGE_SIZE);
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(page * PAGE_SIZE, loadedLength);
    return (
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4 text-sm">
        <span className="text-[#64748b] font-mono text-xs">
          {start.toLocaleString()}–{end.toLocaleString()} of {loadedLength.toLocaleString()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          <span className="text-[#64748b] font-mono text-xs px-1">
            page {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-200 text-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
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
        const limit = buildingHref ? 5 : undefined;
        const seeAll = (count: number, label: string) =>
          buildingHref && count > 5 ? (
            <div className="mt-3 text-center">
              <Link href={`${buildingHref}/violations`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3B82F6] hover:text-[#1d4ed8] transition-colors">
                See all {count.toLocaleString()} {label}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          ) : null;
        const visible = <T,>(arr: T[]): T[] =>
          limit ? arr.slice(0, limit) : sliceForPage(arr);
        return (
          <>
            {activeTab === "violations" && (
              <>
                {city === "los-angeles"
                  ? <ViolationSummaryTable violations={visible(lahdViolationSummary)} agencyLabel={agencies.housing} />
                  : <ViolationTimeline violations={visible(violations)} agencyLabel={agencies.housing} total={totalCounts?.violations} />
                }
                {seeAll(counts.violations, "violations")}
                {renderPager(city === "los-angeles" ? lahdViolationSummary.length : violations.length)}
              </>
            )}
            {activeTab === "complaints" && (
              <>
                <ComplaintTimeline complaints={visible(complaints)} total={totalCounts?.complaints} />
                {seeAll(counts.complaints, "complaints")}
                {renderPager(complaints.length)}
              </>
            )}
            {activeTab === "litigations" && (
              <>
                <LitigationTimeline litigations={visible(litigations)} agencyLabel={agencies.housing} total={totalCounts?.litigations} />
                {seeAll(counts.litigations, "litigations")}
                {renderPager(litigations.length)}
              </>
            )}
            {activeTab === "dob" && (
              <>
                <DobViolationTimeline violations={visible(dobViolations)} agencyLabel={agencies.building} total={totalCounts?.dob} />
                {seeAll(counts.dob, "violations")}
                {renderPager(dobViolations.length)}
              </>
            )}
            {activeTab === "bedbugs" && (
              <>
                <BedBugTimeline reports={visible(bedbugs)} total={totalCounts?.bedbugs} />
                {seeAll(counts.bedbugs, "bedbug reports")}
                {renderPager(bedbugs.length)}
              </>
            )}
            {activeTab === "evictions" && (
              <>
                <EvictionTimeline evictions={visible(evictions)} total={totalCounts?.evictions} />
                {seeAll(counts.evictions, "evictions")}
                {renderPager(evictions.length)}
              </>
            )}
            {activeTab === "permits" && (
              <>
                <PermitTimeline permits={visible(permits)} agencyLabel={agencies.building} total={totalCounts?.permits} />
                {seeAll(counts.permits, "permits")}
                {renderPager(permits.length)}
              </>
            )}
          </>
        );
      })()}
    </section>
  );
}
