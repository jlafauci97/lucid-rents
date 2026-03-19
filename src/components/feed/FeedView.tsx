"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, MessageSquare, Star, MapPin, ExternalLink, RefreshCw, Scale, HardHat, Siren, Bug, DoorOpen, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ActivityItem } from "@/app/api/activity/route";
import { buildingUrl, cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";

type FilterType = "all" | "violations" | "complaints" | "reviews" | "litigations" | "dob_violations" | "crime" | "bedbugs" | "evictions";

const filters: { key: FilterType; label: string }[] = [
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

function FeedItemIcon({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "violation":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-[#EF4444]" />
        </div>
      );
    case "complaint":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-[#F59E0B]" />
        </div>
      );
    case "review":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <Star className="w-5 h-5 text-[#3B82F6]" />
        </div>
      );
    case "litigation":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Scale className="w-5 h-5 text-[#8B5CF6]" />
        </div>
      );
    case "dob_violation":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center">
          <HardHat className="w-5 h-5 text-[#0EA5E9]" />
        </div>
      );
    case "crime":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
          <Siren className="w-5 h-5 text-[#DC2626]" />
        </div>
      );
    case "bedbug":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
          <Bug className="w-5 h-5 text-[#9333EA]" />
        </div>
      );
    case "eviction":
      return (
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
          <DoorOpen className="w-5 h-5 text-[#EC4899]" />
        </div>
      );
  }
}

function sourceLabel(type: ActivityItem["type"]): string {
  switch (type) {
    case "violation": return "HPD Violation";
    case "complaint": return "311 Complaint";
    case "review": return "Tenant Review";
    case "litigation": return "HPD Litigation";
    case "dob_violation": return "DOB Violation";
    case "crime": return "NYPD Crime";
    case "bedbug": return "Bedbug Report";
    case "eviction": return "Eviction";
  }
}

function sourceColor(type: ActivityItem["type"]): string {
  switch (type) {
    case "violation": return "text-[#EF4444]";
    case "complaint": return "text-[#F59E0B]";
    case "review": return "text-[#3B82F6]";
    case "litigation": return "text-[#8B5CF6]";
    case "dob_violation": return "text-[#0EA5E9]";
    case "crime": return "text-[#DC2626]";
    case "bedbug": return "text-[#9333EA]";
    case "eviction": return "text-[#EC4899]";
  }
}

