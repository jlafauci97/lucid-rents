import { NextResponse } from "next/server";
import { requireMissionControl } from "@/lib/mission-control/auth";
import { getHubStats } from "@/lib/mission-control/stats";
import { fetchSyncsOk } from "@/lib/mission-control/syncs-health";

export async function GET() {
  try {
    await requireMissionControl();
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const [stats, syncsOk] = await Promise.all([getHubStats(), fetchSyncsOk()]);
  return NextResponse.json({ ...stats, syncsOk }, {
    headers: { "Cache-Control": "no-store" },
  });
}
