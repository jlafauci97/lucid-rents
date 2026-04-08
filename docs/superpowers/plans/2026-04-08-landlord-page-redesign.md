# Landlord Page Redesign — Crime Page Model

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the landlord directory (`/[city]/landlords`) and landlord detail (`/[city]/landlord/[name]`) pages to match the crime page's multi-tier architecture — city-level overview with hero stats, top/bottom spotlight cards, interactive ranking table, and rich detail pages with verdict banners and trend charts.

**Architecture:** The crime page uses a 3-tier hierarchy (city overview → zip detail → safest ranking). Apply the same pattern to landlords: city overview with hero stats and spotlight cards → landlord detail with verdict banner, stats grid, trend chart, and building portfolio → new "worst landlords" ranking page. Introduce a landlord grading system (A–F) based on percentile ranking of portfolio scores, mirroring crime's safety grades. Add a new `landlord-stats.ts` utility library for ranking/grading logic.

**Tech Stack:** Next.js App Router (server components + dynamic client imports), Supabase RPCs, Recharts for trend charts, Tailwind CSS, existing UI primitives (LetterGrade, TrendBadge, Sparkline, Card, Breadcrumbs, JsonLd, FAQSection).

---

## File Structure

### New files
- `src/lib/landlord-stats.ts` — Grading, ranking, verdict generation (mirrors `crime-stats.ts`)
- `src/components/landlord/LandlordRankingTable.tsx` — Client-side interactive table (mirrors `CrimeRankingTable.tsx`)
- `src/components/landlord/LandlordVerdict.tsx` — Verdict banner for detail page (mirrors `SafetyVerdict.tsx`)
- `src/components/landlord/LandlordStatsGrid.tsx` — 4-column comparison stats for detail page (mirrors `CrimeStatsGrid.tsx`)
- `src/app/[city]/landlords/worst/page.tsx` — "Worst Landlords" ranking page (mirrors `/crime/safest`)
- `src/app/[city]/landlords/worst/opengraph-image.tsx` — Dynamic OG image for worst landlords

### Modified files
- `src/app/[city]/landlords/page.tsx` — Full rewrite: hero stats, spotlight cards, interactive table
- `src/app/[city]/landlord/[name]/page.tsx` — Add verdict banner, stats grid with city comparison bars, improve layout
- `src/components/landlord/LandlordActionLinks.tsx` — Make multi-city aware (currently NYC-only)

---

## Task 1: Create `landlord-stats.ts` utility library

**Files:**
- Create: `src/lib/landlord-stats.ts`

This mirrors `src/lib/crime-stats.ts` — provides grading, ranking, and verdict generation for landlords.

- [ ] **Step 1: Create the landlord-stats utility**

