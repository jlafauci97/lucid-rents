"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, MessageSquare, Star, RefreshCw, Scale, HardHat, Siren, Bug, DoorOpen, ChevronLeft, ChevronRight, DollarSign, FileCheck, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActivityItem } from "@/app/api/activity/route";
import { buildingUrl, cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import type { City } from "@/lib/cities";

/** Resolve the City key from a metro/db value. */
function metroToCity(metro?: string): City {
  if (metro && metro !== "nyc") return metro as City;
  return "nyc";
}

type FilterType = "all" | "violations" | "complaints" | "reviews" | "litigations" | "dob_violations" | "crime" | "bedbugs" | "evictions" | "la_eviction" | "tenant_buyout" | "permit" | "enforcement";

const NYC_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "violations", label: "HPD" },
  { key: "dob_violations", label: "DOB" },
  { key: "complaints", label: "311" },
  { key: "litigations", label: "Litigations" },
  { key: "crime", label: "Crime" },
  { key: "bedbugs", label: "Bedbugs" },
  { key: "evictions", label: "Evictions" },
  { key: "reviews", label: "Reviews" },
];

const LA_FILTERS: { key: FilterType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "violations", label: "LAHD" },
  { key: "dob_violations", label: "LADBS" },
  { key: "complaints", label: "311" },
  { key: "crime", label: "Crime" },
  { key: "la_eviction", label: "Evictions" },
  { key: "enforcement", label: "Enforcement" },
  { key: "permit", label: "Permits" },
  { key: "tenant_buyout", label: "Buyouts" },
];

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

