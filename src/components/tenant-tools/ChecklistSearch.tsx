"use client";

import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import type { ChecklistItem } from "@/app/api/checklist/route";

interface SearchResult {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
  metro: string;
}

interface ChecklistResult {
  building: {
    id: string;
    full_address: string;
    borough: string;
    slug: string;
    overall_score: number | null;
  };
  items: ChecklistItem[];
}

const STATUS_COLORS: Record<ChecklistItem["status"], string> = {
  pass: "bg-emerald-50 border-emerald-200",
  warn: "bg-yellow-50 border-yellow-200",
  fail: "bg-red-50 border-red-200",
  info: "bg-blue-50 border-blue-200",
};

const STATUS_ICON: Record<ChecklistItem["status"], string> = {
  pass: "✓",
  warn: "⚠",
  fail: "✗",
  info: "ℹ",
};

const STATUS_TEXT: Record<ChecklistItem["status"], string> = {
  pass: "text-emerald-700",
  warn: "text-yellow-700",
  fail: "text-red-700",
  info: "text-blue-700",
};

export function ChecklistSearch({ city }: { city: string }) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null);
  const [loadingChecklist, setLoadingChecklist] = useState(false);

  async function handleSearch(q: string) {
    setQuery(q);
    if (q.length < 3) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&city=${city}&limit=5`);
      const data = await res.json();
      setSearchResults(data?.results || data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function selectBuilding(building: SearchResult) {
    setQuery(building.full_address);
    setSearchResults([]);
    setLoadingChecklist(true);
    setChecklist(null);
    try {
      const res = await fetch(`/api/checklist?buildingId=${building.id}&city=${city}`);
      const data = await res.json();
      setChecklist(data);
    } catch {
      setChecklist(null);
    } finally {
      setLoadingChecklist(false);
    }
  }

  const passCount = checklist?.items.filter((i) => i.status === "pass").length ?? 0;
  const failCount = checklist?.items.filter((i) => i.status === "fail").length ?? 0;
  const warnCount = checklist?.items.filter((i) => i.status === "warn").length ?? 0;

  return (
    <div>
      {/* Search input */}
      <div className="relative mb-6">
        <div className="flex items-center gap-3 bg-white border border-[#e2e8f0] rounded-xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-[#3B82F6] focus-within:border-[#3B82F6]">
          {searching ? (
            <Loader2 className="w-5 h-5 text-[#94a3b8] animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-[#94a3b8] flex-shrink-0" />
          )}
          <input
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by address or building name…"
            className="flex-1 bg-transparent text-sm text-[#0F1D2E] placeholder-[#94a3b8] outline-none"
          />
        </div>

        {/* Dropdown results */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e2e8f0] rounded-xl shadow-lg z-20 overflow-hidden">
            {searchResults.map((b) => (
              <button
                key={b.id}
                onClick={() => selectBuilding(b)}
                className="w-full text-left px-4 py-3 hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9] last:border-0"
              >
                <p className="text-sm font-medium text-[#0F1D2E]">{b.full_address}</p>
                <p className="text-xs text-[#64748b]">{b.borough}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {loadingChecklist && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#3B82F6] animate-spin" />
        </div>
      )}

      {/* Checklist results */}
      {checklist && !loadingChecklist && (
        <div>
          {/* Summary */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl p-4 mb-4">
            <h3 className="text-sm font-bold text-[#0F1D2E] mb-1">
              {checklist.building.full_address}
            </h3>
            <p className="text-xs text-[#64748b] mb-3">{checklist.building.borough}</p>
            <div className="flex gap-4">
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-600">{passCount}</p>
                <p className="text-xs text-[#64748b]">Pass</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-yellow-600">{warnCount}</p>
                <p className="text-xs text-[#64748b]">Warning</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-red-600">{failCount}</p>
                <p className="text-xs text-[#64748b]">Fail</p>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            {checklist.items.map((item) => (
              <div
                key={item.id}
                className={`border rounded-xl px-4 py-3 ${STATUS_COLORS[item.status]}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`text-sm font-bold mt-0.5 w-5 text-center ${STATUS_TEXT[item.status]}`}
                  >
                    {STATUS_ICON[item.status]}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${STATUS_TEXT[item.status]}`}>
                      {item.label}
                    </p>
                    <p className="text-xs text-[#475569] mt-0.5">{item.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