```typescript
// src/lib/landlord-stats.ts

/** Landlord grade thresholds (percentile-based on avg_score) */
export type LandlordGrade = "A" | "B" | "C" | "D" | "F";

export interface LandlordRanked {
  name: string;
  slug: string;
  building_count: number;
  total_violations: number;
  total_complaints: number;
  total_litigations: number;
  total_dob_violations: number;
  avg_score: number;
  grade: LandlordGrade;
  rank: number;
  percentile: number;
  worst_building_address: string | null;
  worst_building_violations: number;
  /** violations per building — normalized metric */
  violations_per_building: number;
}

export interface LandlordCityStats {
  total_landlords: number;
  total_buildings: number;
  total_violations: number;
  avg_score: number;
  avg_violations_per_landlord: number;
}

/**
 * Assign a landlord grade based on percentile of avg_score.
 * Higher score = better grade. Percentile 0 = worst score.
 */
export function landlordGrade(percentile: number): LandlordGrade {
  if (percentile >= 80) return "A";
  if (percentile >= 60) return "B";
  if (percentile >= 40) return "C";
  if (percentile >= 20) return "D";
  return "F";
}

/**
 * Rank landlords by avg_score descending (best first) and assign grades.
 */
export function rankLandlords(
  landlords: {
    name: string;
    slug: string;
    building_count: number;
    total_violations: number;
    total_complaints: number;
    total_litigations: number;
    total_dob_violations: number;
    avg_score: number;
    worst_building_address: string | null;
    worst_building_violations: number;
  }[]
): LandlordRanked[] {
  const sorted = [...landlords].sort((a, b) => b.avg_score - a.avg_score);
  const count = sorted.length;

  return sorted.map((l, i) => {
    const percentile =
      count > 1 ? Math.round(((count - 1 - i) / (count - 1)) * 100) : 50;
    return {
      ...l,
      grade: landlordGrade(percentile),
      rank: i + 1,
      percentile,
      violations_per_building:
        l.building_count > 0
          ? Math.round(l.total_violations / l.building_count)
          : 0,
    };
  });
}

/**
 * Generate a human-readable landlord verdict string.
 */
export function landlordVerdict(
  grade: LandlordGrade,
  name: string,
  avgScore: number,
  cityAvgScore: number,
  totalViolations: number,
  buildingCount: number,
  totalLitigations: number
): string {
  const gradeLabels: Record<LandlordGrade, string> = {
    A: "Excellent",
    B: "Above Average",
    C: "Average",
    D: "Below Average",
    F: "Poor",
  };

  const label = gradeLabels[grade];
  const vsAvg =
    avgScore > cityAvgScore
      ? `scores ${((avgScore - cityAvgScore) / cityAvgScore * 100).toFixed(0)}% above the city average`
      : avgScore < cityAvgScore
        ? `scores ${((cityAvgScore - avgScore) / cityAvgScore * 100).toFixed(0)}% below the city average`
        : "scores at the city average";

  const violationsPerBuilding =
    buildingCount > 0 ? Math.round(totalViolations / buildingCount) : 0;
  const violationNote =
    violationsPerBuilding > 50
      ? `Averaging ${violationsPerBuilding} violations per building — significantly above normal.`
      : violationsPerBuilding > 20
        ? `Averaging ${violationsPerBuilding} violations per building.`
        : `Averaging ${violationsPerBuilding} violations per building — relatively low.`;

  const litigationNote =
    totalLitigations > 10
      ? ` ${totalLitigations} active or recent litigations.`
      : totalLitigations > 0
        ? ` ${totalLitigations} litigation${totalLitigations !== 1 ? "s" : ""} on record.`
        : "";

  return `${name} is rated "${label}" and ${vsAvg}. ${violationNote}${litigationNote}`;
}
```

- [ ] **Step 2: Verify file created**

Run: `ls -la src/lib/landlord-stats.ts`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add src/lib/landlord-stats.ts
git commit -m "feat(landlords): add landlord-stats utility — grading, ranking, verdicts"
```

---

## Task 2: Create `LandlordRankingTable` component

**Files:**
- Create: `src/components/landlord/LandlordRankingTable.tsx`

Interactive client-side table mirroring `CrimeRankingTable.tsx` with search, sort, and filter. Key innovation: instead of filtering by borough/area, filter by grade (A/B/C/D/F) and add a "violations per building" normalized column.

- [ ] **Step 1: Create the ranking table component**

```typescript
// src/components/landlord/LandlordRankingTable.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, ArrowUpDown, Building2 } from "lucide-react";
import { LetterGrade } from "@/components/ui/LetterGrade";
import type { LandlordRanked, LandlordGrade } from "@/lib/landlord-stats";

const GRADE_SCORES: Record<LandlordGrade, number> = {
  A: 4.5, B: 3.5, C: 2.5, D: 1.5, F: 0.5,
};

interface LandlordRankingTableProps {
  rows: LandlordRanked[];
  cityPathPrefix: string;
}

type SortKey = "rank" | "avg_score" | "total_violations" | "building_count" | "violations_per_building" | "total_litigations";

