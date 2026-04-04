import { Building2, Shield, MessageSquare, FileSearch } from "lucide-react";
import type { City } from "@/lib/cities";

async function getSnapshotCounts(metro?: City) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const countHeaders = { apikey: apiKey, Prefer: "count=exact" };

  // Always use aggregate RPC for violation/complaint counts (works for all metros)
  const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/data_snapshot_counts`, {
    method: "POST",
    headers: { apikey: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({}),
    next: { revalidate: 3600 },
  });

  const rpcData = rpcRes.ok ? await rpcRes.json() : null;

  // For buildings count, filter by metro if provided
  if (metro) {
    const buildingsRes = await fetch(
      `${supabaseUrl}/rest/v1/buildings?select=id&metro=eq.${encodeURIComponent(metro)}`,
      { headers: { ...countHeaders, Range: "0-0" }, next: { revalidate: 3600 } }
    );
    const range = buildingsRes.headers.get("content-range") || "";
    const match = range.match(/\/(\d+)/);
    const metroBuildings = match ? parseInt(match[1], 10) : 0;

    const base = Array.isArray(rpcData) ? rpcData[0] : rpcData;
    return [{ ...base, buildings_count: metroBuildings || base?.buildings_count }];
  }

  return rpcData;
}

interface LiveStatsProps {
  metro?: City;
}

export async function LiveStats({ metro }: LiveStatsProps = {}) {
  const data = await getSnapshotCounts(metro);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any = Array.isArray(data) ? data[0] : data;

  const buildings = Number(raw?.buildings_count || 0);
  const hpd = Number(raw?.hpd_violations_count || 0);
  const dob = Number(raw?.dob_violations_count || 0);
  const complaints = Number(raw?.complaints_311_count || 0);

  const stats = [
    {
      icon: Building2,
      label: "Buildings Tracked",
      value: buildings > 0 ? buildings.toLocaleString() : "600K+",
    },
    {
      icon: Shield,
      label: "Violations on Record",
      value: hpd + dob > 0 ? (hpd + dob).toLocaleString() : "2M+",
    },
    {
      icon: MessageSquare,
      label: "311 Complaints",
      value: complaints > 0 ? complaints.toLocaleString() : "500K+",
    },
    {
      icon: FileSearch,
      label: "Data Sources",
      value: "25+",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {stats.map((stat) => (
        <div key={stat.label} className="text-center">
          <stat.icon className="w-8 h-8 text-[#6366F1] mx-auto mb-2" />
          <p className="text-2xl font-bold text-[#1A1F36]">{stat.value}</p>
          <p className="text-sm text-[#5E6687]">{stat.label}</p>
        </div>
      ))}
    </div>
  );
}
