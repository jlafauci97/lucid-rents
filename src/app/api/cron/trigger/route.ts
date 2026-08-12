import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";

// Keep the lambda alive long enough for the after() dispatch below to hold
// its connection while the edge function runs (most sources finish < 300s).
export const maxDuration = 300;

/**
 * Cron dispatcher → Supabase Edge Functions.
 *
 * History: this route was blanket-disabled in April when the heavy syncs moved
 * to launchd on the Mac Mini, so Vercel crons wouldn't double-run them. But
 * vercel.json still declares 42 cron entries across 31 sources, and the Mac
 * Mini only schedules ~14 of them. The rest hit this route, got a 200, and
 * silently stopped ingesting on 2026-06-01 — Vercel saw success, so nothing
 * ever alerted. (Verified against sync_log: NYPD crime, Chicago crimes/permits/
 * RLTO/lead, DOB permits, evictions, sheds, bedbugs, HPD registrations +
 * contacts, LA permits/soft-story, LADBS and rent stabilization were all dead
 * for two months.)
 *
 * Fix: dispatch only the sources the local scheduler ISN'T running, so the two
 * schedulers stay disjoint and nothing double-runs. Anything not in the
 * allowlist still returns a 200 no-op.
 *
 * To move a source between schedulers, add/remove it here — that's the whole
 * contract. Keep this list disjoint from whatever launchd runs on the Mini.
 */

/**
 * Sources confirmed running on the Mac Mini (recent sync_log rows, ~2×/day).
 * Listed for documentation — these deliberately stay no-ops here.
 */
const LOCAL_SCHEDULER_SOURCES = new Set([
  "hpd",
  "complaints",
  "litigations",
  "dob",
  "lahd",
  "la-311",
  "la-evictions",
  "la-buyouts",
  "la-ccris",
  "chicago-violations",
  "chicago-311",
  "sync-news",
  // miami/houston sources are disabled outright — see docs/miami-houston-removal.md
  "miami-violations",
  "houston-311",
]);

/**
 * Sources Vercel dispatches. Everything confirmed dead since June, plus the two
 * crime sources that had no cron at all (`lapd`, dead since March) and
 * `la-violation-summary`.
 *
 * `sheds` (sidewalk sheds) is deliberately NOT here — dropped 2026-08-01, not
 * needed for now. Its cron entry was removed from vercel.json too; re-add both
 * to bring it back.
 *
 * `nypd` and `lapd` are the two heaviest sources. They are scheduled off-peak
 * and away from the local scheduler's 01:00/17:00/21:00 UTC windows so a spike
 * can't repeat the 2026-07-27 DB wedge.
 */
const VERCEL_DISPATCH_SOURCES = new Set([
  // NYC
  "bedbugs",
  "evictions",
  "permits",
  "hpd-registrations",
  "hpd-contacts",
  "nypd",
  // LA
  "ladbs",
  "la-permits",
  "la-soft-story",
  "lapd",
  "la-violation-summary",
  // Chicago
  "chicago-crimes",
  "chicago-permits",
  "chicago-rlto",
  "chicago-lead",
  // standalone edge functions
  "sync-rent-stabilization",
  "sync-hpd-lead",
  // Monthly standalone syncs. Their vercel.json crons pointed here all along,
  // but they were missing from this allowlist, so every run no-op'd — no
  // sync_log rows at all as of 2026-08-11. Nothing else schedules them.
  "sync-zillow-rents",
  "sync-energy",
  "sync-transit",
  "sync-schools",
]);

/** Standalone edge functions are invoked by name; everything else goes to `sync`. */
const STANDALONE_FUNCTIONS = new Set([
  "sync-news",
  "sync-energy",
  "sync-transit",
  "sync-la-transit",
  "sync-schools",
  "sync-encampments",
  "sync-rent-stabilization",
  "sync-zillow-rents",
  "geocode-buildings",
  "sync-hpd-lead",
]);

function getFunctionName(source: string | null): string {
  if (source && STANDALONE_FUNCTIONS.has(source)) return source;
  return "sync";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const source = req.nextUrl.searchParams.get("source");
  const mode = req.nextUrl.searchParams.get("mode") || "sync";

  // Link-mode runs are paired with their sync source on the local scheduler;
  // don't dispatch them from here or the same rows get linked twice.
  if (mode === "link" || !source || !VERCEL_DISPATCH_SOURCES.has(source)) {
    return NextResponse.json(
      {
        skipped: true,
        reason: LOCAL_SCHEDULER_SOURCES.has(source ?? "")
          ? "handled by local scheduler"
          : "source not enabled for Vercel dispatch",
        source,
        mode,
      },
      { status: 200 }
    );
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!supabaseUrl || !cronSecret) {
    return NextResponse.json({ error: "Missing Supabase config" }, { status: 500 });
  }

  const fnName = getFunctionName(source);

  // Dispatch via after(): a bare fire-and-forget fetch dies when Vercel
  // freezes the lambda right after the response is sent — that is why the
  // "restored" sources of 2026-07-26 mostly never ran (14 edge invocations in
  // 10 days instead of ~160). after() keeps the function alive until the
  // fetch settles; the edge function records its own outcome in sync_log.
  after(async () => {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ source, mode }),
      });
      if (!res.ok) {
        console.error(
          `[cron/trigger] edge fn ${fnName} responded ${res.status}:`,
          await res.text()
        );
      }
    } catch (err) {
      console.error("[cron/trigger] edge invoke failed:", source, err);
    }
  });

  return NextResponse.json(
    { triggered: true, function: fnName, source, mode },
    { status: 202 }
  );
}
