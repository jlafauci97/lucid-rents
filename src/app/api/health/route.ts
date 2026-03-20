import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
}

const syncTypeDefs = [
  { type: "hpd_violations", schedule: "Daily 5:00 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "complaints_311", schedule: "Daily 5:10 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "hpd_litigations", schedule: "Daily 5:20 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "dob_violations", schedule: "Daily 5:30 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "nypd_complaints", schedule: "Daily 5:40 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "bedbug_reports", schedule: "Daily 5:50 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "evictions", schedule: "Daily 6:00 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "sidewalk_sheds", schedule: "Daily 6:20 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "dob_permits", schedule: "Daily 6:30 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "link", schedule: "Daily 7:00 AM UTC", category: "daily" as const, warnHours: 26 },
  { type: "news", schedule: "Daily 6:10 AM & 6:00 PM UTC", category: "twice_daily" as const, warnHours: 14 },
  { type: "rent_stabilization", schedule: "1st of month 7:00 AM UTC", category: "monthly" as const, warnHours: 744 },
  { type: "zillow_rents", schedule: "1st of month 7:30 AM UTC", category: "monthly" as const, warnHours: 744 },
  { type: "energy", schedule: "1st of month 8:00 AM UTC", category: "monthly" as const, warnHours: 744 },
  { type: "transit", schedule: "1st of month 9:00 AM UTC", category: "monthly" as const, warnHours: 744 },
  { type: "schools", schedule: "1st of month 9:30 AM UTC", category: "monthly" as const, warnHours: 744 },
];

const tableDefs = [
  { name: "buildings", label: "Buildings", dateCol: null as string | null, countOnly: true, warnHours: 48, category: "core" as const },
  { name: "reviews", label: "Reviews", dateCol: "created_at", countOnly: true, warnHours: 48, category: "core" as const },
  { name: "hpd_violations", label: "HPD Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "dob_violations", label: "DOB Violations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "complaints_311", label: "311 Complaints", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "nypd_complaints", label: "NYPD Complaints", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "hpd_litigations", label: "HPD Litigations", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "dob_permits", label: "DOB Permits", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "sidewalk_sheds", label: "Sidewalk Sheds", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "evictions", label: "Evictions", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "bedbug_reports", label: "Bedbug Reports", dateCol: "imported_at", countOnly: false, warnHours: 48, category: "violations" as const },
  { name: "news_articles", label: "News Articles", dateCol: "published_at", countOnly: false, warnHours: 24, category: "supplemental" as const },
  { name: "rent_stabilization", label: "Rent Stabilization", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
  { name: "building_rents", label: "Building Rents", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
  { name: "energy_benchmarks", label: "Energy Benchmarks", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
  { name: "transit_stops", label: "Transit Stops", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
  { name: "schools", label: "Schools", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
  { name: "unit_listings", label: "Unit Listings", dateCol: null, countOnly: true, warnHours: 48, category: "supplemental" as const },
];

const rpcNames = [
  "permits_recent",
  "permit_stats",
  "scaffolding_stats",
  "scaffolding_longest",
  "rent_stab_borough_stats",
];

const pages: PageCheck[] = [
  { path: "/", label: "Homepage", category: "public" },
  { path: "/nyc/search", label: "Search", category: "public" },
  { path: "/nyc/buildings", label: "Buildings Directory", category: "public" },
  { path: "/nyc/feed", label: "Activity Feed", category: "public" },
  { path: "/nyc/news", label: "News", category: "public" },
  { path: "/nyc/map", label: "Map", category: "public" },
  { path: "/nyc/landlords", label: "Landlords", category: "public" },
  { path: "/nyc/review/new", label: "Submit Review", category: "public" },
  { path: "/nyc/crime", label: "Crime Stats", category: "data" },
  { path: "/nyc/permits", label: "DOB Permits", category: "data" },
  { path: "/nyc/scaffolding", label: "Scaffolding", category: "data" },
  { path: "/nyc/energy", label: "Energy", category: "data" },
  { path: "/nyc/rent-data", label: "Rent Data", category: "data" },
  { path: "/nyc/rent-stabilization", label: "Rent Stabilization", category: "data" },
  { path: "/nyc/compare", label: "Compare", category: "data" },
  { path: "/dashboard", label: "Dashboard", category: "dashboard" },
  { path: "/dashboard/monitoring", label: "Monitoring", category: "dashboard" },
  { path: "/dashboard/reviews", label: "My Reviews", category: "dashboard" },
  { path: "/dashboard/saved", label: "Saved Buildings", category: "dashboard" },
  { path: "/dashboard/settings", label: "Settings", category: "dashboard" },
];

export async function GET() {
  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  // Run ALL checks in parallel for speed
  const [syncResults, dataResults, rpcResults, feedResult] = await Promise.all([
    // 1. Sync checks — all in parallel
    Promise.all(
      syncTypeDefs.map(async (syncDef): Promise<SyncCheck> => {
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
        };
      })
    ),

    // 2. Data table checks — all in parallel
    Promise.all(
      tableDefs.map(async (t): Promise<DataCheck> => {
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

          return { name: t.name, label: t.label, status, row_count: count ?? 0, latest_record: latestRecord, details, category: t.category };
        } catch {
          return { name: t.name, label: t.label, status: "error", row_count: 0, latest_record: null, details: "Query failed", category: t.category };
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
    pages,
  });
}
