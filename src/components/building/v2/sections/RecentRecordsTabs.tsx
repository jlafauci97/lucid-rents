"use client";

import { useState } from "react";
import type { BuildingV2Data } from "@/app/[city]/building/[borough]/[slug]/_data";

type Source = "HPD" | "311" | "DOB";

interface Props {
  records: BuildingV2Data["issues"]["recentViolations"];
  hpdCount: number;
  complaintsCount: number;
  dobCount: number;
  evictionsCount: number;
  seeAllUrl: string;
}

function formatVioDate(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function RecentRecordsTabs({ records, hpdCount, complaintsCount, dobCount, seeAllUrl }: Props) {
  const [activeTab, setActiveTab] = useState<Source>("HPD");

  const filtered = records.filter((r) => {
    if (activeTab === "HPD") return r.source === "HPD";
    if (activeTab === "311") return r.source === "311";
    if (activeTab === "DOB") return r.source === "DOB";
    return false;
  }).slice(0, 5);

  const tabCount = (source: Source) => {
    if (source === "HPD") return hpdCount;
    if (source === "311") return complaintsCount;
    if (source === "DOB") return dobCount;
    return 0;
  };

  const tabs: { key: Source; label: string; icon: React.ReactNode }[] = [
    {
      key: "HPD",
      label: "HPD Violations",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
    },
    {
      key: "311",
      label: "311 Complaints",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    },
    {
      key: "DOB",
      label: "DOB Violations",
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    },
  ];

  return (
    <div className="ww-card ww-mt">
      <header className="ww-head">
        <h3>Recent records</h3>
        <span className="ri-pill">Last 7 years</span>
      </header>

      <div className="rec-tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`rec-tab${activeTab === tab.key ? " active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            aria-selected={activeTab === tab.key}
          >
            {tab.icon}
            {tab.label} <span className="c">({tabCount(tab.key).toLocaleString()})</span>
          </button>
        ))}
      </div>

      <ul className="rec-list">
        {filtered.length > 0 ? filtered.map((v) => (
          <li key={v.id} className="rec-item">
            <header className="rec-item-head">
              <span className="rec-class">{v.class ? `Class ${v.class}` : "Violation"}</span>
              <span className={`rec-status ${v.status?.toLowerCase().includes("open") ? "open" : "closed"}`}>
                {v.status || "Recorded"}
              </span>
              <span className="rec-date">{formatVioDate(v.date)}</span>
            </header>
            <p className="rec-body">{v.description || v.category}</p>
          </li>
        )) : (
          <li className="rec-item">
            <header className="rec-item-head">
              <span className="rec-class">{"\u2014"}</span>
              <span className="rec-status closed">NO RECORDS</span>
              <span className="rec-date">{"\u2014"}</span>
            </header>
            <p className="rec-body">No {activeTab} records on file in the last 7 years.</p>
          </li>
        )}
      </ul>

      <a className="ww-seeall" href={seeAllUrl}>
        See all {tabCount(activeTab).toLocaleString()} {activeTab} records
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </a>
    </div>
  );
}
