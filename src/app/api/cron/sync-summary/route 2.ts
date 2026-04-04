import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextRequest, NextResponse } from "next/server";
import {
  buildSyncSummaryHtml,
  buildSyncSummarySubject,
  type CitySummary,
  type SyncEntry,
  type ScrapeEntry,
  type SyncSummaryData,
} from "@/lib/email/sync-summary";

// ---------------------------------------------------------------------------
// Source → city mapping
// ---------------------------------------------------------------------------

const SOURCE_CITY: Record<string, string> = {
  // NYC
  hpd: "NYC",
  complaints: "NYC",
  litigations: "NYC",
  dob: "NYC",
  nypd: "NYC",
  bedbugs: "NYC",
  evictions: "NYC",
  sheds: "NYC",
  permits: "NYC",
  // LA
  lahd: "Los Angeles",
  "la-311": "Los Angeles",
  ladbs: "Los Angeles",
  lapd: "Los Angeles",
  "la-permits": "Los Angeles",
  "la-soft-story": "Los Angeles",
  "la-evictions": "Los Angeles",
  "la-buyouts": "Los Angeles",
  "la-ccris": "Los Angeles",
  "la-violation-summary": "Los Angeles",
  // Chicago
  "chicago-violations": "Chicago",
  "chicago-311": "Chicago",
  "chicago-crimes": "Chicago",
  "chicago-permits": "Chicago",
  "chicago-rlto": "Chicago",
  "chicago-lead": "Chicago",
  // Miami
  "miami-violations": "Miami",
  "miami-311": "Miami",
  "miami-crimes": "Miami",
  "miami-permits": "Miami",
  "miami-unsafe": "Miami",
  "miami-recerts": "Miami",
};

const METRO_CITY: Record<string, string> = {
  nyc: "NYC",
  "los-angeles": "Los Angeles",
  chicago: "Chicago",
  miami: "Miami",
};

