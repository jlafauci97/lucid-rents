import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CrimeTrendMonth {
  month: string;
  violent: number;
  property: number;
  quality_of_life: number;
  total: number;
}

function calculateTrend(
  months: CrimeTrendMonth[]
): "improving" | "declining" | "stable" {
  if (months.length < 6) return "stable";

  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const recent6 = sorted.slice(-6);
  const previous6 = sorted.slice(-12, -6);

  if (previous6.length === 0) return "stable";

  const recentTotal = recent6.reduce((sum, m) => sum + m.total, 0);
  const previousTotal = previous6.reduce((sum, m) => sum + m.total, 0);

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
  { params }: { params: Promise<{ zipCode: string }> }
) {
  try {
    const { zipCode } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("crime_zip_trends", {
      target_zip: zipCode,
    });

    if (error) {
      console.error("crime_zip_trends RPC error:", error);
      return NextResponse.json(
        { error: "Failed to fetch crime trends" },
        { status: 500 }
      );
    }

    const months: CrimeTrendMonth[] = (data || []).map(
      (row: { month: string; violent: number; property: number; quality_of_life: number; total: number }) => ({
        month: row.month,
        violent: Number(row.violent),
        property: Number(row.property),
        quality_of_life: Number(row.quality_of_life),
        total: Number(row.total),
      })
    );

    const trend = calculateTrend(months);

    return NextResponse.json({ months, trend });
  } catch (error) {
    console.error("Crime trends API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
