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
}

interface DataCheck {
  name: string;
  status: "healthy" | "warning" | "error";
  row_count: number;
  latest_record: string | null;
  details: string;
}

interface RpcCheck {
  name: string;
  status: "healthy" | "error";
  response_time_ms: number;
  row_count: number;
  error: string | null;
}

export async function GET() {
  const startTime = Date.now();
  const supabase = getSupabaseAdmin();

  // 1. Check sync health — last run per sync_type
  const syncChecks: SyncCheck[] = [];
  const syncTypes = [
    "hpd_violations",
    "complaints_311",
    "hpd_litigations",
    "dob_violations",
    "nypd_complaints",
    "bedbug_reports",
    "evictions",
    "sidewalk_sheds",
    "dob_permits",
  ];

  for (const syncType of syncTypes) {
    const { data } = await supabase
      .from("sync_log")
      .select("sync_type, status, started_at, completed_at, records_added, records_linked, errors")
      .eq("sync_type", syncType)
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      syncChecks.push({
        sync_type: syncType,
        status: "error",
        last_run: null,
        last_status: null,
        records_added: 0,
        records_linked: 0,
        hours_since_sync: null,
        error_preview: "No sync log entry found",
      });
      continue;
    }

    const hoursSince = data.started_at
      ? (Date.now() - new Date(data.started_at).getTime()) / (1000 * 60 * 60)
      : null;

    let status: "healthy" | "warning" | "error" = "healthy";
    if (data.status === "failed") status = "error";
    else if (data.status === "running") status = "warning";
    else if (hoursSince && hoursSince > 48) status = "error";
    else if (hoursSince && hoursSince > 26) status = "warning";

    const errArr = data.errors as string[] | null;
    syncChecks.push({
      sync_type: syncType,
      status,
      last_run: data.started_at,
      last_status: data.status,
      records_added: data.records_added ?? 0,
      records_linked: data.records_linked ?? 0,
      hours_since_sync: hoursSince ? Math.round(hoursSince * 10) / 10 : null,
      error_preview: errArr && errArr.length > 0 ? errArr[0].slice(0, 200) : null,
    });
  }

  // 2. Check data freshness — latest record dates per table
  const dataChecks: DataCheck[] = [];

  const tables = [
    { name: "buildings", dateCol: null, countOnly: true },
    { name: "hpd_violations", dateCol: "imported_at", warnHours: 48 },
    { name: "dob_violations", dateCol: "imported_at", warnHours: 48 },
    { name: "complaints_311", dateCol: "imported_at", warnHours: 48 },
    { name: "nypd_complaints", dateCol: "imported_at", warnHours: 48 },
    { name: "dob_permits", dateCol: "imported_at", warnHours: 48 },
    { name: "sidewalk_sheds", dateCol: "imported_at", warnHours: 48 },
    { name: "evictions", dateCol: "imported_at", warnHours: 48 },
  ];

  for (const t of tables) {
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
          if (hoursSince > (t.warnHours ?? 48) * 2) status = "error";
          else if (hoursSince > (t.warnHours ?? 48)) status = "warning";
          details += ` | latest: ${new Date(latestRecord!).toISOString().split("T")[0]}`;
        }
      }

      if ((count ?? 0) === 0) status = "error";

      dataChecks.push({ name: t.name, status, row_count: count ?? 0, latest_record: latestRecord, details });
    } catch {
      dataChecks.push({ name: t.name, status: "error", row_count: 0, latest_record: null, details: "Query failed" });
    }
  }

  // 3. Check key RPCs
  const rpcChecks: RpcCheck[] = [];
  const rpcs = [
    "permits_recent",
    "permit_stats",
    "scaffolding_stats",
    "scaffolding_longest",
    "rent_stab_borough_stats",
  ];

  for (const rpcName of rpcs) {
    const rpcStart = Date.now();
    try {
      const { data, error } = await supabase.rpc(rpcName);
      const elapsed = Date.now() - rpcStart;
      const rowCount = Array.isArray(data) ? data.length : 0;

      rpcChecks.push({
        name: rpcName,
        status: error ? "error" : "healthy",
        response_time_ms: elapsed,
        row_count: rowCount,
        error: error?.message ?? null,
      });
    } catch (err) {
      rpcChecks.push({
        name: rpcName,
        status: "error",
        response_time_ms: Date.now() - rpcStart,
        row_count: 0,
        error: String(err),
      });
    }
  }

  // 4. Check activity feed (critical user-facing feature)
  let activityFeedStatus: "healthy" | "error" = "healthy";
  let activityFeedDetails = "";
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const { data: feedData, error: feedError } = await supabase
      .from("hpd_violations")
      .select("id")
      .gte("imported_at", cutoff.toISOString())
      .limit(5);

    if (feedError) {
      activityFeedStatus = "error";
      activityFeedDetails = feedError.message;
    } else if (!feedData || feedData.length === 0) {
      activityFeedStatus = "error";
      activityFeedDetails = "No recent violations found for activity feed";
    } else {
      activityFeedDetails = `${feedData.length} recent records available`;
    }
  } catch (err) {
    activityFeedStatus = "error";
    activityFeedDetails = String(err);
  }

  // Overall health
  const allStatuses = [
    ...syncChecks.map((s) => s.status),
    ...dataChecks.map((d) => d.status),
    ...rpcChecks.map((r) => r.status),
    activityFeedStatus,
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
    },
    syncs: syncChecks,
    data: dataChecks,
    rpcs: rpcChecks,
    activity_feed: {
      status: activityFeedStatus,
      details: activityFeedDetails,
    },
  });
}
