import { NextResponse } from "next/server";

export const maxDuration = 300;

/**
 * Vercel cron entry point for the Neighborhood Risks sync layer.
 *
 * Triggers the deployed `sync-nearby-concerns` Supabase edge function,
 * which dispatches to all registered module syncs (FDNY firehouses,
 * hospital ERs, DSNY garages, active construction — see the function's
 * MODULES registry for the live list).
 *
 * Scheduled weekly via vercel.json. Can also be triggered manually with
 * `?source=<module-name>` to force a single module re-sync.
 */
export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { ok: false, error: "Missing Supabase env vars" },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const source = url.searchParams.get("source") ?? "all";
  const target = `${supabaseUrl}/functions/v1/sync-nearby-concerns?source=${encodeURIComponent(source)}`;

  try {
    const res = await fetch(target, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      return NextResponse.json(
        { ok: false, status: res.status, body },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, source, result: body });
  } catch (err) {
    console.error("sync-nearby-concerns cron error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 },
    );
  }
}