const CITY_ORDER = ["NYC", "Los Angeles", "Chicago", "Miami"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function todayRange(): { start: string; end: string; dateLabel: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return {
    start: `${year}-${month}-${day}T00:00:00Z`,
    end: `${year}-${month}-${day}T23:59:59Z`,
    dateLabel: `${year}-${month}-${day}`,
  };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function fetchSyncLogs(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  start: string,
  end: string
): Promise<SyncEntry[]> {
  const { data, error } = await supabase
    .from("sync_log")
    .select("sync_type, status, records_added, records_linked, errors, started_at, completed_at")
    .gte("started_at", start)
    .lte("started_at", end)
    .order("started_at", { ascending: true });

  if (error) {
    console.error("Failed to fetch sync_log:", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const started = row.started_at ? new Date(row.started_at).getTime() : 0;
    const completed = row.completed_at ? new Date(row.completed_at).getTime() : 0;
    const durationSec = started && completed ? (completed - started) / 1000 : null;

    return {
      source: row.sync_type,
      status: row.status as SyncEntry["status"],
      records_added: row.records_added ?? 0,
      records_linked: row.records_linked ?? 0,
      errors: Array.isArray(row.errors) ? row.errors : row.errors ? [row.errors] : [],
      duration_seconds: durationSec,
    };
  });
}

/**
 * Query scrape tables (building_rents, building_amenities, unit_rent_history)
 * for rows created/updated today, grouped by city + source.
 */
async function fetchScrapeStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  start: string,
  end: string
): Promise<Map<string, ScrapeEntry[]>> {
  const cityMap = new Map<string, Map<string, ScrapeEntry>>();

  // Helper to ensure city+source entry exists
  function getEntry(city: string, source: string): ScrapeEntry {
    if (!cityMap.has(city)) cityMap.set(city, new Map());
    const sourceMap = cityMap.get(city)!;
    if (!sourceMap.has(source)) {
      sourceMap.set(source, {
        source,
        buildings_scraped: 0,
        rents_added: 0,
        amenities_added: 0,
        unit_histories_added: 0,
      });
    }
    return sourceMap.get(source)!;
  }

  // 1. building_rents — count rents added today, unique buildings
  const { data: rents } = await supabase
    .from("building_rents")
    .select("building_id, source, buildings!inner(metro)")
    .gte("scraped_at", start)
    .lte("scraped_at", end);

  if (rents) {
    // Group by metro + source
    const groups = new Map<string, { buildingIds: Set<string>; count: number }>();
    for (const r of rents) {
      const metro = (r as Record<string, unknown>).buildings as { metro?: string } | null;
      const metroVal = metro?.metro ?? "unknown";
      const city = METRO_CITY[metroVal] ?? metroVal;
      const source = (r as Record<string, unknown>).source as string ?? "unknown";
      const key = `${city}::${source}`;
      if (!groups.has(key)) groups.set(key, { buildingIds: new Set(), count: 0 });
      const g = groups.get(key)!;
      g.buildingIds.add((r as Record<string, unknown>).building_id as string);
      g.count++;
    }
    for (const [key, g] of groups) {
      const [city, source] = key.split("::");
      const entry = getEntry(city, source);
      entry.rents_added += g.count;
      entry.buildings_scraped = Math.max(entry.buildings_scraped, g.buildingIds.size);
    }
  }

  // 2. building_amenities — count amenities added today
  const { data: amenities } = await supabase
    .from("building_amenities")
    .select("building_id, source, buildings!inner(metro)")
    .gte("scraped_at", start)
    .lte("scraped_at", end);

  if (amenities) {
    const groups = new Map<string, { buildingIds: Set<string>; count: number }>();
    for (const r of amenities) {
      const metro = (r as Record<string, unknown>).buildings as { metro?: string } | null;
      const metroVal = metro?.metro ?? "unknown";
      const city = METRO_CITY[metroVal] ?? metroVal;
      const source = (r as Record<string, unknown>).source as string ?? "unknown";
      const key = `${city}::${source}`;
      if (!groups.has(key)) groups.set(key, { buildingIds: new Set(), count: 0 });
      const g = groups.get(key)!;
      g.buildingIds.add((r as Record<string, unknown>).building_id as string);
      g.count++;
    }
    for (const [key, g] of groups) {
      const [city, source] = key.split("::");
      const entry = getEntry(city, source);
      entry.amenities_added += g.count;
      entry.buildings_scraped = Math.max(entry.buildings_scraped, g.buildingIds.size);
    }
  }

  // 3. unit_rent_history — count unit history rows added today
  const { data: history } = await supabase
    .from("unit_rent_history")
    .select("building_id, source, buildings!inner(metro)")
    .gte("scraped_at", start)
    .lte("scraped_at", end);

  if (history) {
    const groups = new Map<string, { buildingIds: Set<string>; count: number }>();
    for (const r of history) {
      const metro = (r as Record<string, unknown>).buildings as { metro?: string } | null;
      const metroVal = metro?.metro ?? "unknown";
      const city = METRO_CITY[metroVal] ?? metroVal;
      const source = (r as Record<string, unknown>).source as string ?? "unknown";
      const key = `${city}::${source}`;
      if (!groups.has(key)) groups.set(key, { buildingIds: new Set(), count: 0 });
      const g = groups.get(key)!;
      g.buildingIds.add((r as Record<string, unknown>).building_id as string);
      g.count++;
    }
    for (const [key, g] of groups) {
      const [city, source] = key.split("::");
      const entry = getEntry(city, source);
      entry.unit_histories_added += g.count;
      entry.buildings_scraped = Math.max(entry.buildings_scraped, g.buildingIds.size);
    }
  }

  // Convert to result map
  const result = new Map<string, ScrapeEntry[]>();
  for (const [city, sourceMap] of cityMap) {
    result.set(city, Array.from(sourceMap.values()));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!resendKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  }
  if (!adminEmail) {
    return NextResponse.json({ error: "Missing ADMIN_EMAIL" }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const fromEmail = process.env.RESEND_FROM_EMAIL || "alerts@lucidrents.com";
  const { start, end, dateLabel } = todayRange();

  // Fetch data in parallel
  const [syncLogs, scrapeStats] = await Promise.all([
    fetchSyncLogs(supabase, start, end),
    fetchScrapeStats(supabase, start, end),
  ]);

  // Group sync logs by city
  const syncByCity = new Map<string, SyncEntry[]>();
  for (const entry of syncLogs) {
    // Skip link-only runs from the summary (they don't add new data)
    if (entry.source.startsWith("link-")) continue;
    const city = SOURCE_CITY[entry.source] ?? "Other";
    if (!syncByCity.has(city)) syncByCity.set(city, []);
    syncByCity.get(city)!.push(entry);
  }

  // Build city summaries
  const cities: CitySummary[] = CITY_ORDER.map((city) => ({
    city,
    syncs: syncByCity.get(city) ?? [],
    scrapes: scrapeStats.get(city) ?? [],
  })).filter((c) => c.syncs.length > 0 || c.scrapes.length > 0);

  // Add "Other" city if there are unmapped sources
  const otherSyncs = syncByCity.get("Other");
  if (otherSyncs && otherSyncs.length > 0) {
    cities.push({ city: "Other", syncs: otherSyncs, scrapes: [] });
  }

  // Compute totals
  const totals = {
    syncs_completed: syncLogs.filter((s) => s.status === "completed").length,
    syncs_failed: syncLogs.filter((s) => s.status === "failed").length,
    records_added: syncLogs.reduce((sum, s) => sum + s.records_added, 0),
    records_linked: syncLogs.reduce((sum, s) => sum + s.records_linked, 0),
    buildings_scraped: 0,
    rents_added: 0,
    amenities_added: 0,
    unit_histories_added: 0,
  };

  for (const entries of scrapeStats.values()) {
    for (const e of entries) {
      totals.buildings_scraped += e.buildings_scraped;
      totals.rents_added += e.rents_added;
      totals.amenities_added += e.amenities_added;
      totals.unit_histories_added += e.unit_histories_added;
    }
  }

  const summaryData: SyncSummaryData = { date: dateLabel, cities, totals };

  // Send email
  const resend = new Resend(resendKey);
  const html = buildSyncSummaryHtml(summaryData);
  const subject = buildSyncSummarySubject(summaryData);

  const { error: emailError } = await resend.emails.send({
    from: fromEmail,
    to: adminEmail,
    subject,
    html,
  });

  if (emailError) {
    console.error("Failed to send sync summary email:", emailError);
    return NextResponse.json(
      { ok: false, error: `Email send failed: ${emailError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    date: dateLabel,
    syncs: syncLogs.length,
    cities: cities.map((c) => c.city),
    totals,
    email_sent_to: adminEmail,
  });
}
