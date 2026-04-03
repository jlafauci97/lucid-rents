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

  const recentTotal = recent12.reduce(
    (sum, m) => sum + m.violations + m.complaints,
    0
  );
  const previousTotal = previous12.reduce(
    (sum, m) => sum + m.violations + m.complaints,
    0
  );

  if (previousTotal === 0 && recentTotal === 0) return "stable";
  if (previousTotal === 0) return "declining";

  const changePercent =
    ((recentTotal - previousTotal) / previousTotal) * 100;

  if (changePercent <= -10) return "improving";
  if (changePercent >= 10) return "declining";
  return "stable";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ buildingId: string }> }
) {
  try {
    const { buildingId } = await params;
    const supabase = await createClient();

    // Look up the building's metro to decide which violation table to query
    const { data: buildingRow } = await supabase
      .from("buildings")
      .select("metro")
      .eq("id", buildingId)
      .single();
    const metro = buildingRow?.metro || "nyc";
    const isChicago = metro === "chicago" || metro === "miami";

    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const cutoffDate = fiveYearsAgo.toISOString().split("T")[0];

    // For Chicago, use dob_violations (issue_date) instead of hpd_violations
    const violationsQuery = isChicago
      ? supabase
          .from("dob_violations")
          .select("issue_date")
          .eq("building_id", buildingId)
          .gte("issue_date", cutoffDate)
          .not("issue_date", "is", null)
      : supabase
          .from("hpd_violations")
          .select("inspection_date")
          .eq("building_id", buildingId)
          .gte("inspection_date", cutoffDate)
          .not("inspection_date", "is", null);

    // Fetch violations and complaints in parallel
    const [violationsRes, complaintsRes] = await Promise.all([
      violationsQuery,
      supabase
        .from("complaints_311")
        .select("created_date")
        .eq("building_id", buildingId)
        .gte("created_date", cutoffDate)
        .not("created_date", "is", null),
    ]);

    if (violationsRes.error) {
      console.error("Error fetching violations:", violationsRes.error);
      return NextResponse.json(
        { error: "Failed to fetch violation data" },
        { status: 500 }
      );
    }

    if (complaintsRes.error) {
      console.error("Error fetching complaints:", complaintsRes.error);
      return NextResponse.json(
        { error: "Failed to fetch complaint data" },
        { status: 500 }
      );
    }

    // Aggregate by month
    const monthMap = new Map<string, { violations: number; complaints: number }>();

    // Generate all months in the range so the chart has no gaps
    const now = new Date();
    const cursor = new Date(fiveYearsAgo);
    cursor.setDate(1);
    while (cursor <= now) {
      const key = getMonthKey(cursor.toISOString());
      monthMap.set(key, { violations: 0, complaints: 0 });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Count violations per month
    const dateField = isChicago ? "issue_date" : "inspection_date";
    for (const row of violationsRes.data || []) {
      const dateVal = (row as Record<string, string>)[dateField];
      if (!dateVal) continue;
      const key = getMonthKey(dateVal);
      const entry = monthMap.get(key);
      if (entry) {
        entry.violations++;
      }
    }

    // Count complaints per month
    for (const row of complaintsRes.data || []) {
      if (!row.created_date) continue;
      const key = getMonthKey(row.created_date);
      const entry = monthMap.get(key);
      if (entry) {
        entry.complaints++;
      }
    }

    // Convert to sorted array
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
    console.error("Trends API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
