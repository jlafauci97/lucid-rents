import { Building2, Shield, MessageSquare, FileSearch } from "lucide-react";

async function getSnapshotCounts() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/data_snapshot_counts`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function LiveStats() {
  const data = await getSnapshotCounts();

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
      value: "4",
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
