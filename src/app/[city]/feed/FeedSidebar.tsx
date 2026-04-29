import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Shield, MessageSquare, Building2, Scale, HardHat, TrendingUp, ChevronRight } from "lucide-react";
import { buildingUrl, cityPath } from "@/lib/seo";
import type { City } from "@/lib/cities";

export async function FeedStats({ city }: { city: City }) {
  const supabase = await createClient();

  const { data } = await supabase.rpc("data_snapshot_counts", { p_metro: city }).single();

  const counts = data as {
    hpd_violations_count: number;
    complaints_311_count: number;
    buildings_count: number;
    hpd_litigations_count: number;
    dob_violations_count: number;
  } | null;

  const stats = [
    { icon: Shield, label: "Housing Violations", count: counts?.hpd_violations_count ?? 0, color: "text-[#EF4444]", bg: "bg-red-50" },
    { icon: MessageSquare, label: "311 Complaints", count: counts?.complaints_311_count ?? 0, color: "text-[#F59E0B]", bg: "bg-amber-50" },
    { icon: Scale, label: "Litigations", count: counts?.hpd_litigations_count ?? 0, color: "text-[#8B5CF6]", bg: "bg-purple-50" },
    { icon: HardHat, label: "Building Violations", count: counts?.dob_violations_count ?? 0, color: "text-[#3B82F6]", bg: "bg-blue-50" },
    { icon: Building2, label: "Buildings Tracked", count: counts?.buildings_count ?? 0, color: "text-[#0F1D2E]", bg: "bg-gray-100" },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <h3 className="text-sm font-bold text-[#0F1D2E]">Data Snapshot</h3>
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-3 px-4 py-3">
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div className="flex-1">
              <p className="text-xs text-[#64748b]">{stat.label}</p>
              <p className="text-sm font-bold text-[#0F1D2E]">
                {stat.count.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export async function TrendingBuildings({ city }: { city: City }) {
  const supabase = await createClient();

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, full_address, borough, slug, violation_count, complaint_count")
    .eq("metro", city)
    .order("violation_count", { ascending: false })
    .limit(5);

  if (!buildings || buildings.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#e2e8f0]">
        <h3 className="text-sm font-bold text-[#0F1D2E] flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-[#3B82F6]" />
          Most Flagged Buildings
        </h3>
      </div>
      <div className="divide-y divide-[#f1f5f9]">
        {buildings.map((b, i) => (
          <Link
            key={b.id}
            href={buildingUrl(b, city)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#f8fafc] transition-colors group"
          >
            <span className="text-xs font-bold text-[#94a3b8] mt-0.5 w-4">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0F1D2E] truncate group-hover:text-[#3B82F6] transition-colors">
                {b.full_address}
              </p>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                {b.borough} &middot; {b.violation_count} violations &middot; {b.complaint_count} complaints
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#e2e8f0] group-hover:text-[#3B82F6] flex-shrink-0 mt-0.5 transition-colors" />
          </Link>
        ))}
      </div>
      <Link
        href={cityPath("/building-rankings", city)}
        className="block px-4 py-3 text-sm text-[#3B82F6] hover:bg-[#EFF6FF] transition-colors font-medium border-t border-[#f1f5f9]"
      >
        View full rankings
      </Link>
    </div>
  );
}
