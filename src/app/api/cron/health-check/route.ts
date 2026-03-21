import { NextResponse } from "next/server";

export const maxDuration = 60;
export const revalidate = 0;

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lucidrents.com";

const ROUTES_TO_CHECK = [
  // Core pages
  "/",
  "/about",
  "/login",
  // NYC routes
  "/nyc/search",
  "/nyc/buildings",
  "/nyc/buildings/manhattan",
  "/nyc/buildings/brooklyn",
  "/nyc/buildings/queens",
  "/nyc/buildings/bronx",
  "/nyc/buildings/staten-island",
  "/nyc/worst-rated-buildings",
  "/nyc/landlords",
  "/nyc/crime",
  "/nyc/feed",
  "/nyc/news",
  "/nyc/news/tenant-rights",
  "/nyc/energy",
  "/nyc/permits",
  "/nyc/scaffolding",
  "/nyc/rent-stabilization",
  "/nyc/rent-data",
  "/nyc/transit",
  "/nyc/tenant-rights",
  "/nyc/compare",
  // Sample building pages
  "/nyc/building/bronx/1412-fteley-avenue-bronx-ny-10472",
  "/nyc/building/brooklyn/1749-49-street-brooklyn-ny-11204",
  "/nyc/building/manhattan/140-nagle-avenue-manhattan-ny-10040",
  // LA routes
  "/CA/Los-Angeles/search",
  "/CA/Los-Angeles/buildings",
  "/CA/Los-Angeles/worst-rated-buildings",
  "/CA/Los-Angeles/landlords",
  "/CA/Los-Angeles/building/lincoln-heights/2312-n-griffin-ave-los-angeles-ca-90031",
  "/CA/Los-Angeles/building/downtown/100-n-santa-fe-ave-los-angeles-ca-90012",
];

interface RouteResult {
  path: string;
  status: number;
  ok: boolean;
  responseTimeMs: number;
}

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const results: RouteResult[] = [];
  const failures: RouteResult[] = [];

  // Check all routes in parallel (batched to avoid overwhelming the server)
  const batchSize = 10;
  for (let i = 0; i < ROUTES_TO_CHECK.length; i += batchSize) {
    const batch = ROUTES_TO_CHECK.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (path): Promise<RouteResult> => {
        const routeStart = Date.now();
        try {
          const res = await fetch(`${BASE_URL}${path}`, {
            method: "HEAD",
            redirect: "follow",
            signal: AbortSignal.timeout(15000),
          });
          const result: RouteResult = {
            path,
            status: res.status,
            ok: res.status >= 200 && res.status < 400,
            responseTimeMs: Date.now() - routeStart,
          };
          if (!result.ok) failures.push(result);
          return result;
        } catch {
          const result: RouteResult = {
            path,
            status: 0,
            ok: false,
            responseTimeMs: Date.now() - routeStart,
          };
          failures.push(result);
          return result;
        }
      })
    );
    results.push(...batchResults);
  }

  const totalTime = Date.now() - startTime;
  const healthy = results.filter((r) => r.ok).length;
  const slow = results.filter((r) => r.responseTimeMs > 10000);

  // Log failures for Vercel function logs
  if (failures.length > 0) {
    console.error(
      `[health-check] ${failures.length} route failures:`,
      failures.map((f) => `${f.status} ${f.path}`).join(", ")
    );
  }
  if (slow.length > 0) {
    console.warn(
      `[health-check] ${slow.length} slow routes (>10s):`,
      slow.map((s) => `${s.responseTimeMs}ms ${s.path}`).join(", ")
    );
  }

  return NextResponse.json({
    status: failures.length === 0 ? "healthy" : "degraded",
    checkedAt: new Date().toISOString(),
    totalTimeMs: totalTime,
    summary: {
      total: results.length,
      healthy,
      failed: failures.length,
      slow: slow.length,
    },
    failures: failures.length > 0 ? failures : undefined,
    slowRoutes: slow.length > 0 ? slow : undefined,
  });
}
