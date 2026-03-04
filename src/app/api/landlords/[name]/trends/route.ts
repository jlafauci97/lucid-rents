import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface MonthData {
  month: string;
  violations: number;
  complaints: number;
}

interface TrendResponse {
  months: MonthData[];
  trend: "improving" | "declining" | "stable";
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function calculateTrend(months: MonthData[]): "improving" | "declining" | "stable" {
  if (months.length < 13) return "stable";

  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const recent12 = sorted.slice(-12);
  const previous12 = sorted.slice(-24, -12);

  if (previous12.length === 0) return "stable";

  const recentTotal = recent12.reduce((sum, m) => sum + m.violations + m.complaints, 0);
  const previousTotal = previous12.reduce((sum, m) => sum + m.violations + m.complaints, 0);

  if (previousTotal === 0 && recentTotal === 0) return "stable";
  if (previousTotal === 0) return "declining";

  const changePercent = ((recentTotal - previousTotal) / previousTotal) * 100;
  if (changePercent <= -10) return "improving";
  if (changePercent >= 10) return "declining";
  return "stable";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const { name } = await params;
    const ownerName = decodeURIComponent(name);
    const supabase = await createClient();

    // Get building IDs for this landlord
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id")
      .ilike("owner_name", ownerName);

    if (!buildings || buildings.length === 0) {
      return NextResponse.json({ months: [], trend: "stable" });
    }

    const buildingIds = buildings.map((b) => b.id);

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const cutoffDate = twoYearsAgo.toISOString().split("T")[0];

    // Fetch violations and complaints in parallel
    const [violationsRes, complaintsRes] = await Promise.all([
      supabase
        .from("hpd_violations")
        .select("inspection_date")
        .in("building_id", buildingIds)
        .gte("inspection_date", cutoffDate)
        .not("inspection_date", "is", null),
      supabase
        .from("complaints_311")
        .select("created_date")
        .in("building_id", buildingIds)
        .gte("created_date", cutoffDate)
        .not("created_date", "is", null),
    ]);

    // Generate all months
    const monthMap = new Map<string, { violations: number; complaints: number }>();
    const now = new Date();
    const cursor = new Date(twoYearsAgo);
    cursor.setDate(1);
    while (cursor <= now) {
      const key = getMonthKey(cursor.toISOString());
      monthMap.set(key, { violations: 0, complaints: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const row of violationsRes.data || []) {
      if (!row.inspection_date) continue;
      const key = getMonthKey(row.inspection_date);
      const entry = monthMap.get(key);
      if (entry) entry.violations++;
    }

    for (const row of complaintsRes.data || []) {
      if (!row.created_date) continue;
      const key = getMonthKey(row.created_date);
      const entry = monthMap.get(key);
      if (entry) entry.complaints++;
    }

    const months: MonthData[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, counts]) => ({
        month,
        violations: counts.violations,
        complaints: counts.complaints,
      }));

    const trend = calculateTrend(months);
    const response: TrendResponse = { months, trend };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Landlord trends API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