/** Convert a date string to a group label: "Today", "Yesterday", or "Mar 19" */
function dateGroupLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today.getTime() - itemDay.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Group items by date and return groups with labels and counts */
function groupByDate(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const groups: { label: string; items: ActivityItem[] }[] = [];
  let currentLabel = "";

  for (const item of items) {
    const label = dateGroupLabel(item.date);
    if (label !== currentLabel) {
      currentLabel = label;
      groups.push({ label, items: [] });
    }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

/** Convert ALL-CAPS government text to sentence case */
function humanize(text: string): string {
  if (!text) return text;
  // Check if more than 60% of chars are uppercase — likely government data
  const upperCount = (text.match(/[A-Z]/g) || []).length;
  const letterCount = (text.match(/[A-Za-z]/g) || []).length;
  if (letterCount > 0 && upperCount / letterCount > 0.6) {
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }
  return text;
}

function FeedItemIcon({ type }: { type: ActivityItem["type"] }) {
  const iconMap: Record<string, { bg: string; color: string; Icon: typeof Shield }> = {
    violation: { bg: "bg-red-50", color: "text-[#EF4444]", Icon: Shield },
    complaint: { bg: "bg-amber-50", color: "text-[#F59E0B]", Icon: MessageSquare },
    review: { bg: "bg-blue-50", color: "text-[#6366F1]", Icon: Star },
    litigation: { bg: "bg-purple-50", color: "text-[#8B5CF6]", Icon: Scale },
    dob_violation: { bg: "bg-sky-50", color: "text-[#0EA5E9]", Icon: HardHat },
    crime: { bg: "bg-red-100", color: "text-[#DC2626]", Icon: Siren },
    bedbug: { bg: "bg-purple-50", color: "text-[#9333EA]", Icon: Bug },
    eviction: { bg: "bg-pink-50", color: "text-[#EC4899]", Icon: DoorOpen },
    la_eviction: { bg: "bg-pink-50", color: "text-[#EC4899]", Icon: DoorOpen },
    tenant_buyout: { bg: "bg-orange-50", color: "text-[#F97316]", Icon: DollarSign },
    permit: { bg: "bg-teal-50", color: "text-[#14B8A6]", Icon: FileCheck },
    enforcement: { bg: "bg-indigo-50", color: "text-[#6366F1]", Icon: ShieldAlert },
  };

  const entry = iconMap[type] || iconMap.violation;
  return (
    <div className={`flex-shrink-0 w-9 h-9 rounded-lg ${entry.bg} flex items-center justify-center`}>
      <entry.Icon className={`w-[18px] h-[18px] ${entry.color}`} />
    </div>
  );
}

function sourceLabel(type: ActivityItem["type"], city: string): string {
  const isLA = city === "los-angeles";
  switch (type) {
    case "violation": return isLA ? "LAHD Violation" : "HPD Violation";
    case "complaint": return isLA ? "LA 311 Complaint" : "311 Complaint";
    case "review": return "Tenant Review";
    case "litigation": return "HPD Litigation";
    case "dob_violation": return isLA ? "LADBS Violation" : "DOB Violation";
    case "crime": return isLA ? "LAPD Crime" : "NYPD Crime";
    case "bedbug": return "Bedbug Report";
    case "eviction": return "Eviction";
    case "la_eviction": return "LAHD Eviction";
    case "tenant_buyout": return "Tenant Buyout";
    case "permit": return "Building Permit";
    case "enforcement": return "LAHD Enforcement";
    case "rlto_violation": return "RLTO Violation";
    case "lead_inspection": return "Lead Inspection";
  }
}

function sourceColor(type: ActivityItem["type"]): string {
  switch (type) {
    case "violation": return "text-[#EF4444]";
    case "complaint": return "text-[#F59E0B]";
    case "review": return "text-[#6366F1]";
    case "litigation": return "text-[#8B5CF6]";
    case "dob_violation": return "text-[#0EA5E9]";
    case "crime": return "text-[#DC2626]";
    case "bedbug": return "text-[#9333EA]";
    case "eviction": return "text-[#EC4899]";
    case "la_eviction": return "text-[#EC4899]";
    case "tenant_buyout": return "text-[#F97316]";
    case "permit": return "text-[#14B8A6]";
    case "enforcement": return "text-[#6366F1]";
    case "rlto_violation": return "text-[#D97706]";
    case "lead_inspection": return "text-[#059669]";
  }
}

function severityChipClasses(cls: string): string {
  switch (cls.toUpperCase()) {
    case "C": return "bg-red-100 text-[#EF4444]";
    case "B": return "bg-amber-100 text-[#B45309]";
    case "A": return "bg-[#F5F7FA] text-[#5E6687]";
    default: return "bg-[#F5F7FA] text-[#5E6687]";
  }
}

function RatingDots({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-[7px] h-[7px] rounded-full ${
            i <= rating ? "bg-[#6366F1]" : "bg-[#e2e8f0]"
          }`}
        />
      ))}
      <span className="text-[11px] text-[#5E6687] ml-1 font-mono">{rating}/5</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="px-5 py-4 animate-pulse border-b border-[#f1f5f9]">
      <div className="flex gap-3">
        <div className="w-9 h-9 rounded-lg bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded w-28" />
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-3 bg-gray-200 rounded w-36" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </div>
      </div>
    </div>
  );
}

/** Compact feed card — address inline, no gray box */
function FeedCard({ item }: { item: ActivityItem }) {
  const itemCity = metroToCity(item.metro);
  const href = item.type === "crime" && item.zipCode
    ? cityPath(`/crime/${item.zipCode}`, itemCity)
    : item.buildingSlug
      ? buildingUrl({ borough: item.borough, slug: item.buildingSlug }, itemCity)
      : cityPath(`/building/${item.buildingId}`, itemCity);

  const address = item.buildingAddress
    ? `${item.buildingAddress}${item.borough ? `, ${item.borough}` : ""}`
    : item.borough || "";

  return (
    <Link
      href={href}
      className="flex gap-3 px-5 py-3.5 hover:bg-[#EFF6FF] transition-colors border-b border-[#f1f5f9]"
    >
      <FeedItemIcon type={item.type} />
      <div className="flex-1 min-w-0">
        {/* Meta row: source + severity + time + address */}
        <div className="flex items-center gap-1.5 flex-wrap text-[13px]">
          <span className={`font-semibold ${sourceColor(item.type)}`}>
            {sourceLabel(item.type, itemCity)}
          </span>
          {item.violationClass && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono tracking-wide ${severityChipClasses(item.violationClass)}`}>
              CLASS {item.violationClass.toUpperCase()}
            </span>
          )}
          <span className="text-[#A3ACBE]">&middot;</span>
          <span className="text-[#A3ACBE] font-mono text-xs">{timeAgo(item.date)}</span>
          {address && (
            <>
              <span className="text-[#A3ACBE]">&middot;</span>
              <span className="text-[#5E6687] truncate">{address}</span>
            </>
          )}
        </div>

        {/* Description — humanized */}
        <p className="text-sm text-[#1A1F36] leading-relaxed mt-1 line-clamp-2">
          {humanize(item.description)}
        </p>

        {/* Rating for reviews */}
        {item.type === "review" && item.rating && (
          <RatingDots rating={item.rating} />
        )}
      </div>
    </Link>
  );
}

const ITEMS_PER_PAGE = 25;

