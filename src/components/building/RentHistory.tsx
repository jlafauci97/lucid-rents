"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { History, ChevronDown, ChevronUp } from "lucide-react";

export interface RentHistoryEntry {
  id: string;
  unit_number: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rent: number;
  sqft: number | null;
  source: string;
  observed_at: string;
}

interface RentHistoryProps {
  history: RentHistoryEntry[];
}

const BED_LABELS: Record<number, string> = {
  0: "Studio",
  1: "1 Bed",
  2: "2 Bed",
  3: "3 Bed",
  4: "4 Bed",
  5: "5+ Bed",
};

function bedLabel(beds: number | null): string {
  if (beds === null) return "";
  return BED_LABELS[beds] || `${beds} Bed`;
}

function formatRent(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function sourceLabel(source: string): string {
  if (source === "rent_com") return "Rent.com";
  if (source === "streeteasy") return "StreetEasy";
  if (source === "zillow") return "Zillow";
  if (source === "apartments_com") return "Apartments.com";
  return source;
}

interface UnitGroup {
  key: string;
  label: string;
  bedrooms: number | null;
  entries: RentHistoryEntry[];
  latestRent: number;
  latestDate: string;
}

function groupByUnit(history: RentHistoryEntry[]): UnitGroup[] {
  const map = new Map<string, RentHistoryEntry[]>();

  for (const entry of history) {
    const key = entry.unit_number || `bed-${entry.bedrooms ?? "unknown"}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(entry);
  }

  const groups: UnitGroup[] = [];
  for (const [key, entries] of map) {
    // Sort newest first
    entries.sort(
      (a, b) =>
        new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime()
    );
    const first = entries[0];
    const label = first.unit_number
      ? `Unit ${first.unit_number}`
      : bedLabel(first.bedrooms) || "Unknown";
    groups.push({
      key,
      label,
      bedrooms: first.bedrooms,
      entries,
      latestRent: first.rent,
      latestDate: first.observed_at,
    });
  }

  // Sort by unit number (natural sort), then by bedroom count
  groups.sort((a, b) => {
    if (a.bedrooms !== null && b.bedrooms !== null && a.bedrooms !== b.bedrooms)
      return a.bedrooms - b.bedrooms;
    return a.label.localeCompare(b.label, undefined, { numeric: true });
  });

  return groups;
}

function UnitRow({ group }: { group: UnitGroup }) {
  const [expanded, setExpanded] = useState(false);
  const hasHistory = group.entries.length > 1;

  return (
    <div className="border-b border-[#f1f5f9] last:border-0">
      <button
        type="button"
        onClick={() => hasHistory && setExpanded(!expanded)}
        className={`w-full flex items-center justify-between py-3 px-1 text-left ${hasHistory ? "cursor-pointer hover:bg-gray-50" : "cursor-default"} transition-colors`}
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-[#0F1D2E]">
            {group.label}
          </span>
          {group.entries[0].unit_number && group.bedrooms !== null && (
            <span className="text-xs bg-[#f1f5f9] text-[#475569] px-2 py-0.5 rounded-full">
              {bedLabel(group.bedrooms)}
            </span>
          )}
          {hasHistory && (
            <span className="text-[10px] text-[#94a3b8]">
              {group.entries.length} records
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-sm font-semibold text-[#16a34a]">
              {formatRent(group.latestRent)}/mo
            </span>
            <span className="text-[10px] text-[#94a3b8] ml-1.5">
              {formatDate(group.latestDate)}
            </span>
          </div>
          {hasHistory &&
            (expanded ? (
              <ChevronUp className="w-4 h-4 text-[#94a3b8]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#94a3b8]" />
            ))}
        </div>
      </button>

      {expanded && (
        <div className="pb-3 pl-4 pr-1">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#94a3b8]">
                <th className="text-left py-1 font-medium">Date</th>
                <th className="text-right py-1 font-medium">Rent</th>
                <th className="text-right py-1 font-medium hidden sm:table-cell">
                  Sq Ft
                </th>
                <th className="text-right py-1 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {group.entries.map((entry, i) => {
                const prev = group.entries[i + 1];
                const diff = prev ? entry.rent - prev.rent : 0;
                return (
                  <tr
                    key={entry.id}
                    className="border-t border-[#f8fafc]"
                  >
                    <td className="py-1.5 text-[#334155]">
                      {formatDate(entry.observed_at)}
                    </td>
                    <td className="py-1.5 text-right">
                      <span className="font-medium text-[#0F1D2E]">
                        {formatRent(entry.rent)}
                      </span>
                      {diff !== 0 && (
                        <span
                          className={`ml-1 ${diff > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}
                        >
                          {diff > 0 ? "+" : ""}
                          {formatRent(Math.abs(diff))}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-right text-[#64748b] hidden sm:table-cell">
                      {entry.sqft ? `${entry.sqft.toLocaleString()}` : "—"}
                    </td>
                    <td className="py-1.5 text-right text-[#64748b]">
                      {sourceLabel(entry.source)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function RentHistory({ history }: RentHistoryProps) {
  if (!history || history.length === 0) return null;

  const groups = groupByUnit(history);

  // Most recent observation date across all entries
  const lastChecked = history.reduce((latest, entry) => {
    return entry.observed_at > latest ? entry.observed_at : latest;
  }, history[0].observed_at);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4.5 h-4.5 text-[#2563EB]" />
            <h3 className="text-base font-bold text-[#0F1D2E]">
              Historical Rents ({groups.length})
            </h3>
          </div>
          <span className="text-xs text-[#94a3b8]">
            Last checked {formatDate(lastChecked)}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          {groups.map((group) => (
            <UnitRow key={group.key} group={group} />
          ))}
        </div>
        <p className="text-[10px] text-[#94a3b8] mt-3">
          Based on listing data from StreetEasy, Rent.com, Zillow &
          Apartments.com
        </p>
      </CardContent>
    </Card>
  );
}
