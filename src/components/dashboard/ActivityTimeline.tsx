import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildingUrl } from "@/lib/seo";
import { formatRelativeDate } from "@/lib/utils";
import { AlertTriangle, MessageSquare } from "lucide-react";

interface MonitoredBuilding {
  id: string;
  full_address: string;
  borough: string;
  slug: string;
}

interface TimelineItem {
  id: string;
  type: "violation" | "complaint";
  date: string;
  description: string;
  building: MonitoredBuilding;
}

export async function ActivityTimeline({
  buildingIds,
}: {
  buildingIds: string[];
}) {
  if (buildingIds.length === 0) {
    return (
      <p className="text-sm text-[#64748b] text-center py-6">
        No monitored buildings yet. Visit a building page and click
        &quot;Monitor&quot; to start tracking activity.
      </p>
    );
  }

  const supabase = await createClient();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString().split("T")[0];

  // Fetch violations and complaints in parallel
  const [violationsRes, complaintsRes] = await Promise.all([
    supabase
      .from("hpd_violations")
      .select(
        "id, class, nov_description, nov_issue_date, building:buildings!inner(id, full_address, borough, slug)"
      )
      .in("building_id", buildingIds)
      .gte("nov_issue_date", cutoff)
      .order("nov_issue_date", { ascending: false })
      .limit(15),
    supabase
      .from("complaints_311")
      .select(
        "id, complaint_type, descriptor, created_date, building:buildings!inner(id, full_address, borough, slug)"
      )
      .in("building_id", buildingIds)
      .gte("created_date", cutoff)
      .order("created_date", { ascending: false })
      .limit(15),
  ]);

  const violations = violationsRes.data || [];
  const complaints = complaintsRes.data || [];

  const items: TimelineItem[] = [];

  for (const v of violations) {
    const b = v.building as unknown as MonitoredBuilding;
    if (!b) continue;
    const classLabel = v.class ? `Class ${v.class}` : "Violation";
    const desc = v.nov_description
      ? `${classLabel}: ${v.nov_description}`
      : classLabel;
    items.push({
      id: `v-${v.id}`,
      type: "violation",
      date: v.nov_issue_date || "",
      description: desc,
      building: b,
    });
  }

  for (const c of complaints) {
    const b = c.building as unknown as MonitoredBuilding;
    if (!b) continue;
    const desc = [c.complaint_type, c.descriptor].filter(Boolean).join(": ");
    items.push({
      id: `c-${c.id}`,
      type: "complaint",
      date: c.created_date || "",
      description: desc || "311 Complaint",
      building: b,
    });
  }

  // Sort by date descending, take top 15
  items.sort((a, b) => (b.date > a.date ? 1 : -1));
  const timeline = items.slice(0, 15);

  if (timeline.length === 0) {
    return (
      <p className="text-sm text-[#64748b] text-center py-6">
        No recent activity on your monitored buildings.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[#e2e8f0]" />

      <div className="space-y-4">
        {timeline.map((item) => (
          <div key={item.id} className="relative flex items-start gap-4 pl-10">
            {/* Icon dot */}
            <div
              className={`absolute left-1.5 top-0.5 w-5 h-5 rounded-full flex items-center justify-center ${
                item.type === "violation"
                  ? "bg-red-100"
                  : "bg-amber-100"
              }`}
            >
              {item.type === "violation" ? (
                <AlertTriangle className="w-3 h-3 text-red-600" />
              ) : (
                <MessageSquare className="w-3 h-3 text-amber-600" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <Link
                href={buildingUrl(item.building)}
                className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB] hover:underline"
              >
                {item.building.full_address}
              </Link>
              <p className="text-sm text-[#0F1D2E] mt-0.5 line-clamp-2">
                {item.description}
              </p>
              <p className="text-xs text-[#94a3b8] mt-1">
                {item.date ? formatRelativeDate(item.date) : "Unknown date"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