export function FeedView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const city = useCity();

  const currentPage = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
  const initialFilter = (searchParams.get("filter") || "all") as FilterType;

  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>(initialFilter);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  const fetchItems = useCallback(async (filter: FilterType, page: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const res = await fetch(`/api/activity?limit=${ITEMS_PER_PAGE}&filter=${filter}&page=${page}&city=${city}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
      if (data.counts) setFilterCounts(data.counts);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city]);

  useEffect(() => {
    fetchItems(activeFilter, currentPage);
  }, [activeFilter, currentPage, fetchItems]);

  // Auto-refresh every 4 hours (only on page 1)
  useEffect(() => {
    if (currentPage !== 1) return;
    const interval = setInterval(() => {
      fetchItems(activeFilter, 1, true);
    }, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [activeFilter, currentPage, fetchItems]);

  const navigateToPage = (page: number, filter?: FilterType) => {
    const f = filter ?? activeFilter;
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (f !== "all") params.set("filter", f);
    const qs = params.toString();
    router.push(cityPath(`/feed${qs ? `?${qs}` : ""}`, city));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFilterChange = (filter: FilterType) => {
    if (filter === activeFilter) return;
    setActiveFilter(filter);
    navigateToPage(1, filter);
  };

  const dateGroups = groupByDate(items);
  const filters = city === "los-angeles" ? LA_FILTERS : NYC_FILTERS;

  return (
    <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-2 h-2 rounded-full bg-[#22C55E] animate-ping opacity-40" />
              <span className="relative w-2 h-2 rounded-full bg-[#22C55E]" />
            </div>
            <h2 className="text-lg font-bold text-[#1A1F36]">Feed</h2>
          </div>
          <button
            onClick={() => fetchItems(activeFilter, currentPage, true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-[#EFF6FF] text-[#5E6687] hover:text-[#6366F1] transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Filter tabs with counts */}
        <div className="flex mt-2 overflow-x-auto">
          {filters.map((f) => {
            const count = filterCounts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => handleFilterChange(f.key)}
                className={`flex-1 text-sm font-medium py-3 relative transition-colors flex items-center justify-center gap-1.5 ${
                  activeFilter === f.key
                    ? "text-[#1A1F36]"
                    : "text-[#5E6687] hover:text-[#1A1F36] hover:bg-[#FAFBFD]"
                }`}
              >
                {f.label}
                {count != null && count > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                    activeFilter === f.key
                      ? "bg-[#EFF6FF] text-[#6366F1]"
                      : "bg-[#F5F7FA] text-[#A3ACBE]"
                  }`}>
                    {count}
                  </span>
                )}
                {activeFilter === f.key && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#6366F1] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Feed items grouped by date */}
      <div>
        {loading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && error && (
          <div className="px-4 py-16 text-center">
            <p className="text-[#5E6687] mb-3">Unable to load the feed right now.</p>
            <button
              onClick={() => fetchItems(activeFilter, currentPage)}
              className="text-sm text-[#6366F1] hover:text-[#4F46E5] font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-[#5E6687]">No activity to show for this filter.</p>
          </div>
        )}

        {!loading && !error && dateGroups.map((group) => (
          <div key={group.label}>
            {/* Date group header */}
            <div className="flex items-center gap-3 px-5 py-2.5 bg-[#FAFBFD] border-b border-[#f1f5f9]">
              <span className="text-[11px] font-semibold text-[#5E6687] uppercase tracking-wider font-mono">
                {group.label}
              </span>
              <div className="flex-1 h-px bg-[#e2e8f0]" />
              <span className="text-[11px] text-[#A3ACBE] font-mono">
                {group.items.length} item{group.items.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Items in this group */}
            {group.items.map((item) => (
              <FeedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        ))}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 text-sm font-medium text-[#5E6687] hover:text-[#6366F1] disabled:opacity-30 disabled:hover:text-[#5E6687] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {generatePageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#A3ACBE]">&hellip;</span>
              ) : (
                <button
                  key={p}
                  onClick={() => navigateToPage(p as number)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === currentPage
                      ? "bg-[#6366F1] text-white"
                      : "text-[#5E6687] hover:bg-[#F5F7FA] hover:text-[#1A1F36]"
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => navigateToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="flex items-center gap-1 text-sm font-medium text-[#5E6687] hover:text-[#6366F1] disabled:opacity-30 disabled:hover:text-[#5E6687] transition-colors"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");

  pages.push(total);
  return pages;
}
