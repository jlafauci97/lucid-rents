import { Building2, Shield, MessageSquare, FileSearch } from "lucide-react";
import type { City } from "@/lib/cities";

async function getSnapshotCounts(metro?: City) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (!metro) {
    // No metro filter — use the aggregate RPC for combined counts
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/data_snapshot_counts`, {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  }

  // Metro-filtered: query each table count directly
  const headers = { apikey: apiKey, Prefer: "count=exact" };
  const metroFilter = `&metro=eq.${encodeURIComponent(metro)}`;

  const [buildingsRes, hpdRes, dobRes, complaintsRes] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/buildings?select=id${metroFilter}`, {
      headers: { ...headers, Range: "0-0" },
      next: { revalidate: 3600 },
    }),
    fetch(`${supabaseUrl}/rest/v1/hpd_violations?select=id${metroFilter}`, {
      headers: { ...headers, Range: "0-0" },
      next: { revalidate: 3600 },
    }),
    fetch(`${supabaseUrl}/rest/v1/dob_violations?select=id${metroFilter}`, {
      headers: { ...headers, Range: "0-0" },
      next: { revalidate: 3600 },
    }),
    fetch(`${supabaseUrl}/rest/v1/complaints_311?select=id${metroFilter}`, {
      headers: { ...headers, Range: "0-0" },
      next: { revalidate: 3600 },
    }),
  ]);

  // Extract counts from Content-Range header: "0-0/12345"
  function extractCount(res: Response): number {
    const range = res.headers.get("content-range") || "";
    const match = range.match(/\/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  return [{
    buildings_count: extractCount(buildingsRes),
    hpd_violations_count: extractCount(hpdRes),
    dob_violations_count: extractCount(dobRes),
    complaints_311_count: extractCount(complaintsRes),
  }];
}

interface LiveStatsProps {
  metro?: City;
}

export async function LiveStats({ metro }: LiveStatsProps = {}) {
  const data = await getSnapshotCounts(metro);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Array.isArray(data) ? data[0] : data;

  const stats = [
    {
      icon: Building2,
      label: "Buildings Tracked",
      value: raw?.buildings_count != null ? Number(raw.buildings_count).toLocaleString() : "600K+",
    },
    {
      icon: Shield,
      label: "Violations on Record",
      value: raw?.hpd_violations_count != null
        ? (Number(raw.hpd_violations_count) + Number(raw.dob_violations_count || 0)).toLocaleString()
        : "2M+",
    },
    {
      icon: MessageSquare,
      label: "311 Complaints",
      value: raw?.complaints_311_count != null ? Number(raw.complaints_311_count).toLocaleString() : "500K+",
    },
    {
      icon: FileSearch,
      label: "Data Sources",
      value: metro ? "15+" : "25+",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <stat.icon className="w-8 h-8 text-[#3B82F6] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#0F1D2E]">{stat.value}</p>
          <p className="text-sm text-[#64748b]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
