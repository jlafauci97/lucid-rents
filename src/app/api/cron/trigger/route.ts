import { NextRequest, NextResponse } from "next/server";

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
 * Sources Vercel dispatches. Stage 1 of the restore: everything confirmed dead
 * since June except `nypd`, which is the single heaviest source (multi-million
 * rows) and the one most likely to spike DB load. Add "nypd" here once stage 1
 * has run clean for a few days — see docs/sync-scheduling.md.
 */
const VERCEL_DISPATCH_SOURCES = new Set([
  // NYC
  "bedbugs",
  "sheds",
  "evictions",
  "permits",
  "hpd-registrations",
  "hpd-contacts",
  // LA
  "ladbs",
  "la-permits",
  "la-soft-story",
  // Chicago
  "chicago-crimes",
  "chicago-permits",
  "chicago-rlto",
  "chicago-lead",
  // standalone edge functions
  "sync-rent-stabilization",
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

  // Fire-and-forget: the edge function runs far longer than this route's
  // budget, and it records its own outcome in sync_log.
  fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source, mode }),
  }).catch((err) => console.error("[cron/trigger] edge invoke failed:", source, err));

  return NextResponse.json(
    { triggered: true, function: fnName, source, mode },
    { status: 202 }
  );
}
