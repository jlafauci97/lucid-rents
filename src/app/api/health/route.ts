import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { City } from "@/lib/cities";

export const revalidate = 0;
export const maxDuration = 30;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface SyncCheck {
  sync_type: string;
  status: "healthy" | "warning" | "error";
  last_run: string | null;
  last_status: string | null;
  records_added: number;
  records_linked: number;
  hours_since_sync: number | null;
  error_preview: string | null;
  schedule: string;
  category: "daily" | "twice_daily" | "monthly";
}

interface DataCheck {
  name: string;
  label: string;
  status: "healthy" | "warning" | "error";
  row_count: number;
  latest_record: string | null;
  details: string;
  category: "core" | "violations" | "supplemental";
}

interface RpcCheck {
  name: string;
  status: "healthy" | "error";
  response_time_ms: number;
  row_count: number;
  error: string | null;
}

interface PageCheck {
  path: string;
  label: string;
  category: "public" | "data" | "dashboard";
  city?: City | "all";
}

interface SyncTypeDef {
  type: string;
  schedule: string;
  category: "daily" | "twice_daily" | "monthly";
  warnHours: number;
  city: City | "all";
}

const syncTypeDefs: SyncTypeDef[] = [
  // NYC syncs
  { type: "hpd_violations", schedule: "Daily 5:00 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "complaints_311", schedule: "Daily 5:10 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "hpd_litigations", schedule: "Daily 5:20 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "dob_violations", schedule: "Daily 5:30 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "nypd_complaints", schedule: "Daily 5:40 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "bedbug_reports", schedule: "Daily 5:50 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "evictions", schedule: "Daily 6:00 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "sidewalk_sheds", schedule: "Daily 6:20 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "dob_permits", schedule: "Daily 6:30 AM UTC", category: "daily", warnHours: 26, city: "nyc" },
  { type: "link", schedule: "Daily 7:00 AM UTC", category: "daily", warnHours: 26, city: "all" },
  { type: "news", schedule: "Daily 6:10 AM & 6:00 PM UTC", category: "twice_daily", warnHours: 14, city: "all" },
  { type: "rent_stabilization", schedule: "1st of month 7:00 AM UTC", category: "monthly", warnHours: 744, city: "nyc" },
  { type: "zillow_rents", schedule: "1st of month 7:30 AM UTC", category: "monthly", warnHours: 744, city: "all" },
  { type: "energy", schedule: "1st of month 8:00 AM UTC", category: "monthly", warnHours: 744, city: "nyc" },
  { type: "transit", schedule: "1st of month 9:00 AM UTC", category: "monthly", warnHours: 744, city: "all" },
  { type: "schools", schedule: "1st of month 9:30 AM UTC", category: "monthly", warnHours: 744, city: "all" },
  // LA syncs
  { type: "lahd_violations", schedule: "Daily 5:00 AM UTC", category: "daily", warnHours: 26, city: "los-angeles" },
  { type: "la_311_complaints", schedule: "Daily 5:10 AM UTC", category: "daily", warnHours: 26, city: "los-angeles" },
  { type: "ladbs_violations", schedule: "Daily 5:20 AM UTC", category: "daily", warnHours: 26, city: "los-angeles" },
  { type: "lapd_complaints", schedule: "Daily 5:30 AM UTC", category: "daily", warnHours: 26, city: "los-angeles" },
  { type: "la_permits", schedule: "Daily 5:40 AM UTC", category: "daily", warnHours: 26, city: "los-angeles" },
];

interface TableDef {
  name: string;
  label: string;
  dateCol: string | null;
  countOnly: boolean;
  warnHours: number;
  category: "core" | "violations" | "supplemental";
  city: City | "all";
}

