import { NextResponse } from "next/server";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { getHubStats } from "@/lib/mission-control/stats";

export async function GET() {
  try {
    await requireMissionControl();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const stats = await getHubStats();
  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
