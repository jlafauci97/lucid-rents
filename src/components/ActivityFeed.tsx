"use client";

import { useEffect, useState } from "react";
import { Shield, MessageSquare, Star, Scale, HardHat, Siren, Bug, DoorOpen } from "lucide-react";
import Link from "next/link";
import type { ActivityItem } from "@/app/api/activity/route";
import { buildingUrl, cityPath } from "@/lib/seo";
import { useCity } from "@/lib/city-context";
import { CITY_META } from "@/lib/cities";

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
}

function ActivityIcon({ type }: { type: ActivityItem["type"] }) {
  switch (type) {
    case "violation":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
          <Shield className="w-[18px] h-[18px] text-[#EF4444]" />
        </div>
      );
    case "complaint":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
          <MessageSquare className="w-[18px] h-[18px] text-[#F59E0B]" />
        </div>
      );
    case "review":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
          <Star className="w-[18px] h-[18px] text-[#3B82F6]" />
        </div>
      );
    case "litigation":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
          <Scale className="w-[18px] h-[18px] text-[#8B5CF6]" />
        </div>
      );
    case "dob_violation":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-sky-50 flex items-center justify-center">
          <HardHat className="w-[18px] h-[18px] text-[#0EA5E9]" />
        </div>
      );
    case "crime":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
          <Siren className="w-[18px] h-[18px] text-[#DC2626]" />
        </div>
      );
    case "bedbug":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
          <Bug className="w-[18px] h-[18px] text-[#9333EA]" />
        </div>
      );
    case "eviction":
      return (
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-pink-50 flex items-center justify-center">
          <DoorOpen className="w-[18px] h-[18px] text-[#EC4899]" />
        </div>
      );
  }
}

function typeLabel(type: ActivityItem["type"]): string {
  switch (type) {
    case "violation":
      return "HPD Violation";
    case "complaint":
      return "Complaint";
    case "review":
      return "Review";
    case "litigation":
      return "Litigation";
    case "dob_violation":
      return "DOB Violation";
    case "crime":
      return "Crime";
    case "bedbug":
      return "Bedbug Report";
    case "eviction":
      return "Eviction";
  }
}

function typeBadgeClasses(type: ActivityItem["type"]): string {
  switch (type) {
    case "violation":
      return "bg-red-50 text-[#EF4444]";
    case "complaint":
      return "bg-amber-50 text-[#F59E0B]";
    case "review":
      return "bg-blue-50 text-[#3B82F6]";
    case "litigation":
      return "bg-purple-50 text-[#8B5CF6]";
    case "dob_violation":
      return "bg-sky-50 text-[#0EA5E9]";
    case "crime":
      return "bg-red-50 text-[#DC2626]";
    case "bedbug":
      return "bg-purple-50 text-[#9333EA]";
    case "eviction":
      return "bg-pink-50 text-[#EC4899]";
  }
}

function SkeletonItem() {
  return (
    <div className="px-5 py-4 flex items-start gap-3 animate-pulse">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
      <div className="h-3 bg-gray-200 rounded w-12" />
    </div>
  );
}

export function ActivityFeed() {
  const city = useCity();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch(`/api/activity?city=${city}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        setItems(data.items ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchActivity();
    const interval = setInterval(fetchActivity, 4 * 60 * 60 * 1000); // refresh every 4 hours
    return () => clearInterval(interval);
  }, [city]);

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-2.5 h-2.5 rounded-full bg-[#22C55E] animate-ping opacity-40" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-[#22C55E]" />
          </div>
          <h3 className="text-base font-semibold text-[#0F1D2E]">
            Live Activity
          </h3>
        </div>
        <span className="text-xs text-[#64748b]">
          Across {CITY_META[city].name}
        </span>
      </div>

      {/* Feed */}
      <div className="max-h-[480px] overflow-y-auto divide-y divide-[#f1f5f9]">
        {loading && (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        )}

        {!loading && error && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#64748b]">
              Unable to load activity feed right now.
            </p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#64748b]">
              No recent activity to display.
            </p>
          </div>
        )}

        {!loading &&
          !error &&
          items.map((item) => (
            <Link
              key={`${item.type}-${item.id}`}
              href={item.type === "crime" && item.zipCode ? cityPath(`/crime/${item.zipCode}`, city) : item.buildingSlug ? buildingUrl({ borough: item.borough, slug: item.buildingSlug }, city) : cityPath(`/building/${item.buildingId}`, city)}
              className="block px-5 py-4 hover:bg-[#EFF6FF] transition-colors"
            >
              <div className="flex items-start gap-3">
                <ActivityIcon type={item.type} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${typeBadgeClasses(item.type)}`}
                    >
                      {typeLabel(item.type)}
                    </span>
                    <span className="text-[11px] text-[#94a3b8]">
                      {timeAgo(item.date)}
                    </span>
                  </div>
                  <p className="text-sm text-[#0F1D2E] leading-snug line-clamp-2">
                    {item.description}
                  </p>
                  <p className="text-xs text-[#64748b] mt-1 truncate">
                    {item.buildingAddress}
                    {item.borough ? `, ${item.borough}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}