const tableDefs: TableDef[] = [
  { name: "buildings", label: "Buildings", dateCol: null, countOnly: true, warnHours: 48, category: "core", city: "all" },
  { name: "reviews", label: "Reviews", dateCol: "created_at", countOnly: true, warnHours: 48, category: "core", city: "all" },
  // NYC violations
  { name: "hpd_violations", label: "HPD Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "dob_violations", label: "DOB Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "complaints_311", label: "311 Complaints", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "nypd_complaints", label: "NYPD Complaints", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "hpd_litigations", label: "HPD Litigations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "dob_permits", label: "DOB Permits", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "sidewalk_sheds", label: "Sidewalk Sheds", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "evictions", label: "Evictions", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  { name: "bedbug_reports", label: "Bedbug Reports", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "nyc" },
  // LA violations (tables will be created when LA data pipeline is built)
  { name: "lahd_violations", label: "LAHD Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "los-angeles" },
  { name: "ladbs_violations", label: "LADBS Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "los-angeles" },
  { name: "lapd_complaints", label: "LAPD Complaints", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations", city: "los-angeles" },
  // Shared supplemental
  { name: "news_articles", label: "News Articles", dateCol: "published_at", countOnly: false, warnHours: 24, category: "supplemental", city: "all" },
  { name: "rent_stabilization", label: "Rent Stabilization", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "nyc" },
  { name: "building_rents", label: "Building Rents", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "all" },
  { name: "energy_benchmarks", label: "Energy Benchmarks", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "nyc" },
  { name: "transit_stops", label: "Transit Stops", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "all" },
  { name: "schools", label: "Schools", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "all" },
  { name: "unit_listings", label: "Unit Listings", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental", city: "all" },
];

const rpcNames = [
  "permits_recent",
  "permit_stats",
  "scaffolding_stats",
  "scaffolding_longest",
  "rent_stab_borough_stats",
];

const pages: PageCheck[] = [
  { path: "/", label: "Homepage", category: "public", city: "all" },
  // NYC pages
  { path: "/nyc/search", label: "Search", category: "public", city: "nyc" },
  { path: "/nyc/buildings", label: "Buildings Directory", category: "public", city: "nyc" },
  { path: "/nyc/feed", label: "Activity Feed", category: "public", city: "nyc" },
  { path: "/nyc/news", label: "News", category: "public", city: "nyc" },
  { path: "/nyc/map", label: "Map", category: "public", city: "nyc" },
  { path: "/nyc/landlords", label: "Landlords", category: "public", city: "nyc" },
  { path: "/nyc/review/new", label: "Submit Review", category: "public", city: "nyc" },
  { path: "/nyc/crime", label: "Crime Stats", category: "data", city: "nyc" },
  { path: "/nyc/permits", label: "DOB Permits", category: "data", city: "nyc" },
  { path: "/nyc/scaffolding", label: "Scaffolding", category: "data", city: "nyc" },
  { path: "/nyc/energy", label: "Energy", category: "data", city: "nyc" },
  { path: "/nyc/rent-data", label: "Rent Data", category: "data", city: "nyc" },
  { path: "/nyc/rent-stabilization", label: "Rent Stabilization", category: "data", city: "nyc" },
  { path: "/nyc/compare", label: "Compare", category: "data", city: "nyc" },
  // LA pages
  { path: "/CA/Los-Angeles/search", label: "Search", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/buildings", label: "Buildings Directory", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/feed", label: "Activity Feed", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/news", label: "News", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/map", label: "Map", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/landlords", label: "Landlords", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/review/new", label: "Submit Review", category: "public", city: "los-angeles" },
  { path: "/CA/Los-Angeles/crime", label: "Crime Stats", category: "data", city: "los-angeles" },
  { path: "/CA/Los-Angeles/rent-data", label: "Rent Data", category: "data", city: "los-angeles" },
  { path: "/CA/Los-Angeles/compare", label: "Compare", category: "data", city: "los-angeles" },
  // Dashboard (shared)
  { path: "/dashboard", label: "Dashboard", category: "dashboard", city: "all" },
  { path: "/dashboard/monitoring", label: "Monitoring", category: "dashboard", city: "all" },
  { path: "/dashboard/reviews", label: "My Reviews", category: "dashboard", city: "all" },
  { path: "/dashboard/saved", label: "Saved Buildings", category: "dashboard", city: "all" },
  { path: "/dashboard/settings", label: "Settings", category: "dashboard", city: "all" },
];

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  // Optional city filter: "nyc", "los-angeles", or omitted for all
  const metroParam = request.nextUrl.searchParams.get("metro") as City | null;

  // Filter definitions by metro
  const filteredSyncs = metroParam
    ? syncTypeDefs.filter((s) => s.city === metroParam || s.city === "all")
    : syncTypeDefs;
  const filteredTables = metroParam
    ? tableDefs.filter((t) => t.city === metroParam || t.city === "all")
    : tableDefs;
  const filteredPages = metroParam
    ? pages.filter((p) => !p.city || p.city === metroParam || p.city === "all")
    : pages;

  // Run ALL checks in parallel for speed
  const [syncResults, dataResults, rpcResults, feedResult] = await Promise.all([
    // 1. Sync checks — all in parallel
    Promise.all(
      filteredSyncs.map(async (syncDef): Promise<SyncCheck & { city: City | "all" }> => {
        const { data } = await supabase
          .from("sync_log")
          .select("sync_type, status, started_at, completed_at, records_added, records_linked, errors")
          .eq("sync_type", syncDef.type)
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (!data) {
          return {
            sync_type: syncDef.type,
            status: "error",
            last_run: null,
            last_status: null,
            records_added: 0,
            records_linked: 0,
            hours_since_sync: null,
            error_preview: "No sync log entry found",
            schedule: syncDef.schedule,
            category: syncDef.category,
            city: syncDef.city,
          };
        }

        const hoursSince = data.started_at
          ? (Date.now() - new Date(data.started_at).getTime()) / (1000 * 60 * 60)
          : null;

        let status: "healthy" | "warning" | "error" = "healthy";
        if (data.status === "failed") status = "error";
        else if (data.status === "running") status = "warning";
        else if (hoursSince && hoursSince > syncDef.warnHours * 2) status = "error";
        else if (hoursSince && hoursSince > syncDef.warnHours) status = "warning";

        const errArr = data.errors as string[] | null;
        return {
          sync_type: syncDef.type,
          status,
          last_run: data.started_at,
          last_status: data.status,
          records_added: data.records_added ?? 0,
          records_linked: data.records_linked ?? 0,
          hours_since_sync: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
          error_preview: errArr && errArr.length > 0 ? errArr[0].slice(0, 200) : null,
          schedule: syncDef.schedule,
          category: syncDef.category,
          city: syncDef.city,
        };
      })
    ),

    // 2. Data table checks — all in parallel
    Promise.all(
      filteredTables.map(async (t): Promise<DataCheck & { city: City | "all" }> => {
        try {
          const { count } = await supabase
            .from(t.name)
            .select("*", { count: "exact", head: true });

          let latestRecord: string | null = null;
          let status: "healthy" | "warning" | "error" = "healthy";
          let details = `${(count ?? 0).toLocaleString()} rows`;

          if (t.dateCol && !t.countOnly) {
            const { data: latest } = await supabase
              .from(t.name)
              .select(t.dateCol)
              .order(t.dateCol, { ascending: false })
              .limit(1)
              .single();

            if (latest) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              latestRecord = (latest as any)[t.dateCol];
              const hoursSince = (Date.now() - new Date(latestRecord!).getTime()) / (1000 * 60 * 60);
              if (hoursSince > t.warnHours * 2) status = "error";
              else if (hoursSince > t.warnHours) status = "warning";
              details += ` | latest: ${new Date(latestRecord!).toISOString().split("T")[0]}`;
            }
          }

          if ((count ?? 0) === 0) status = "error";

          return { name: t.name, label: t.label, status, row_count: count ?? 0, latest_record: latestRecord, details, category: t.category, city: t.city };
        } catch {
          return { name: t.name, label: t.label, status: "error", row_count: 0, latest_record: null, details: "Query failed", category: t.category, city: t.city };
        }
      })
    ),

    // 3. RPC checks — all in parallel
    Promise.all(
      rpcNames.map(async (rpcName): Promise<RpcCheck> => {
        const rpcStart = Date.now();
        try {
          const { data, error } = await supabase.rpc(rpcName);
          const elapsed = Date.now() - rpcStart;
          const rowCount = Array.isArray(data) ? data.length : 0;
          return {
            name: rpcName,
            status: error ? "error" : "healthy",
            response_time_ms: elapsed,
            row_count: rowCount,
            error: error?.message ?? null,
          };
        } catch (err) {
          return {
            name: rpcName,
            status: "error",
            response_time_ms: Date.now() - rpcStart,
            row_count: 0,
            error: String(err),
          };
        }
      })
    ),

    // 4. Activity feed check
    (async () => {
      try {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);
        const { data: feedData, error: feedError } = await supabase
          .from("hpd_violations")
          .select("id")
          .gte("imported_at", cutoff.toISOString())
          .limit(5);

        if (feedError) return { status: "error" as const, details: feedError.message };
        if (!feedData || feedData.length === 0) return { status: "error" as const, details: "No recent violations found for activity feed" };
        return { status: "healthy" as const, details: `${feedData.length} recent records available` };
      } catch (err) {
        return { status: "error" as const, details: String(err) };
      }
    })(),
  ]);

  // Overall health
  const allStatuses = [
    ...syncResults.map((s) => s.status),
    ...dataResults.map((d) => d.status),
    ...rpcResults.map((r) => r.status),
    feedResult.status,
  ];
  const overallStatus = allStatuses.includes("error")
    ? "error"
    : allStatuses.includes("warning")
      ? "warning"
      : "healthy";

  const errorCount = allStatuses.filter((s) => s === "error").length;
  const warningCount = allStatuses.filter((s) => s === "warning").length;

  return NextResponse.json({
    status: overallStatus,
    checked_at: new Date().toISOString(),
    response_time_ms: Date.now() - startTime,
    metro: metroParam || "all",
    summary: {
      errors: errorCount,
      warnings: warningCount,
      healthy: allStatuses.length - errorCount - warningCount,
      total: allStatuses.length,
    },
    syncs: syncResults,
    data: dataResults,
    rpcs: rpcResults,
    activity_feed: feedResult,
    pages: filteredPages,
  });
}