function RatingDots({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${
            i <= rating ? "bg-[#3B82F6]" : "bg-[#e2e8f0]"
          }`}
        />
      ))}
      <span className="text-xs text-[#64748b] ml-1">{rating}/5</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="px-4 py-5 animate-pulse">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-4 bg-gray-200 rounded w-32" />
            <div className="h-3 bg-gray-200 rounded w-16" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-full" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="flex items-center gap-2 mt-2">
            <div className="h-3 bg-gray-200 rounded w-40" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedCard({ item }: { item: ActivityItem }) {
  const city = useCity();
  const href = item.type === "crime" && item.zipCode
    ? cityPath(`/crime/${item.zipCode}`, city)
    : item.buildingSlug
      ? buildingUrl({ borough: item.borough, slug: item.buildingSlug }, city)
      : cityPath(`/building/${item.buildingId}`, city);

  return (
    <Link
      href={href}
      className="block px-4 py-5 hover:bg-[#f8fafc] transition-colors border-b border-[#f1f5f9] group"
    >
      <div className="flex gap-3">
        <FeedItemIcon type={item.type} />
        <div className="flex-1 min-w-0">
          {/* Header row: source + borough + time */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-sm font-semibold ${sourceColor(item.type)}`}>
              {sourceLabel(item.type)}
            </span>
            {item.violationClass && (
              <span className="text-xs font-medium bg-red-50 text-[#EF4444] px-1.5 py-0.5 rounded">
                Class {item.violationClass}
              </span>
            )}
            <span className="text-[#94a3b8]">&middot;</span>
            <span className="text-sm text-[#94a3b8]">{timeAgo(item.date)}</span>
          </div>

          {/* Description */}
          <p className="text-[15px] text-[#0F1D2E] leading-relaxed mt-1.5">
            {item.description}
          </p>

          {/* Rating for reviews */}
          {item.type === "review" && item.rating && (
            <RatingDots rating={item.rating} />
          )}

          {/* Building location card */}
          <div className="mt-3 flex items-center justify-between bg-[#f8fafc] group-hover:bg-white border border-[#e2e8f0] rounded-lg px-3 py-2.5 transition-colors">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-3.5 h-3.5 text-[#3B82F6] flex-shrink-0" />
              <span className="text-sm text-[#0F1D2E] font-medium truncate">
                {item.buildingAddress}
              </span>
              {item.borough && (
                <span className="text-xs text-[#94a3b8] flex-shrink-0">{item.borough}</span>
              )}
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[#94a3b8] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>
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

  const fetchItems = useCallback(async (filter: FilterType, page: number, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(false);

    try {
      const res = await fetch(`/api/activity?limit=${ITEMS_PER_PAGE}&filter=${filter}&page=${page}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setItems(data.items ?? []);
      setTotalPages(data.totalPages ?? 1);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchItems(activeFilter, currentPage);
  }, [activeFilter, currentPage, fetchItems]);

  // Auto-refresh every 2 minutes (only on page 1)
  useEffect(() => {
    if (currentPage !== 1) return;
    const interval = setInterval(() => {
      fetchItems(activeFilter, 1, true);
    }, 120000);
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

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      {/* Header with tabs */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-[#e2e8f0]">
        <div className="flex items-center justify-between px-4 pt-4 pb-0">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-2 h-2 rounded-full bg-[#22C55E] animate-ping opacity-40" />
              <span className="relative w-2 h-2 rounded-full bg-[#22C55E]" />
            </div>
            <h2 className="text-lg font-bold text-[#0F1D2E]">Feed</h2>
          </div>
          <button
            onClick={() => fetchItems(activeFilter, currentPage, true)}
            disabled={refreshing}
            className="p-2 rounded-full hover:bg-[#EFF6FF] text-[#64748b] hover:text-[#3B82F6] transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex mt-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key)}
              className={`flex-1 text-sm font-medium py-3 relative transition-colors ${
                activeFilter === f.key
                  ? "text-[#0F1D2E]"
                  : "text-[#64748b] hover:text-[#0F1D2E] hover:bg-[#f8fafc]"
              }`}
            >
              {f.label}
              {activeFilter === f.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-[3px] bg-[#3B82F6] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Feed items */}
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
            <p className="text-[#64748b] mb-3">Unable to load the feed right now.</p>
            <button
              onClick={() => fetchItems(activeFilter, currentPage)}
              className="text-sm text-[#3B82F6] hover:text-[#2563EB] font-medium"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="text-[#64748b]">No activity to show for this filter.</p>
          </div>
        )}

        {!loading && !error && items.map((item) => (
          <FeedCard key={`${item.type}-${item.id}`} item={item} />
        ))}
      </div>

      {/* Pagination */}
      {!loading && !error && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-4 border-t border-[#e2e8f0]">
          <button
            onClick={() => navigateToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="flex items-center gap-1 text-sm font-medium text-[#64748b] hover:text-[#3B82F6] disabled:opacity-30 disabled:hover:text-[#64748b] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {generatePageNumbers(currentPage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`ellipsis-${i}`} className="px-2 text-sm text-[#94a3b8]">&hellip;</span>
              ) : (
                <button
                  key={p}
                  onClick={() => navigateToPage(p as number)}
                  className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-colors ${
                    p === currentPage
                      ? "bg-[#3B82F6] text-white"
                      : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0F1D2E]"
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
            className="flex items-center gap-1 text-sm font-medium text-[#64748b] hover:text-[#3B82F6] disabled:opacity-30 disabled:hover:text-[#64748b] transition-colors"
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
