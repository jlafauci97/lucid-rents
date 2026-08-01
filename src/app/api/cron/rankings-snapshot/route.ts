// Writes the current month's frozen ranking snapshots for every live city.
// Runs on the 1st. Re-running is a no-op: a published ranking is never
// recalculated, because anything citing it would silently become wrong.

import { NextRequest, NextResponse } from "next/server";
import { VALID_CITIES, type City } from "@/lib/cities";
import {
  generateSnapshot,
  currentPeriod,
  isValidPeriod,
  SNAPSHOT_KINDS,
} from "@/lib/marketing/ranking-snapshots";

export const maxDuration = 300;
export const revalidate = 0;

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const periodParam = req.nextUrl.searchParams.get("period");
  if (periodParam && !isValidPeriod(periodParam)) {
    return NextResponse.json({ error: "period must be YYYY-MM" }, { status: 400 });
  }
  const period = periodParam ?? currentPeriod();

  const cityParam = req.nextUrl.searchParams.get("city") as City | null;
  const cities = cityParam ? [cityParam] : VALID_CITIES;
  if (cityParam && !VALID_CITIES.includes(cityParam)) {
    return NextResponse.json(
      { error: `city must be one of ${VALID_CITIES.join(", ")}` },
      { status: 400 }
    );
  }

  const created: string[] = [];
  const skipped: { key: string; reason: string }[] = [];

  for (const city of cities) {
    for (const kind of SNAPSHOT_KINDS) {
      const key = `${city}/${kind}`;
      try {
        const result = await generateSnapshot(kind, city, period);
        if (result.created) created.push(key);
        else skipped.push({ key, reason: result.reason ?? "unknown" });
      } catch (err) {
        skipped.push({ key, reason: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  console.log(
    `[cron/rankings-snapshot] period=${period} created=${created.length} skipped=${skipped.length}`
  );

  return NextResponse.json({ ok: true, period, created, skipped });
}
