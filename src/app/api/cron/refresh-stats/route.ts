import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    await supabase.rpc("refresh_borough_stats" as never);
  } catch (err) {
    errors.push(`mv_borough_stats refresh error: ${String(err)}`);
  }

  // Reconcile building count drift per metro (chunked to avoid timeouts)
  let buildingsFixed = 0;
  const metros = ["nyc", "los-angeles", "chicago", "miami", "houston"];
  for (const metro of metros) {
    try {
      const { data } = await supabase.rpc("reconcile_building_counts" as never, { target_metro: metro } as never);
      buildingsFixed += data?.[0]?.buildings_fixed ?? 0;
    } catch (err) {
      errors.push(`reconcile_building_counts (${metro}) error: ${String(err)}`);
    }
  }

  // Refresh Chicago rodent complaint counts
  try {
    await supabase.rpc("refresh_rodent_complaint_counts" as never);
  } catch (err) {
    errors.push(`refresh_rodent_complaint_counts error: ${String(err)}`);
  }

  // Refresh neighborhood median rents pre-computed table
  try {
    await supabase.rpc("refresh_neighborhood_median_rents" as never);
  } catch (err) {
    errors.push(`refresh_neighborhood_median_rents error: ${String(err)}`);
  }

  // Invalidate borough/city pages after stats refresh
  try {
    revalidatePath("/[city]", "page");
    revalidatePath("/[city]/buildings/[borough]", "page");
    revalidatePath("/[city]/worst-rated-buildings", "page");
    revalidatePath("/[city]/problem-landlords", "page");
  } catch {
    // revalidation is best-effort
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  return NextResponse.json({
    success: errors.length === 0,
    duration_seconds: parseFloat(elapsed),
    buildings_counts_reconciled: buildingsFixed,
    errors,
  });
}