export function LandlordRankingTable({
  rows,
  cityPathPrefix,
}: LandlordRankingTableProps) {
  const buildPath = (path: string) => `${cityPathPrefix}${path}`;
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterGrade, setFilterGrade] = useState<LandlordGrade | "">("");

  const filtered = useMemo(() => {
    let result = rows;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) => r.name.toLowerCase().includes(q));
    }
    if (filterGrade) {
      result = result.filter((r) => r.grade === filterGrade);
    }
    return [...result].sort((a, b) => {
      const aVal = a[sortBy] ?? 0;
      const bVal = b[sortBy] ?? 0;
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [rows, search, filterGrade, sortBy, sortAsc]);

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc(!sortAsc);
    else {
      setSortBy(key);
      setSortAsc(key === "rank");
    }
  }

  return (
    <div>
      {/* Search + grade filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by landlord name..."
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-[#e2e8f0] rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1]"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterGrade("")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !filterGrade ? "bg-[#0F1D2E] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
            }`}
          >
            All
          </button>
          {(["A", "B", "C", "D", "F"] as LandlordGrade[]).map((g) => (
            <button
              key={g}
              onClick={() => setFilterGrade(g)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filterGrade === g ? "bg-[#0F1D2E] text-white" : "bg-[#f1f5f9] text-[#64748b] hover:bg-[#e2e8f0]"
              }`}
            >
              Grade {g}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-[#94a3b8] mb-3">
        {filtered.length} landlord{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-[#e2e8f0]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide w-12">
                  <button onClick={() => toggleSort("rank")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E]">
                    # <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  Grade
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  Landlord
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide">
                  <button onClick={() => toggleSort("building_count")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Buildings <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#EF4444] uppercase tracking-wide">
                  <button onClick={() => toggleSort("total_violations")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Violations <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("violations_per_building")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Per Bldg <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8B5CF6] uppercase tracking-wide hidden md:table-cell">
                  <button onClick={() => toggleSort("total_litigations")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Litigations <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#64748b] uppercase tracking-wide hidden lg:table-cell">
                  <button onClick={() => toggleSort("avg_score")} className="inline-flex items-center gap-1 hover:text-[#0F1D2E] ml-auto">
                    Score <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0]">
              {filtered.map((row) => (
                <tr key={row.slug} className="hover:bg-[#f8fafc] transition-colors">
                  <td className="px-4 py-3 text-sm text-[#94a3b8] font-mono">
                    {row.rank}
                  </td>
                  <td className="px-4 py-3">
                    <LetterGrade score={GRADE_SCORES[row.grade]} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={buildPath(`/landlord/${row.slug}`)} className="group">
                      <span className="text-sm font-semibold text-[#2563EB] group-hover:underline">
                        {row.name}
                      </span>
                      {row.worst_building_address && (
                        <span className="block text-xs text-[#94a3b8] mt-0.5 truncate max-w-[200px]">
                          Worst: {row.worst_building_address}
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] text-right">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {row.building_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-right">
                    <span className={row.total_violations > 100 ? "text-[#EF4444]" : row.total_violations > 20 ? "text-[#F59E0B]" : "text-[#64748b]"}>
                      {row.total_violations.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#64748b] text-right hidden md:table-cell">
                    {row.violations_per_building}
                  </td>
                  <td className="px-4 py-3 text-sm text-right hidden md:table-cell">
                    <span className={row.total_litigations > 0 ? "text-[#8B5CF6] font-semibold" : "text-[#64748b]"}>
                      {row.total_litigations}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-[#0F1D2E] text-right hidden lg:table-cell">
                    {row.avg_score.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify file created**

Run: `ls -la src/components/landlord/LandlordRankingTable.tsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/landlord/LandlordRankingTable.tsx
git commit -m "feat(landlords): add interactive LandlordRankingTable component"
```

---

## Task 3: Create `LandlordVerdict` component

**Files:**
- Create: `src/components/landlord/LandlordVerdict.tsx`

A verdict banner that uses the landlord grade to show a colored summary card — mirrors `SafetyVerdict.tsx` from the crime page.

- [ ] **Step 1: Create the verdict component**

```typescript
// src/components/landlord/LandlordVerdict.tsx
import type { LandlordGrade } from "@/lib/landlord-stats";

interface LandlordVerdictProps {
  grade: LandlordGrade;
  verdict: string;
  avgScore: number;
  cityAvgScore: number;
}

const GRADE_CONFIG: Record<LandlordGrade, { bg: string; border: string; text: string; label: string }> = {
  A: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-800", label: "Excellent Landlord" },
  B: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-800", label: "Above Average" },
  C: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-800", label: "Average" },
  D: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-800", label: "Below Average" },
  F: { bg: "bg-red-50", border: "border-red-300", text: "text-red-800", label: "Poor Track Record" },
};

export function LandlordVerdict({ grade, verdict, avgScore, cityAvgScore }: LandlordVerdictProps) {
  const config = GRADE_CONFIG[grade];

  return (
    <div className={`${config.bg} border-l-4 ${config.border} rounded-xl p-5 mb-8`}>
      <div className="flex items-center gap-3 mb-2">
        <span className={`text-lg font-bold ${config.text}`}>
          Grade {grade} — {config.label}
        </span>
      </div>
      <p className="text-sm text-[#334155] leading-relaxed">{verdict}</p>
      <div className="mt-3 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">Portfolio Avg:</span>
          <span className="text-sm font-bold text-[#0F1D2E]">{avgScore.toFixed(1)}/10</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748b]">City Avg:</span>
          <span className="text-sm font-bold text-[#0F1D2E]">{cityAvgScore.toFixed(1)}/10</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landlord/LandlordVerdict.tsx
git commit -m "feat(landlords): add LandlordVerdict banner component"
```

---

## Task 4: Create `LandlordStatsGrid` component

**Files:**
- Create: `src/components/landlord/LandlordStatsGrid.tsx`

A 4-column stats grid with comparison bars showing the landlord's stats vs city averages. This innovates on the crime page's `CrimeStatsGrid` by adding visual comparison bars.

- [ ] **Step 1: Create the stats grid component**

```typescript
// src/components/landlord/LandlordStatsGrid.tsx
import { AlertTriangle, MessageSquare, Scale, HardHat } from "lucide-react";

interface StatItem {
  label: string;
  value: number;
  cityAvg: number;
  icon: React.ElementType;
  color: string;
  /** per-building normalized value */
  perBuilding: number;
}

interface LandlordStatsGridProps {
  totalViolations: number;
  totalComplaints: number;
  totalLitigations: number;
  totalDobViolations: number;
  buildingCount: number;
  /** City average violations per landlord */
  cityAvgViolations: number;
  cityAvgComplaints: number;
  cityAvgLitigations: number;
  cityAvgDob: number;
}

export function LandlordStatsGrid({
  totalViolations,
  totalComplaints,
  totalLitigations,
  totalDobViolations,
  buildingCount,
  cityAvgViolations,
  cityAvgComplaints,
  cityAvgLitigations,
  cityAvgDob,
}: LandlordStatsGridProps) {
  const stats: StatItem[] = [
    {
      label: "HPD Violations",
      value: totalViolations,
      cityAvg: cityAvgViolations,
      icon: AlertTriangle,
      color: "#EF4444",
      perBuilding: buildingCount > 0 ? Math.round(totalViolations / buildingCount) : 0,
    },
    {
      label: "311 Complaints",
      value: totalComplaints,
      cityAvg: cityAvgComplaints,
      icon: MessageSquare,
      color: "#F59E0B",
      perBuilding: buildingCount > 0 ? Math.round(totalComplaints / buildingCount) : 0,
    },
    {
      label: "Litigations",
      value: totalLitigations,
      cityAvg: cityAvgLitigations,
      icon: Scale,
      color: "#8B5CF6",
      perBuilding: buildingCount > 0 ? Math.round(totalLitigations / buildingCount) : 0,
    },
    {
      label: "DOB Violations",
      value: totalDobViolations,
      cityAvg: cityAvgDob,
      icon: HardHat,
      color: "#3B82F6",
      perBuilding: buildingCount > 0 ? Math.round(totalDobViolations / buildingCount) : 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const max = Math.max(stat.value, stat.cityAvg, 1);
        const valuePct = Math.min((stat.value / max) * 100, 100);
        const avgPct = Math.min((stat.cityAvg / max) * 100, 100);
        const isAbove = stat.value > stat.cityAvg;

        return (
          <div key={stat.label} className="bg-white border border-[#e2e8f0] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${stat.color}14` }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
              </div>
              <p className="text-[11px] font-semibold text-[#94a3b8] uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
            <p className="text-2xl font-bold text-[#0F1D2E]">
              {stat.value.toLocaleString()}
            </p>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              {stat.perBuilding}/bldg avg
            </p>

            {/* Comparison bars */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748b] w-12">This</span>
                <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${valuePct}%`,
                      backgroundColor: isAbove ? "#EF4444" : "#22c55e",
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#64748b] w-12">City</span>
                <div className="flex-1 h-2 bg-[#f1f5f9] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#94a3b8] rounded-full"
                    style={{ width: `${avgPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/landlord/LandlordStatsGrid.tsx
git commit -m "feat(landlords): add LandlordStatsGrid with comparison bars"
```

---

## Task 5: Rewrite landlord directory page (`/[city]/landlords`)

**Files:**
- Modify: `src/app/[city]/landlords/page.tsx` (full rewrite)

Transform from plain table with server-side pagination to crime-page-style layout: hero stats, best/worst spotlight cards, interactive client-side ranking table. Fetch landlord_stats rows (capped at 500 by total_violations desc to keep page payload reasonable) and rank client-side. If a city has more than 500 landlords, show a "View all" link that falls back to server-side paginated view.

- [ ] **Step 1: Rewrite the landlords page**

Replace the full contents of `src/app/[city]/landlords/page.tsx`. The new page should follow this layout:

```
┌─ Breadcrumbs + JsonLd
├─ Header (icon + title + subtitle)
├─ Hero Stats Grid (4 cards: Total Landlords, Avg Score, Worst Avg Violations/Bldg, Grade Distribution)
├─ Best Landlords (top 5 green spotlight cards — links to detail)
├─ Worst Landlords (bottom 5 red spotlight cards — links to detail)
├─ LandlordRankingTable (interactive, client-side search/sort/filter)
├─ FAQSection
└─ Related Links
```

Key data flow:
- Fetch all rows from `landlord_stats` where `metro = city`
- Pass to `rankLandlords()` from `landlord-stats.ts`
- Derive hero stats from the ranked array
- Pass ranked array to `LandlordRankingTable`

The page should:
- Use `cityBreadcrumbs()` for breadcrumbs
- Use `breadcrumbJsonLd()` for structured data
- Include `revalidate = 3600`
- Show grade distribution in hero stats (A/B/C/D/F counts like crime page)
- FAQ items about how grades work, what the data means

- [ ] **Step 2: Verify the page builds**

Run: `npx next build --no-lint 2>&1 | head -30`
Expected: No errors for the landlords page

- [ ] **Step 3: Commit**

```bash
git add src/app/[city]/landlords/page.tsx
git commit -m "feat(landlords): rewrite directory with hero stats, spotlights, ranking table"
```

---

## Task 6: Update landlord detail page (`/[city]/landlord/[name]`)

**Files:**
- Modify: `src/app/[city]/landlord/[name]/page.tsx`

Add the verdict banner and stats grid. Keep the existing hero header, worst buildings, trend chart, and portfolio grid — but insert the new components between them.

- [ ] **Step 1: Add imports and compute grade/verdict**

At the top of the file, add imports:
```typescript
import { landlordGrade, landlordVerdict } from "@/lib/landlord-stats";
import { LandlordVerdict } from "@/components/landlord/LandlordVerdict";
import { LandlordStatsGrid } from "@/components/landlord/LandlordStatsGrid";
```

Add `landlord_stats` query to the existing `Promise.all` on line 112 (alongside `findBuildings` and `city_avg_score`):

```typescript
const [buildings, cityAvgRpc, allLandlordStatsRes] = await Promise.all([
  findBuildings(supabase, name),
  supabase.rpc("city_avg_score", { p_metro: city }),
  supabase
    .from("landlord_stats")
    .select("avg_score, total_violations, total_complaints, total_litigations, total_dob_violations")
    .eq("metro", city),
]);
```

Then after the existing stats computation (around line 151), compute the grade and verdict:
```typescript
// Grade + Verdict
const allStats = allLandlordStatsRes.data || [];
const allScores = allStats.map(r => r.avg_score).sort((a, b) => a - b);
const scoreIndex = allScores.findIndex(s => s >= avgScore);
const percentile = allScores.length > 1
  ? Math.round((scoreIndex / (allScores.length - 1)) * 100)
  : 50;
const grade = landlordGrade(percentile);
const verdict = landlordVerdict(grade, displayName, avgScore, cityAvgScore, totalViolations, totalBuildings, totalLitigations);
```

- [ ] **Step 2: Insert verdict banner after the stats bar**

After the existing stats bar section (the `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` div), add:

```tsx
{/* Verdict */}
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
  <LandlordVerdict
    grade={grade}
    verdict={verdict}
    avgScore={avgScore}
    cityAvgScore={cityAvgScore}
  />
</div>
```

- [ ] **Step 3: Compute city average stats and add LandlordStatsGrid**

Compute city-wide per-landlord averages by adding this to the existing `Promise.all` on line 112:

```typescript
supabase
  .from("landlord_stats")
  .select("avg_score, total_violations, total_complaints, total_litigations, total_dob_violations")
  .eq("metro", city),
```

Then compute averages from the result:

```typescript
const allStats = allLandlordStatsRes.data || [];
const cityAvgViolations = allStats.length > 0
  ? Math.round(allStats.reduce((s, r) => s + r.total_violations, 0) / allStats.length)
  : 0;
const cityAvgComplaints = allStats.length > 0
  ? Math.round(allStats.reduce((s, r) => s + r.total_complaints, 0) / allStats.length)
  : 0;
const cityAvgLitigations = allStats.length > 0
  ? Math.round(allStats.reduce((s, r) => s + r.total_litigations, 0) / allStats.length)
  : 0;
const cityAvgDob = allStats.length > 0
  ? Math.round(allStats.reduce((s, r) => s + r.total_dob_violations, 0) / allStats.length)
  : 0;
```

**Important:** Add the `allLandlordStats` query AND the grade percentile computation (from Step 1) into the existing `Promise.all` to avoid request waterfalls.

Add the `LandlordStatsGrid` after the verdict banner:

```tsx
<LandlordStatsGrid
  totalViolations={totalViolations}
  totalComplaints={totalComplaints}
  totalLitigations={totalLitigations}
  totalDobViolations={totalDobViolations}
  buildingCount={totalBuildings}
  cityAvgViolations={cityAvgViolations}
  cityAvgComplaints={cityAvgComplaints}
  cityAvgLitigations={cityAvgLitigations}
  cityAvgDob={cityAvgDob}
/>
```

- [ ] **Step 4: Verify the page builds**

Run: `npx next build --no-lint 2>&1 | head -30`

- [ ] **Step 5: Commit**

```bash
git add src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(landlords): add verdict banner and stats grid to detail page"
```

---

## Task 7: Make `LandlordActionLinks` multi-city

**Files:**
- Modify: `src/components/landlord/LandlordActionLinks.tsx`

Currently hardcoded for NYC. Add city-aware links for all supported metros.

- [ ] **Step 1: Update component to accept city prop**

Add a `city` prop and use city-specific links:

```typescript
interface LandlordActionLinksProps {
  compareIds: string[];
  city: City;
}
```

Define per-city link configs:
- NYC: 311, HPD, tenant rights, compare
- Chicago: 311, BACP, tenant rights, compare
- LA: 311, LAHD, tenant rights, compare
- Houston: 311, tenant rights, compare
- Miami: 311, tenant rights, compare

- [ ] **Step 2: Update the detail page to pass city**

In `src/app/[city]/landlord/[name]/page.tsx`, update:
```tsx
<LandlordActionLinks compareIds={buildings.slice(0, 3).map((b) => b.id)} city={city} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/landlord/LandlordActionLinks.tsx src/app/[city]/landlord/[name]/page.tsx
git commit -m "feat(landlords): make action links multi-city aware"
```

---

## Task 8: Create "Worst Landlords" ranking page

**Files:**
- Create: `src/app/[city]/landlords/worst/page.tsx`

Mirrors `/crime/safest` — a dedicated ranking page with top 10 best, top 10 worst, and the full ranking table. Good for SEO ("worst landlords in NYC").

- [ ] **Step 1: Create the worst landlords page**

The page should:
- Fetch all `landlord_stats` for the city
- Run through `rankLandlords()`
- Show top 10 best (green cards) and top 10 worst (red cards, reversed)
- Show the full `LandlordRankingTable`
- Include metadata: "Worst Landlords in {city} (2026) | Lucid Rents"
- Include FAQ section
- Use `revalidate = 3600`

Layout:
```
┌─ Breadcrumbs
├─ Header
├─ Top 10 Best Landlords (green cards, 2 cols → 1 mobile)
├─ Full Ranking Table
├─ Top 10 Worst Landlords (red cards, 2 cols → 1 mobile)
├─ FAQ
└─ Related Links
```

- [ ] **Step 2: Verify the page builds**

Run: `npx next build --no-lint 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add src/app/[city]/landlords/worst/page.tsx
git commit -m "feat(landlords): add worst landlords ranking page"
```

---

## Task 9: Add OG image for worst landlords

**Files:**
- Create: `src/app/[city]/landlords/worst/opengraph-image.tsx`

Dynamic OG image mirroring the crime page's OG image pattern.

- [ ] **Step 1: Create the OG image route**

Follow the pattern from `src/app/[city]/crime/[zipCode]/opengraph-image.tsx`. Show:
- City name
- Number of landlords ranked
- Top 3 worst landlords with grades
- Branding

Use Edge runtime, `ImageResponse` from `next/og`.

- [ ] **Step 2: Commit**

```bash
git add src/app/[city]/landlords/worst/opengraph-image.tsx
git commit -m "feat(landlords): add dynamic OG image for worst landlords page"
```

---

## Task 10: Final verification and cleanup

- [ ] **Step 1: Run full build**

Run: `npx next build --no-lint`
Expected: All pages compile without errors

- [ ] **Step 2: Verify all new routes work**

Check that these routes exist in the build output:
- `/[city]/landlords` — redesigned directory
- `/[city]/landlord/[name]` — enhanced detail
- `/[city]/landlords/worst` — new ranking page

- [ ] **Step 3: Cross-link the pages**

Ensure:
- Directory page links to `/landlords/worst`
- Detail page breadcrumbs link to `/landlords`
- Worst page links back to `/landlords`
- Crime page's "Related" section links to `/landlords`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(landlords): complete landlord page redesign — crime page model"
```

---

## Innovations Over Crime Page

1. **Grade filter pills** on the ranking table (crime uses borough/area filter — landlords filter by A/B/C/D/F grade)
2. **Violations per building** normalized metric — crime has "violent %" but landlords get a fairness metric that normalizes for portfolio size
3. **Comparison bars** on the stats grid — visual bars showing landlord vs city average (crime page uses plain numbers)
4. **Verdict banner** with grade-colored left border — crime's verdict is a summary paragraph, landlords get a more prominent visual treatment
5. **Multi-city action links** — dynamic tenant resource links per city (crime page doesn't have this pattern)
