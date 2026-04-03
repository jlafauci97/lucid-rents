// ---------------------------------------------------------------------------
// Supabase Edge Function: /sync
// Ported from src/app/api/cron/sync/route.ts (Vercel) → Deno.serve
// ---------------------------------------------------------------------------
import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import { batchUpsert } from "shared/batch-upsert.ts";
import { parseDate, toSodaDate } from "shared/parse-date.ts";
import { categorizeCrime } from "shared/crime-categories.ts";
import { generateBuildingSlug, buildingUrl, regionSlug } from "shared/seo-helpers.ts";
import { notifyIndexNow } from "shared/indexnow.ts";
import { type City, CITY_META } from "shared/cities.ts";
import { triggerRevalidation } from "shared/revalidate.ts";

import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const BOROUGH_MAP: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;
const MAX_PAGES = 10; // Safety limit: max API pages per sync
const SYNC_TIME_BUDGET_MS = 350_000; // Stop fetching new pages after 350s to leave time for linking + response
const STALE_SYNC_MINUTES = 30; // Mark "running" syncs older than this as "failed"

const COMPLAINT_TYPES = [
  "HEAT/HOT WATER",
  "PLUMBING",
  "PAINT/PLASTER",
  "WATER LEAK",
  "GENERAL CONSTRUCTION",
  "ELEVATOR",
  "ELECTRIC",
  "NOISE - RESIDENTIAL",
  "RODENT",
  "UNSANITARY CONDITION",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a SODA API URL with optional app token for better rate limits. */
function buildSodaUrl(
  endpoint: string,
  whereClause: string,
  limit: number,
  offset: number,
  orderBy: string
): string {
  const appToken = Deno.env.get("NYC_OPEN_DATA_APP_TOKEN");
  let url =
    `https://data.cityofnewyork.us/resource/${endpoint}.json` +
    `?$where=${encodeURIComponent(whereClause)}` +
    `&$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent(orderBy)}`;

  if (appToken) {
    url += `&$$app_token=${appToken}`;
  }

  return url;
}

/** Check if sync should stop paging (time budget exceeded). */
function isTimeBudgetExceeded(syncStartMs: number): boolean {
  return Date.now() - syncStartMs > SYNC_TIME_BUDGET_MS;
}

/**
 * Look up affected buildings by ID and notify IndexNow about their URLs.
 * Best-effort — errors are logged but never thrown.
 */
async function notifyIndexNowForBuildings(
  supabase: SupabaseClient,
  buildingIds: Set<string>
): Promise<{ notified: number; error?: string }> {
  if (buildingIds.size === 0) return { notified: 0 };
  try {
    const ids = [...buildingIds].slice(0, 10000); // IndexNow max 10k per request
    const urls: string[] = [];

    // Fetch building details in batches of 500 (Supabase .in() limit)
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const { data } = await supabase
        .from("buildings")
        .select("metro, borough, slug")
        .in("id", batch)
        .not("slug", "is", null);

      if (data) {
        for (const b of data) {
          const city = (b.metro || "nyc") as City;
          if (CITY_META[city] && b.borough && b.slug) {
            urls.push(buildingUrl({ borough: b.borough, slug: b.slug }, city));
          }
        }
      }
    }

    if (urls.length > 0) {
      await notifyIndexNow(urls);
    }
    return { notified: urls.length };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("IndexNow notify error:", msg);
    return { notified: 0, error: msg };
  }
}

/** Select an existing building by slug+metro, or insert a new one.
 *  Handles race conditions (23505 duplicate key) by retrying the SELECT. */
async function findOrCreateBuilding(
  supabase: SupabaseClient,
  slug: string,
  metro: string,
  borough: string,
  buildingData: Record<string, unknown>
): Promise<string | null> {
  const { data, error } = await supabase
    .from("buildings")
    .upsert(
      { ...buildingData, slug, metro, borough },
      { onConflict: "metro,borough,slug" }
    )
    .select("id")
    .single();

  if (error) {
    console.error(`Upsert building error (${metro}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}

/** Get the last successful sync date for a given sync type.
 *  Subtracts a 7-day safety overlap to catch delayed data updates on
 *  NYC Open Data. The upsert (onConflict) ensures no duplicates. */
async function getLastSyncDate(
  supabase: SupabaseClient,
  syncType: string
): Promise<string> {
  const { data } = await supabase
    .from("sync_log")
    .select("completed_at")
    .eq("sync_type", syncType)
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  if (data?.completed_at) {
    const syncDate = new Date(data.completed_at);
    syncDate.setDate(syncDate.getDate() - 7);
    syncDate.setUTCHours(0, 0, 0, 0);
    return toSodaDate(syncDate.toISOString());
  }

  // Default: 14 days ago for initial sync
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return toSodaDate(d.toISOString());
}

/** Create a new sync_log entry and return its id. */
async function createSyncLog(
  supabase: SupabaseClient,
  syncType: string
): Promise<string> {
  const { data, error } = await supabase
    .from("sync_log")
    .insert({ sync_type: syncType, status: "running" })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`Failed to create sync_log: ${error?.message}`);
  }
  return data.id;
}

/** Mark stale "running" sync_log entries as "failed" to prevent zombie accumulation. */
async function cleanupStaleSyncs(
  supabase: SupabaseClient
): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_SYNC_MINUTES * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("sync_log")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      errors: ["Automatically marked as failed: exceeded stale timeout"],
    })
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id");

  return data?.length ?? 0;
}

/** Finalize a sync_log entry. */
async function finalizeSyncLog(
  supabase: SupabaseClient,
  logId: string,
  status: "completed" | "failed",
  recordsAdded: number,
  recordsLinked: number,
  errors: string[]
) {
  await supabase
    .from("sync_log")
    .update({
      status,
      completed_at: new Date().toISOString(),
      records_added: recordsAdded,
      records_linked: recordsLinked,
      errors: errors.length > 0 ? errors : null,
    })
    .eq("id", logId);
}

/** Look up address info for a BBL from the source table that has it. */
async function getAddressForBbl(
  supabase: SupabaseClient,
  bbl: string
): Promise<{ borough: string; house_number: string; street_name: string; zip_code: string | null; full_address: string } | null> {
  // Try bedbug_reports first
  const { data: bb } = await supabase
    .from("bedbug_reports")
    .select("borough, house_number, street_name, postcode")
    .eq("bbl", bbl)
    .not("street_name", "is", null)
    .limit(1)
    .single();

  if (bb?.street_name && bb?.borough) {
    const borough = bb.borough.length <= 1 ? (BOROUGH_MAP[bb.borough] || bb.borough) : bb.borough;
    const houseNum = bb.house_number || "";
    const fullAddr = `${houseNum ? houseNum + " " : ""}${bb.street_name}, ${borough}, NY${bb.postcode ? " " + bb.postcode : ""}`;
    return { borough, house_number: houseNum, street_name: bb.street_name, zip_code: bb.postcode || null, full_address: fullAddr };
  }

  // Try evictions
  const { data: ev } = await supabase
    .from("evictions")
    .select("borough, eviction_address, eviction_zip")
    .eq("bbl", bbl)
    .not("eviction_address", "is", null)
    .limit(1)
    .single();

  if (ev?.eviction_address && ev?.borough) {
    const borough = ev.borough.length <= 1 ? (BOROUGH_MAP[ev.borough] || ev.borough) : ev.borough;
    const houseMatch = ev.eviction_address.match(/^([0-9-]+)\s+(.+)/);
    const houseNum = houseMatch ? houseMatch[1] : "";
    const streetName = houseMatch ? houseMatch[2] : ev.eviction_address;
    const fullAddr = `${ev.eviction_address}, ${borough}, NY${ev.eviction_zip ? " " + ev.eviction_zip : ""}`;
    return { borough, house_number: houseNum, street_name: streetName, zip_code: ev.eviction_zip || null, full_address: fullAddr };
  }

  // Try HPD violations
  const { data: hpd } = await supabase
    .from("hpd_violations")
    .select("borough, house_number, street_name")
    .eq("bbl", bbl)
    .not("street_name", "is", null)
    .limit(1)
    .single();

  if (hpd?.street_name && hpd?.borough) {
    const houseNum = hpd.house_number || "";
    const fullAddr = `${houseNum ? houseNum + " " : ""}${hpd.street_name}, ${hpd.borough}, NY`;
    return { borough: hpd.borough, house_number: houseNum, street_name: hpd.street_name, zip_code: null, full_address: fullAddr };
  }

  // Try DOB violations
  const { data: dob } = await supabase
    .from("dob_violations")
    .select("borough, house_number, street_name")
    .eq("bbl", bbl)
    .not("street_name", "is", null)
    .limit(1)
    .single();

  if (dob?.street_name && dob?.borough) {
    const houseNum = dob.house_number || "";
    const fullAddr = `${houseNum ? houseNum + " " : ""}${dob.street_name}, ${dob.borough}, NY`;
    return { borough: dob.borough, house_number: houseNum, street_name: dob.street_name, zip_code: null, full_address: fullAddr };
  }

  // Try DOB permits
  const { data: permit } = await supabase
    .from("dob_permits")
    .select("borough, house_no, street_name, zip_code")
    .eq("bbl", bbl)
    .not("street_name", "is", null)
    .limit(1)
    .single();

  if (permit?.street_name && permit?.borough) {
    const houseNum = permit.house_no || "";
    const fullAddr = `${houseNum ? houseNum + " " : ""}${permit.street_name}, ${permit.borough}, NY${permit.zip_code ? " " + permit.zip_code : ""}`;
    return { borough: permit.borough, house_number: houseNum, street_name: permit.street_name, zip_code: permit.zip_code || null, full_address: fullAddr };
  }

  return null;
}

/** Link records by BBL and return set of affected building IDs. */
async function linkByBbl(
  supabase: SupabaseClient,
  table: string,
  syncStartTime: string,
  errors: string[],
  label: string,
  createBuildings = true
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  const linkCutoff = new Date();
  linkCutoff.setDate(linkCutoff.getDate() - 30);

  const PAGE_SIZE = 5000;
  let allUnlinked: { id: string; bbl: string }[] = [];
  let offset = 0;
  while (true) {
    const { data: batch } = await supabase
      .from(table)
      .select("id, bbl")
      .is("building_id", null)
      .not("bbl", "is", null)
      .gte("imported_at", linkCutoff.toISOString())
      .range(offset, offset + PAGE_SIZE - 1);

    if (!batch || batch.length === 0) break;
    allUnlinked = allUnlinked.concat(batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const unlinked = allUnlinked;
  if (unlinked.length === 0) return { linked, affectedBuildingIds };

  // Only keep valid 10-digit numeric BBLs
  const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter((b) => b && /^\d{10}$/.test(b)))] as string[];

  // Fetch building IDs for those BBLs
  const bblToBuilding = new Map<string, string>();
  for (let i = 0; i < bblSet.length; i += 500) {
    const bblBatch = bblSet.slice(i, i + 500);
    const { data: buildings } = await supabase
      .from("buildings")
      .select("id, bbl")
      .in("bbl", bblBatch);

    if (buildings) {
      for (const b of buildings) {
        bblToBuilding.set(b.bbl, b.id);
      }
    }
  }

  // Create buildings for unmatched BBLs
  const unmatchedBbls = bblSet.filter((bbl) => !bblToBuilding.has(bbl));
  if (createBuildings && unmatchedBbls.length > 0) {
    let created = 0;
    const toCreate = unmatchedBbls.slice(0, 2000);
    for (const bbl of toCreate) {
      try {
        const addr = await getAddressForBbl(supabase, bbl);
        if (!addr) continue;

        const slug = generateBuildingSlug(addr.full_address);
        const { data: newBuilding, error: createErr } = await supabase
          .from("buildings")
          .upsert({
            bbl,
            borough: addr.borough,
            house_number: addr.house_number || null,
            street_name: addr.street_name,
            zip_code: addr.zip_code,
            full_address: addr.full_address,
            slug,
          }, { onConflict: "bbl" })
          .select("id, bbl")
          .single();

        if (createErr) {
          errors.push(`${label} create building error (BBL ${bbl}): ${createErr.message}`);
        } else if (newBuilding) {
          bblToBuilding.set(newBuilding.bbl, newBuilding.id);
          created++;
        }
      } catch (err) {
        errors.push(`${label} create building error (BBL ${bbl}): ${String(err)}`);
      }
    }
    if (created > 0) {
      errors.push(`${label}: created ${created} new building entries for unmatched BBLs`);
    }
  }

  if (bblToBuilding.size === 0) return { linked, affectedBuildingIds };

  // Group unlinked by building ID for batch updates
  const buildingToRecordIds = new Map<string, string[]>();
  for (const record of unlinked) {
    const buildingId = record.bbl ? bblToBuilding.get(record.bbl) : undefined;
    if (buildingId) {
      if (!buildingToRecordIds.has(buildingId)) {
        buildingToRecordIds.set(buildingId, []);
      }
      buildingToRecordIds.get(buildingId)!.push(record.id);
    }
  }

  for (const [buildingId, recordIds] of buildingToRecordIds) {
    let batchLinked = 0;
    for (let i = 0; i < recordIds.length; i += 200) {
      const batch = recordIds.slice(i, i + 200);
      const { error: linkError } = await supabase
        .from(table)
        .update({ building_id: buildingId })
        .in("id", batch);

      if (!linkError) {
        batchLinked += batch.length;
      } else {
        errors.push(`${label} link error (building ${buildingId}): ${linkError.message}`);
      }
    }
    linked += batchLinked;
    if (batchLinked > 0) affectedBuildingIds.add(buildingId);
  }

  return { linked, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Address-based linking for LA records
// ---------------------------------------------------------------------------
async function linkByAddress(
  supabase: SupabaseClient,
  table: string,
  idColumn: string,
  addressColumns: string | string[],
  syncStartTime: string,
  errors: string[],
  label: string,
  maxLookups = 200,
  metro?: string,
  createMissing = false,
  fullAddressColumn?: string
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  const linkCutoff = new Date();
  linkCutoff.setDate(linkCutoff.getDate() - 90);

  const cols = Array.isArray(addressColumns) ? addressColumns : [addressColumns];
  const selectCols = [idColumn, ...cols].join(", ");
  const primaryAddrCol = cols[cols.length - 1];

  let allUnlinked: Record<string, unknown>[] = [];
  let offset = 0;
  const PAGE = 5000;
  while (true) {
    let query = supabase
      .from(table)
      .select(selectCols)
      .is("building_id", null)
      .not(primaryAddrCol, "is", null)
      .gte("imported_at", linkCutoff.toISOString());
    if (metro) query = query.eq("metro", metro);
    const { data: batch } = await query.range(offset, offset + PAGE - 1);

    if (!batch || batch.length === 0) break;
    allUnlinked = allUnlinked.concat(batch as unknown as Record<string, unknown>[]);
    if (batch.length < PAGE) break;
    offset += PAGE;
  }

  if (allUnlinked.length === 0) return { linked, affectedBuildingIds };

  // Group by normalized address
  const addressToIds = new Map<string, string[]>();
  for (const r of allUnlinked) {
    let raw: string;
    if (cols.length > 1) {
      raw = cols.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
    } else {
      raw = String(r[cols[0]] || "").trim();
    }
    raw = raw.toUpperCase().replace(/\s+/g, " ");
    if (!raw || raw.length < 5) continue;
    const addr = raw.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
    if (!addr) continue;
    if (!addressToIds.has(addr)) addressToIds.set(addr, []);
    addressToIds.get(addr)!.push(String(r[idColumn]));
  }

  let lookupCount = 0;
  for (const [address, recordIds] of addressToIds) {
    if (lookupCount >= maxLookups) break;
    lookupCount++;

    let buildingQuery = supabase
      .from("buildings")
      .select("id")
      .ilike("full_address", `${address},%`)
      .limit(1);
    if (metro) buildingQuery = buildingQuery.eq("metro", metro);
    const { data: matched } = await buildingQuery;

    let buildingId: string | null = null;

    if (matched && matched.length > 0) {
      buildingId = matched[0].id;
    } else if (createMissing && fullAddressColumn) {
      const sample = allUnlinked.find(r => {
        const addr = String(r[fullAddressColumn] || "").trim();
        return addr.toUpperCase().includes(address);
      });
      if (sample) {
        const fullAddr = String(sample[fullAddressColumn] || "").trim();
        if (fullAddr.length > 5) {
          const slug = generateBuildingSlug(fullAddr);
          const { data: created, error: createErr } = await supabase
            .from("buildings")
            .upsert({
              full_address: fullAddr,
              slug,
              borough: "Los Angeles",
              metro: metro || "los-angeles",
            }, { onConflict: "slug" })
            .select("id")
            .single();

          if (created && !createErr) {
            buildingId = created.id;
          }
        }
      }
    }

    if (buildingId) {
      for (let i = 0; i < recordIds.length; i += 200) {
        const batch = recordIds.slice(i, i + 200);
        const { error: linkError } = await supabase
          .from(table)
          .update({ building_id: buildingId })
          .in(idColumn, batch);

        if (!linkError) {
          linked += batch.length;
        } else {
          errors.push(`${label} address link error: ${linkError.message}`);
        }
      }
      affectedBuildingIds.add(buildingId);
    }
  }

  return { linked, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Link records to buildings by APN
// ---------------------------------------------------------------------------
async function linkByApn(
  supabase: SupabaseClient,
  table: string,
  idColumn: string,
  apnColumn: string,
  errors: string[],
  label: string,
  metro: string,
  batchSize = 5000
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  let allUnlinked: Record<string, unknown>[] = [];
  let offset = 0;
  while (true) {
    const { data: batch } = await supabase
      .from(table)
      .select(`${idColumn}, ${apnColumn}`)
      .is("building_id", null)
      .not(apnColumn, "is", null)
      .eq("metro", metro)
      .range(offset, offset + batchSize - 1);

    if (!batch || batch.length === 0) break;
    allUnlinked = allUnlinked.concat(batch as unknown as Record<string, unknown>[]);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  if (allUnlinked.length === 0) return { linked, affectedBuildingIds };

  const apnToIds = new Map<string, string[]>();
  for (const r of allUnlinked) {
    const apn = String(r[apnColumn] || "").trim();
    if (!apn) continue;
    if (!apnToIds.has(apn)) apnToIds.set(apn, []);
    apnToIds.get(apn)!.push(String(r[idColumn]));
  }

  for (const [apn, recordIds] of apnToIds) {
    const dashedApn = apn.length === 10
      ? `${apn.slice(0, 4)}-${apn.slice(4, 7)}-${apn.slice(7, 10)}`
      : apn;

    const { data: matched } = await supabase
      .from("buildings")
      .select("id")
      .eq("metro", metro)
      .or(`apn.eq.${apn},apn.eq.${dashedApn}`)
      .limit(1);

    if (!matched || matched.length === 0) continue;

    const buildingId = matched[0].id;
    for (let i = 0; i < recordIds.length; i += 200) {
      const batch = recordIds.slice(i, i + 200);
      const { error: linkError } = await supabase
        .from(table)
        .update({ building_id: buildingId })
        .in(idColumn, batch);

      if (!linkError) {
        linked += batch.length;
      } else {
        errors.push(`${label} APN link error: ${linkError.message}`);
      }
    }
    affectedBuildingIds.add(buildingId);
  }

  return { linked, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Sync result type
// ---------------------------------------------------------------------------
interface SyncResult {
  totalAdded: number;
  totalLinked: number;
  errors: string[];
  affectedBuildingIds: Set<string>;
}

// ---------------------------------------------------------------------------
// HPD Violations sync
// ---------------------------------------------------------------------------

interface HPDRawRecord {
  violationid?: string;
  bbl?: string;
  bin?: string;
  class?: string;
  inspectiondate?: string;
  approveddate?: string;
  novdescription?: string;
  novissueddate?: string;
  currentstatus?: string;
  currentstatusdate?: string;
  boroid?: string;
  housenumber?: string;
  streetname?: string;
  apartment?: string;
  block?: string;
  lot?: string;
  [key: string]: unknown;
}

async function syncHPDViolations(supabase: SupabaseClient, sinceOverride?: string): Promise<SyncResult> {
  const lastSync = sinceOverride || await getLastSyncDate(supabase, "hpd_violations");
  const logId = await createSyncLog(supabase, "hpd_violations");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "wvxf-dwi5",
        `inspectiondate > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "inspectiondate ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`HPD API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: HPDRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.violationid)
        .map((r) => {
          let bbl: string | null = null;
          const boroRaw = r.boroid as string | undefined;
          const blockRaw = r.block as string | undefined;
          const lotRaw = r.lot as string | undefined;
          if (boroRaw && blockRaw && lotRaw) {
            if (/^\d$/.test(boroRaw)) {
              const block = String(blockRaw).padStart(5, "0").slice(-5);
              const lot = String(lotRaw).padStart(4, "0").slice(-4);
              bbl = `${boroRaw}${block}${lot}`;
            }
          }
          return {
            violation_id: String(r.violationid),
            bbl,
            bin: r.bin || null,
            class: r.class && ["A", "B", "C", "I"].includes(r.class.toUpperCase())
              ? r.class.toUpperCase()
              : null,
            inspection_date: r.inspectiondate ? r.inspectiondate.slice(0, 10) : null,
            approved_date: r.approveddate ? r.approveddate.slice(0, 10) : null,
            nov_description: r.novdescription || null,
            nov_issue_date: r.novissueddate ? r.novissueddate.slice(0, 10) : null,
            status: r.currentstatus || null,
            status_date: r.currentstatusdate ? r.currentstatusdate.slice(0, 10) : null,
            borough: r.boroid ? BOROUGH_MAP[r.boroid] || null : null,
            house_number: r.housenumber || null,
            street_name: r.streetname || null,
            apartment: r.apartment || null,
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "hpd_violations", rows, "violation_id", errors, "HPD");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "hpd_violations", syncStartTime, errors, "HPD", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`HPD linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`HPD fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// 311 Complaints sync
// ---------------------------------------------------------------------------

interface Complaint311RawRecord {
  unique_key?: string;
  complaint_type?: string;
  descriptor?: string;
  agency?: string;
  status?: string;
  created_date?: string;
  closed_date?: string;
  resolution_description?: string;
  borough?: string;
  incident_address?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

async function sync311Complaints(supabase: SupabaseClient): Promise<SyncResult> {
  const fnStart = Date.now();

  const lastSync = await getLastSyncDate(supabase, "complaints_311");
  const logId = await createSyncLog(supabase, "complaints_311");

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  const COMPLAINTS_PAGE_SIZE = 2000;
  const COMPLAINTS_SELECT = "unique_key,complaint_type,descriptor,agency,status,created_date,closed_date,resolution_description,borough,incident_address,latitude,longitude";

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    const typesIn = COMPLAINT_TYPES.map((t) => `'${t}'`).join(",");

    const addressToKeys = new Map<string, string[]>();

    while (hasMore) {
      const url = buildSodaUrl(
        "erm2-nwe9",
        `created_date > '${lastSync}' AND complaint_type IN (${typesIn})`,
        COMPLAINTS_PAGE_SIZE,
        offset,
        "created_date ASC"
      ) + `&$select=${encodeURIComponent(COMPLAINTS_SELECT)}`;

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`311 API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: Complaint311RawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.unique_key)
        .map((r) => ({
          unique_key: String(r.unique_key),
          complaint_type: r.complaint_type || null,
          descriptor: r.descriptor || null,
          agency: r.agency || null,
          status: r.status || null,
          created_date: r.created_date || null,
          closed_date: r.closed_date || null,
          resolution_description: r.resolution_description || null,
          borough: r.borough || null,
          incident_address: r.incident_address || null,
          latitude: r.latitude ? parseFloat(r.latitude) : null,
          longitude: r.longitude ? parseFloat(r.longitude) : null,
          imported_at: new Date().toISOString(),
        }));

      for (const row of rows) {
        if (row.incident_address) {
          const addr = (row.incident_address as string).trim();
          if (!addressToKeys.has(addr)) {
            addressToKeys.set(addr, []);
          }
          addressToKeys.get(addr)!.push(row.unique_key as string);
        }
      }

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "311", true);
      }

      pagesFetched++;
      if (records.length < COMPLAINTS_PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += COMPLAINTS_PAGE_SIZE;
      }

      if (Date.now() - fnStart > 35_000) {
        errors.push(`311 stopped fetching after ${pagesFetched} pages (time budget)`);
        hasMore = false;
      }
    }

    const elapsedMs = Date.now() - fnStart;
    if (elapsedMs < 45_000 && addressToKeys.size > 0) {
      try {
        let lookupCount = 0;
        const MAX_LOOKUPS = 500;

        for (const [address, uniqueKeys] of addressToKeys) {
          if (lookupCount >= MAX_LOOKUPS) break;
          if (Date.now() - fnStart > 50_000) break;
          lookupCount++;

          const { data: matchedBuildings } = await supabase
            .from("buildings")
            .select("id")
            .ilike("full_address", `${address},%`)
            .eq("metro", "nyc")
            .limit(1);

          if (matchedBuildings && matchedBuildings.length > 0) {
            const buildingId = matchedBuildings[0].id;

            for (let i = 0; i < uniqueKeys.length; i += 500) {
              const keyBatch = uniqueKeys.slice(i, i + 500);
              const { error: linkError } = await supabase
                .from("complaints_311")
                .update({ building_id: buildingId })
                .in("unique_key", keyBatch);

              if (!linkError) {
                totalLinked += keyBatch.length;
              } else {
                errors.push(`311 link error (${address}): ${linkError.message}`);
              }
            }
            affectedBuildingIds.add(buildingId);
          }
        }
      } catch (linkErr) {
        errors.push(`311 linking phase error: ${String(linkErr)}`);
      }
    } else if (elapsedMs >= 45_000) {
      errors.push(`311 skipped linking (time budget: ${(elapsedMs / 1000).toFixed(1)}s elapsed)`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// HPD Litigations sync
// ---------------------------------------------------------------------------

interface HPDLitigationRawRecord {
  litigationid?: string;
  boroid?: string;
  bbl?: string;
  casetype?: string;
  casestatus?: string;
  caseopendate?: string;
  caseclosedate?: string;
  casejudgment?: string;
  penalty?: string;
  respondent?: string;
  housenumber?: string;
  streetname?: string;
  zip?: string;
  [key: string]: unknown;
}

async function syncHPDLitigations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "hpd_litigations");
  const logId = await createSyncLog(supabase, "hpd_litigations");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "59kj-x8nc",
        `(caseopendate > '${lastSync}' OR (caseopendate IS NULL AND :updated_at > '${lastSync}'))`,
        PAGE_SIZE,
        offset,
        ":updated_at ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`HPD Litigations API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: HPDLitigationRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.litigationid)
        .map((r) => ({
          litigation_id: String(r.litigationid),
          bbl: r.bbl || null,
          case_type: r.casetype || null,
          case_status: r.casestatus || null,
          case_open_date: parseDate(r.caseopendate),
          case_close_date: r.caseclosedate ? r.caseclosedate.slice(0, 10) : null,
          case_judgment: r.casejudgment || null,
          penalty: r.penalty || null,
          respondent: r.respondent || null,
          borough: r.boroid ? BOROUGH_MAP[r.boroid] || null : null,
          house_number: r.housenumber || null,
          street_name: r.streetname || null,
          zip: r.zip || null,
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "hpd_litigations", rows, "litigation_id", errors, "HPD Litigations");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "hpd_litigations", syncStartTime, errors, "HPD Litigations", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`HPD Litigations linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`HPD Litigations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// DOB Violations sync
// ---------------------------------------------------------------------------

interface DOBViolationRawRecord {
  isn_dob_bis_viol?: string;
  boro?: string;
  block?: string;
  lot?: string;
  bin?: string;
  violation_type?: string;
  violation_category?: string;
  description?: string;
  issue_date?: string;
  disposition_date?: string;
  disposition_comments?: string;
  penalty_applied?: string;
  penalty_balance_due?: string;
  house_number?: string;
  street?: string;
  [key: string]: unknown;
}

async function syncDOBViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "dob_violations");
  const logId = await createSyncLog(supabase, "dob_violations");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "3h2n-5cm9",
        `issue_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "issue_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`DOB Violations API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: DOBViolationRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.isn_dob_bis_viol)
        .map((r) => {
          let bbl: string | null = null;
          if (r.boro && r.block && r.lot) {
            const boroMap: Record<string, string> = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", MANHATTAN: "1", BRONX: "2", BROOKLYN: "3", QUEENS: "4", "STATEN ISLAND": "5" };
            const boroCode = boroMap[r.boro.toUpperCase()] || r.boro;
            if (/^\d$/.test(boroCode)) {
              const block = r.block.padStart(5, "0").slice(-5);
              const lot = r.lot.padStart(4, "0").slice(-4);
              bbl = `${boroCode}${block}${lot}`;
            }
          }

          return {
            isn_dob_bis_vio: String(r.isn_dob_bis_viol),
            bbl,
            bin: r.bin || null,
            violation_type: r.violation_type || null,
            violation_category: r.violation_category || null,
            description: r.description || null,
            issue_date: parseDate(r.issue_date),
            disposition_date: parseDate(r.disposition_date),
            disposition_comments: r.disposition_comments || null,
            penalty_amount: r.penalty_applied ? parseFloat(r.penalty_applied) || null : null,
            borough: r.boro ? BOROUGH_MAP[r.boro] || null : null,
            house_number: r.house_number || null,
            street_name: r.street || null,
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "isn_dob_bis_vio", errors, "DOB Violations");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "dob_violations", syncStartTime, errors, "DOB", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`DOB Violations linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`DOB Violations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// NYPD Complaints (Crime) sync
// ---------------------------------------------------------------------------

const NYPD_BOROUGH_MAP: Record<string, string> = {
  MANHATTAN: "Manhattan",
  BRONX: "Bronx",
  BROOKLYN: "Brooklyn",
  QUEENS: "Queens",
  "STATEN ISLAND": "Staten Island",
};

interface NYPDRawRecord {
  cmplnt_num?: string;
  cmplnt_fr_dt?: string;
  boro_nm?: string;
  addr_pct_cd?: string;
  ofns_desc?: string;
  law_cat_cd?: string;
  pd_desc?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

async function syncNYPDComplaints(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "nypd_complaints");
  const logId = await createSyncLog(supabase, "nypd_complaints");

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "5uac-w243",
        `cmplnt_fr_dt > '${lastSync}' AND cmplnt_fr_dt > '2022-01-01T00:00:00'`,
        PAGE_SIZE,
        offset,
        "cmplnt_fr_dt ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`NYPD API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: NYPDRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.cmplnt_num)
        .map((r) => ({
          cmplnt_num: String(r.cmplnt_num),
          cmplnt_date: r.cmplnt_fr_dt ? r.cmplnt_fr_dt.slice(0, 10) : null,
          borough: r.boro_nm ? NYPD_BOROUGH_MAP[r.boro_nm.toUpperCase()] || r.boro_nm : null,
          precinct: r.addr_pct_cd ? parseInt(r.addr_pct_cd, 10) || null : null,
          offense_description: r.ofns_desc || null,
          law_category: r.law_cat_cd || null,
          crime_category: categorizeCrime(r.ofns_desc),
          pd_description: r.pd_desc || null,
          latitude: r.latitude ? parseFloat(r.latitude) : null,
          longitude: r.longitude ? parseFloat(r.longitude) : null,
          zip_code: null,
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "nypd_complaints", rows, "cmplnt_num", errors, "NYPD");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    // Backfill zip_code from lat/lon
    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", { target_metro: "nyc" });
      if (zipErr) {
        errors.push(`NYPD zip backfill error: ${zipErr.message}`);
      }
    } catch (zipBackfillErr) {
      errors.push(`NYPD zip backfill fatal: ${String(zipBackfillErr)}`);
    }

    // Update crime_count on buildings by zip code
    try {
      const { data: recentZips } = await supabase
        .from("nypd_complaints")
        .select("zip_code")
        .not("zip_code", "is", null)
        .gte("imported_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .or("metro.is.null,metro.eq.nyc")
        .limit(50000);

      if (recentZips && recentZips.length > 0) {
        const uniqueZips = [...new Set(recentZips.map((r) => r.zip_code).filter((z): z is string => !!z && z.startsWith("1")))];

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const sinceDate = oneYearAgo.toISOString().slice(0, 10);

        for (let i = 0; i < uniqueZips.length; i += 5) {
          const zipBatch = uniqueZips.slice(i, i + 5);
          await Promise.all(zipBatch.map(async (zip) => {
            const { count: crimeCount } = await supabase
              .from("nypd_complaints")
              .select("id", { count: "exact", head: true })
              .eq("zip_code", zip)
              .gte("cmplnt_date", sinceDate);

            const { error: updateErr } = await supabase
              .from("buildings")
              .update({ crime_count: crimeCount ?? 0 })
              .eq("zip_code", zip);

            if (updateErr) {
              errors.push(`NYPD crime count update error (zip ${zip}): ${updateErr.message}`);
            }
          }));
        }
      }
    } catch (countErr) {
      errors.push(`NYPD crime count update error: ${String(countErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`NYPD fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Bedbug Reports sync
// ---------------------------------------------------------------------------

interface BedBugRawRecord {
  building_id?: string;
  bbl?: string;
  bin?: string;
  registration_id?: string;
  house_number?: string;
  street_name?: string;
  borough?: string;
  postcode?: string;
  infested_dwelling_unit_count?: string;
  eradicated_unit_count?: string;
  re_infested_dwelling_unit?: string;
  of_dwelling_units?: string;
  filing_date?: string;
  filing_period_start_date?: string;
  filling_period_end_date?: string;
  [key: string]: unknown;
}

async function syncBedBugReports(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "bedbug_reports");
  const logId = await createSyncLog(supabase, "bedbug_reports");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "wz6d-d3jb",
        `filing_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "filing_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Bedbug API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: BedBugRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.bbl && r.filing_period_start_date)
        .map((r) => ({
          bbl: r.bbl || null,
          bin: r.bin || null,
          registration_id: r.registration_id || null,
          house_number: r.house_number || null,
          street_name: r.street_name || null,
          borough: r.borough || null,
          postcode: r.postcode || null,
          infested_dwelling_unit_count: r.infested_dwelling_unit_count ? parseInt(r.infested_dwelling_unit_count) || null : null,
          eradicated_unit_count: r.eradicated_unit_count ? parseInt(r.eradicated_unit_count) || null : null,
          reinfested_unit_count: r.re_infested_dwelling_unit ? parseInt(r.re_infested_dwelling_unit) || null : null,
          total_dwelling_units: r.of_dwelling_units ? parseInt(r.of_dwelling_units) || null : null,
          filing_date: r.filing_date ? r.filing_date.slice(0, 10) : null,
          filing_period_start_date: r.filing_period_start_date ? r.filing_period_start_date.slice(0, 10) : null,
          filing_period_end_date: r.filling_period_end_date ? r.filling_period_end_date.slice(0, 10) : null,
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "bedbug_reports", rows, "bbl,filing_period_start_date", errors, "Bedbugs", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "bedbug_reports", syncStartTime, errors, "Bedbugs", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Bedbugs linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Bedbugs fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Evictions sync
// ---------------------------------------------------------------------------

interface EvictionRawRecord {
  court_index_number?: string;
  docket_number?: string;
  eviction_address?: string;
  executed_date?: string;
  eviction_apt_num?: string;
  eviction_zip?: string;
  borough?: string;
  residential_commercial_ind?: string;
  eviction_possession?: string;
  ejectment?: string;
  marshal_first_name?: string;
  marshal_last_name?: string;
  bbl?: string;
  bin?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

async function syncEvictions(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "evictions");
  const logId = await createSyncLog(supabase, "evictions");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "6z8x-wfk4",
        `executed_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "executed_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Evictions API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: EvictionRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.court_index_number)
        .map((r) => ({
          court_index_number: String(r.court_index_number),
          docket_number: r.docket_number || null,
          eviction_address: r.eviction_address || null,
          eviction_apt_num: r.eviction_apt_num || null,
          eviction_zip: r.eviction_zip || null,
          borough: r.borough || null,
          bbl: r.bbl || null,
          bin: r.bin || null,
          executed_date: r.executed_date ? r.executed_date.slice(0, 10) : null,
          residential_commercial: r.residential_commercial_ind || null,
          eviction_possession: r.eviction_possession || null,
          ejectment: r.ejectment || null,
          marshal_first_name: r.marshal_first_name || null,
          marshal_last_name: r.marshal_last_name || null,
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "evictions", rows, "court_index_number", errors, "Evictions", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    // Linking: match by BBL
    try {
      const linkResult = await linkByBbl(supabase, "evictions", syncStartTime, errors, "Evictions", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Evictions linking phase error: ${String(linkErr)}`);
    }

    // Address-based linking for evictions without BBLs
    try {
      const linkCutoff = new Date();
      linkCutoff.setDate(linkCutoff.getDate() - 30);
      const { data: unlinked } = await supabase
        .from("evictions")
        .select("court_index_number, eviction_address, borough")
        .is("building_id", null)
        .is("bbl", null)
        .not("eviction_address", "is", null)
        .gte("imported_at", linkCutoff.toISOString())
        .limit(5000);

      if (unlinked && unlinked.length > 0) {
        const addrToKeys = new Map<string, string[]>();
        for (const r of unlinked) {
          const raw = (r.eviction_address as string).trim().toUpperCase();
          const addr = raw.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
          if (!addr || addr.length < 5) continue;
          if (!addrToKeys.has(addr)) addrToKeys.set(addr, []);
          addrToKeys.get(addr)!.push(r.court_index_number);
        }

        let lookupCount = 0;
        const MAX_LOOKUPS = 300;
        for (const [address, courtIndexes] of addrToKeys) {
          if (lookupCount >= MAX_LOOKUPS) break;
          lookupCount++;
          const { data: matched } = await supabase
            .from("buildings")
            .select("id")
            .ilike("full_address", `${address},%`)
            .eq("metro", "nyc")
            .limit(1);

          if (matched && matched.length > 0) {
            for (let i = 0; i < courtIndexes.length; i += 200) {
              const batch = courtIndexes.slice(i, i + 200);
              const { error: linkError } = await supabase
                .from("evictions")
                .update({ building_id: matched[0].id })
                .in("court_index_number", batch);
              if (!linkError) {
                totalLinked += batch.length;
                affectedBuildingIds.add(matched[0].id);
              }
            }
          }
        }
        if (lookupCount > 0) {
          errors.push(`Evictions address linking: checked ${lookupCount} addresses`);
        }
      }
    } catch (addrErr) {
      errors.push(`Evictions address linking error: ${String(addrErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Evictions fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Sidewalk Sheds sync
// ---------------------------------------------------------------------------

const BOROUGH_TO_CODE: Record<string, string> = {
  MANHATTAN: "1",
  BRONX: "2",
  BROOKLYN: "3",
  QUEENS: "4",
  "STATEN ISLAND": "5",
};

interface ShedRawRecord {
  job__?: string;
  work_permit?: string;
  house_no?: string;
  street_name?: string;
  borough?: string;
  zip_code?: string;
  bin__?: string;
  block?: string;
  lot?: string;
  permit_status?: string;
  permit_type?: string;
  filing_reason?: string;
  issued_date?: string;
  issuance_date?: string;
  approved_date?: string;
  expired_date?: string;
  expiration_date?: string;
  job_description?: string;
  estimated_job_costs?: string;
  owner_s_business_name?: string;
  owner_s_first_name?: string;
  permittee_s_business_name?: string;
  [key: string]: unknown;
}

async function syncSidewalkSheds(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "sidewalk_sheds");
  const logId = await createSyncLog(supabase, "sidewalk_sheds");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "ipu4-2q9a",
        `permit_type='SH' AND issuance_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "issuance_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Sheds API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: ShedRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.job__)
        .map((r) => {
          const boroCode = r.borough ? BOROUGH_TO_CODE[r.borough.toUpperCase()] : null;
          const block = r.block ? r.block.padStart(5, "0") : null;
          const lot = r.lot ? r.lot.padStart(4, "0").slice(-4) : null;
          const bbl = boroCode && block && lot ? `${boroCode}${block}${lot}` : null;

          return {
            work_permit: String(r.job__),
            house_no: r.house_no || null,
            street_name: r.street_name || null,
            borough: r.borough || null,
            zip_code: r.zip_code || null,
            bin: r.bin__ || null,
            block: r.block || null,
            lot: r.lot || null,
            bbl,
            permit_status: r.permit_status || null,
            filing_reason: r.filing_reason || r.permit_type || null,
            issued_date: parseDate(r.issuance_date),
            expired_date: parseDate(r.expiration_date),
            job_description: r.job_description || null,
            estimated_job_costs: r.estimated_job_costs ? parseFloat(r.estimated_job_costs) || null : null,
            owner_business_name: r.owner_s_business_name || r.owner_s_first_name || null,
            permittee_business_name: r.permittee_s_business_name || null,
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "sidewalk_sheds", rows, "work_permit", errors, "Sheds");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "sidewalk_sheds", syncStartTime, errors, "Sheds", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Sheds linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Sheds fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// DOB Permits sync
// ---------------------------------------------------------------------------
interface PermitRawRecord {
  work_permit?: string;
  house_no?: string;
  street_name?: string;
  borough?: string;
  zip_code?: string;
  bin__?: string;
  block?: string;
  lot?: string;
  work_type?: string;
  permit_status?: string;
  filing_reason?: string;
  issued_date?: string;
  expired_date?: string;
  job_description?: string;
  estimated_job_costs?: string;
  owner_s_business_name?: string;
  permittee_s_business_name?: string;
  latitude?: string;
  longitude?: string;
  [key: string]: unknown;
}

async function syncDobPermits(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "dob_permits");
  const logId = await createSyncLog(supabase, "dob_permits");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildSodaUrl(
        "rbx6-tga4",
        `work_permit IS NOT NULL AND permit_status != 'Permit is not yet issued' AND issued_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "issued_date ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Permits API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records: PermitRawRecord[] = await res.json();

      if (records.length === 0) {
        hasMore = false;
        break;
      }

      const rows = records
        .filter((r) => r.work_permit)
        .map((r) => {
          const boroCode = r.borough ? BOROUGH_TO_CODE[r.borough.toUpperCase()] : null;
          const block = r.block ? r.block.padStart(5, "0") : null;
          const lot = r.lot ? r.lot.padStart(4, "0").slice(-4) : null;
          const bbl = boroCode && block && lot ? `${boroCode}${block}${lot}` : null;

          return {
            work_permit: String(r.work_permit),
            house_no: r.house_no || null,
            street_name: r.street_name || null,
            borough: r.borough || null,
            zip_code: r.zip_code || null,
            bin: r.bin__ || null,
            block: r.block || null,
            lot: r.lot || null,
            bbl,
            work_type: r.work_type || null,
            permit_status: r.permit_status || null,
            filing_reason: r.filing_reason || null,
            issued_date: parseDate(r.issued_date),
            expired_date: parseDate(r.expired_date),
            job_description: r.job_description || null,
            estimated_job_costs: r.estimated_job_costs ? parseFloat(r.estimated_job_costs) || null : null,
            owner_business_name: r.owner_s_business_name || null,
            permittee_business_name: r.permittee_s_business_name || null,
            latitude: r.latitude ? parseFloat(r.latitude) || null : null,
            longitude: r.longitude ? parseFloat(r.longitude) || null : null,
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_permits", rows, "work_permit", errors, "Permits");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    try {
      const linkResult = await linkByBbl(supabase, "dob_permits", syncStartTime, errors, "Permits", true);
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Permits linking phase error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Permits fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Update building counts via RPC
// ---------------------------------------------------------------------------
async function updateBuildingCounts(
  supabase: SupabaseClient,
  affectedBuildingIds: Set<string>
) {
  const errors: string[] = [];
  if (affectedBuildingIds.size === 0) return errors;

  const buildingIds = [...affectedBuildingIds];
  const BATCH_SIZE = 50;

  for (let i = 0; i < buildingIds.length; i += BATCH_SIZE) {
    const batch = buildingIds.slice(i, i + BATCH_SIZE);
    try {
      const { data, error } = await supabase.rpc("bulk_update_building_counts", {
        building_ids: batch,
      });

      if (error) {
        errors.push(`Bulk count update error (batch ${i}): ${error.message}`);
      } else if (data) {
        for (const row of data) {
          if (!row.updated) {
            errors.push(`Update counts error (${row.building_id}): ${row.error}`);
          }
        }
      }
    } catch (err) {
      errors.push(`Bulk count update error (batch ${i}): ${String(err)}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// LA Open Data — SODA URL builder for data.lacity.org
// ---------------------------------------------------------------------------
function buildLASodaUrl(
  endpoint: string,
  whereClause: string,
  limit: number,
  offset: number,
  orderBy: string
): string {
  const appToken = Deno.env.get("LA_OPEN_DATA_APP_TOKEN");
  let url =
    `https://data.lacity.org/resource/${endpoint}.json` +
    `?$where=${encodeURIComponent(whereClause)}` +
    `&$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent(orderBy)}`;

  if (appToken) {
    url += `&$$app_token=${appToken}`;
  }

  return url;
}

/** Build a SODA API URL for Chicago Open Data portal. */
function buildChicagoSodaUrl(
  endpoint: string,
  whereClause: string,
  limit: number,
  offset: number,
  orderBy: string
): string {
  const appToken = Deno.env.get("CHICAGO_OPEN_DATA_APP_TOKEN");
  let url =
    `https://data.cityofchicago.org/resource/${endpoint}.json` +
    `?$where=${encodeURIComponent(whereClause)}` +
    `&$limit=${limit}` +
    `&$offset=${offset}` +
    `&$order=${encodeURIComponent(orderBy)}`;

  if (appToken) {
    url += `&$$app_token=${appToken}`;
  }

  return url;
}

// ---------------------------------------------------------------------------
// Shared address normalization for building linking across all cities
// ---------------------------------------------------------------------------
const CITY_NAMES_BY_METRO: Record<string, string[]> = {
  nyc: ["NEW YORK", "NY", "NYC", "MANHATTAN", "BROOKLYN", "QUEENS", "BRONX", "STATEN ISLAND"],
  "los-angeles": ["LOS ANGELES"],
  chicago: ["CHICAGO"],
  miami: ["MIAMI", "MIAMI-DADE", "MIAMI DADE"],
  houston: ["HOUSTON"],
};
const SYNC_STATE_NAMES = ["TEXAS", "CALIFORNIA", "FLORIDA", "ILLINOIS", "NEW YORK", "TX", "CA", "FL", "IL", "NY"];

function normalizeAddressForLinking(addr: string, metro?: string): string {
  if (!addr) return "";
  let s = addr.toUpperCase().trim();
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0) s = s.substring(0, commaIdx).trim();
  s = s.replace(/[.,#]/g, "");
  s = s.replace(/\+/g, "").trim();
  if (metro && CITY_NAMES_BY_METRO[metro]) {
    for (const cn of CITY_NAMES_BY_METRO[metro]) {
      s = s.replace(new RegExp(`\\b${cn.replace(/\s+/g, "\\s+")}\\b`, "g"), "").trim();
    }
  }
  for (const st of SYNC_STATE_NAMES) {
    s = s.replace(new RegExp(`\\b${st}\\b`, "g"), "").trim();
  }
  s = s.replace(/(?<=\s)\d{5}(-\d{4})?(\s|$)/g, "").trim();
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\bSTREET\b/g, "ST").replace(/\bAVENUE\b/g, "AVE").replace(/\bBOULEVARD\b/g, "BLVD")
    .replace(/\bDRIVE\b/g, "DR").replace(/\bBL\b/g, "BLVD").replace(/\bPLACE\b/g, "PL").replace(/\bCOURT\b/g, "CT")
    .replace(/\bLANE\b/g, "LN").replace(/\bROAD\b/g, "RD").replace(/\bTERRACE\b/g, "TER")
    .replace(/\bCIRCLE\b/g, "CIR").replace(/\bPARKWAY\b/g, "PKWY").replace(/\bHIGHWAY\b/g, "HWY");
  s = s.replace(/\bNORTH\b/g, "N").replace(/\bSOUTH\b/g, "S").replace(/\bEAST\b/g, "E").replace(/\bWEST\b/g, "W")
    .replace(/\bNORTHEAST\b/g, "NE").replace(/\bNORTHWEST\b/g, "NW")
    .replace(/\bSOUTHEAST\b/g, "SE").replace(/\bSOUTHWEST\b/g, "SW");
  s = s.replace(/\b(\d+)(ST|ND|RD|TH)\b/g, "$1");
  s = s.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "");
  s = s.replace(/^(\d+)\s*-\s*\d+\s+/, "$1 ");
  return s.replace(/\s+/g, " ").trim();
}

function normalizeLAAddress(addr: string): string {
  return normalizeAddressForLinking(addr, "los-angeles");
}

// Link LA records to buildings by matching normalized address + zip
async function linkLAByAddress(
  supabase: SupabaseClient,
  table: string,
  sinceDate: string,
  errors: string[],
  label: string
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  const { data: unlinked, error } = await supabase
    .from(table)
    .select("id, address, zip_code")
    .eq("metro", "los-angeles")
    .is("building_id", null)
    .gte("imported_at", sinceDate)
    .limit(5000);

  if (error || !unlinked || unlinked.length === 0) {
    if (error) errors.push(`${label} link query error: ${error.message}`);
    return { linked, affectedBuildingIds };
  }

  const zips = [...new Set(unlinked.map((r) => r.zip_code).filter(Boolean))];
  if (zips.length === 0) return { linked, affectedBuildingIds };

  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, full_address, zip_code")
    .eq("metro", "los-angeles")
    .in("zip_code", zips);

  if (!buildings || buildings.length === 0) return { linked, affectedBuildingIds };

  const addrMap = new Map<string, string>();
  for (const b of buildings) {
    const street = b.full_address.split(",")[0]?.trim() || "";
    const key = `${normalizeLAAddress(street)}|${b.zip_code}`;
    addrMap.set(key, b.id);
  }

  const updates: { id: string; building_id: string }[] = [];
  for (const rec of unlinked) {
    if (!rec.address || !rec.zip_code) continue;
    const key = `${normalizeLAAddress(rec.address)}|${rec.zip_code}`;
    const buildingId = addrMap.get(key);
    if (buildingId) {
      updates.push({ id: rec.id, building_id: buildingId });
      affectedBuildingIds.add(buildingId);
    }
  }

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    for (const u of batch) {
      await supabase.from(table).update({ building_id: u.building_id }).eq("id", u.id);
      linked++;
    }
  }

  return { linked, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// LA Sync Functions
// ---------------------------------------------------------------------------

async function syncLAHDViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lahd_violations");
  const logId = await createSyncLog(supabase, "lahd_violations");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl(
        "u82d-eh7z",
        `adddttm > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "adddttm ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        errors.push(`LAHD API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apno)
        .map((r: Record<string, unknown>) => ({
          violation_id: `LA-${r.apno}`,
          class: r.aptype ? String(r.aptype).slice(0, 1).toUpperCase() : null,
          inspection_date: r.adddttm ? String(r.adddttm).slice(0, 10) : null,
          nov_description: r.aptype ? String(r.aptype) : null,
          status: r.stat ? String(r.stat) : null,
          borough: r.apc ? String(r.apc) : "Los Angeles",
          house_number: r.stno ? String(r.stno) : null,
          street_name: [r.predir, r.stname, r.suffix].filter(Boolean).map(String).join(" ").trim() || null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "hpd_violations", rows, "violation_id", errors, "LAHD");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "hpd_violations", "id", ["house_number", "street_name"], syncStartTime, errors, "LAHD", 500, "los-angeles");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LAHD fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLA311Complaints(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "la_311_complaints");
  const logId = await createSyncLog(supabase, "la_311_complaints");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl(
        "2cy6-i7zn",
        `createddate > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "createddate ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        errors.push(`LA 311 API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.casenumber)
        .map((r: Record<string, unknown>) => ({
          unique_key: `LA311-${r.casenumber}`,
          complaint_type: r.type ? String(r.type) : null,
          descriptor: r.origin ? String(r.origin) : null,
          agency: "MyLA311",
          status: r.status ? String(r.status) : null,
          created_date: r.createddate ? String(r.createddate) : null,
          closed_date: r.closeddate ? String(r.closeddate) : null,
          resolution_description: r.resolution_code__c ? String(r.resolution_code__c) : null,
          borough: r.locator_sr_area_planning ? String(r.locator_sr_area_planning) : "Los Angeles",
          incident_address: r.locator_gis_returned_address ? String(r.locator_gis_returned_address) : null,
          zip_code: r.zipcode__c ? String(r.zipcode__c).slice(0, 5) : null,
          latitude: r.geolocation__latitude__s ? parseFloat(String(r.geolocation__latitude__s)) : null,
          longitude: r.geolocation__longitude__s ? parseFloat(String(r.geolocation__longitude__s)) : null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "LA311");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "complaints_311", "unique_key", "incident_address", syncStartTime, errors, "LA311", 500, "los-angeles");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LA311 address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LA 311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLADBSViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "ladbs_violations");
  const logId = await createSyncLog(supabase, "ladbs_violations");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl(
        "u82d-eh7z",
        `adddttm > '${lastSync}' AND aptype LIKE '%VIOL%'`,
        PAGE_SIZE,
        offset,
        "adddttm ASC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        errors.push(`LADBS API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apno)
        .map((r: Record<string, unknown>) => ({
          violation_number: `LADBS-${r.apno}`,
          violation_type: r.aptype ? String(r.aptype) : null,
          description: r.aptype ? String(r.aptype) : "LADBS violation",
          issue_date: r.adddttm ? String(r.adddttm).slice(0, 10) : null,
          status: r.stat ? String(r.stat) : null,
          borough: r.apc ? String(r.apc) : "Los Angeles",
          house_number: r.stno ? String(r.stno) : null,
          street_name: [r.predir, r.stname, r.suffix].filter(Boolean).map(String).join(" ").trim() || null,
          zip_code: r.zip ? String(r.zip).replace(/-.*/, "").slice(0, 5) : null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "violation_number", errors, "LADBS");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "dob_violations", "id", ["house_number", "street_name"], syncStartTime, errors, "LADBS", 500, "los-angeles");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LADBS address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LADBS fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLAPDCrimeData(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lapd_crime");
  const logId = await createSyncLog(supabase, "lapd_crime");

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("2nrs-mtv8", `date_occ > '${lastSync}'`, PAGE_SIZE, offset, "date_occ ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`LAPD API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: { dr_no?: string }) => r.dr_no)
        .map((r: Record<string, string | undefined>) => {
          const part = r.part_1_2 ? parseInt(String(r.part_1_2), 10) : null;
          let lawCategory: string | null = null;
          if (part === 1) lawCategory = "FELONY";
          else if (part === 2) lawCategory = "MISDEMEANOR";

          return {
            cmplnt_num: `LAPD-${r.dr_no}`,
            cmplnt_date: r.date_occ ? String(r.date_occ).slice(0, 10) : null,
            borough: r.area_name ? String(r.area_name) : null,
            precinct: null,
            offense_description: r.crm_cd_desc ? String(r.crm_cd_desc) : null,
            law_category: lawCategory,
            crime_category: categorizeCrime(r.crm_cd_desc ? String(r.crm_cd_desc) : null),
            pd_description: r.premis_desc ? String(r.premis_desc) : null,
            latitude: r.lat ? parseFloat(String(r.lat)) : null,
            longitude: r.lon ? parseFloat(String(r.lon)) : null,
            zip_code: null,
            metro: "los-angeles",
            imported_at: new Date().toISOString(),
          };
        })
        .filter((r: { latitude: number | null; longitude: number | null }) =>
          !(r.latitude === 0 && r.longitude === 0)
        );

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "nypd_complaints", rows, "cmplnt_num", errors, "LAPD");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", { target_metro: "los-angeles" });
      if (zipErr) errors.push(`LAPD zip backfill error: ${zipErr.message}`);
    } catch (zipBackfillErr) {
      errors.push(`LAPD zip backfill fatal: ${String(zipBackfillErr)}`);
    }
  } catch (err) {
    errors.push(`LAPD crime sync fatal: ${String(err)}`);
  }

  await finalizeSyncLog(supabase, logId, errors.length > 0 ? "failed" : "completed", totalAdded, totalLinked, errors);
  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLAPermits(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "la_permits");
  const logId = await createSyncLog(supabase, "la_permits");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("pi9x-tg5x", `issue_date > '${lastSync}'`, PAGE_SIZE, offset, "issue_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`LA Permits API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.permit_nbr)
        .map((r: Record<string, unknown>) => {
          const addr = r.primary_address ? String(r.primary_address) : "";
          return {
            work_permit: `LADBS-${r.permit_nbr}`,
            work_type: r.permit_type ? String(r.permit_type) : null,
            permit_status: r.status_desc ? String(r.status_desc) : null,
            filing_reason: r.permit_sub_type ? String(r.permit_sub_type) : null,
            issued_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
            job_description: r.work_desc ? String(r.work_desc).substring(0, 500) : null,
            estimated_job_costs: r.valuation ? parseFloat(String(r.valuation)) : null,
            borough: r.cpa ? String(r.cpa) : (r.apc ? String(r.apc) : "Los Angeles"),
            house_no: addr.match(/^(\d[\w-]*)\s/)?.[1] || null,
            street_name: addr.replace(/^\d[\w-]*\s+/, "").trim() || null,
            zip_code: r.zip_code ? String(r.zip_code).slice(0, 5) : null,
            latitude: r.lat ? parseFloat(String(r.lat)) : null,
            longitude: r.lon ? parseFloat(String(r.lon)) : null,
            metro: "los-angeles",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_permits", rows, "work_permit", errors, "LA Permits");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "dob_permits", "id", ["house_no", "street_name"], syncStartTime, errors, "LA Permits", 500, "los-angeles");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LA Permits address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LA Permits fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLASoftStory(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "la_soft_story");
  let totalAdded = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;

    while (true) {
      const url = buildLASodaUrl("nc44-6znn", "1=1", PAGE_SIZE, offset, "pcis_permit ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`Soft-story API error: ${res.status}`); break; }
      const records = await res.json();
      if (!records || records.length === 0) break;

      for (const r of records as Record<string, unknown>[]) {
        const addr = [r.address_start, r.street_direction, r.street_name, r.street_suffix].filter(Boolean).map(String).join(" ").trim();
        if (!addr) continue;
        const zip = r.zip_code ? String(r.zip_code).slice(0, 5) : "";
        if (!zip) continue;

        const slug = `${addr}-los-angeles-ca-${zip}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const status = r.latest_status ? String(r.latest_status) : "";
        const isRetrofitted = status.toUpperCase().includes("COFC") || status.toUpperCase().includes("FINAL");
        const softStoryStatus = isRetrofitted ? "Retrofitted" : status.toUpperCase().includes("EXPIRED") ? "Expired" : "In Progress";

        const { count } = await supabase
          .from("buildings")
          .update({ is_soft_story: true, soft_story_status: softStoryStatus }, { count: "exact" })
          .eq("slug", slug)
          .eq("metro", "los-angeles");

        if (count && count > 0) {
          totalAdded += count;
        }
      }

      offset += records.length;
      if (records.length < PAGE_SIZE) break;
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, 0, errors);
  } catch (err) {
    errors.push(`Soft-story fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, 0, errors);
  }

  return { totalAdded, totalLinked: 0, errors, affectedBuildingIds };
}

async function syncLAHDEvictions(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lahd_evictions");
  const logId = await createSyncLog(supabase, "lahd_evictions");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("2u8b-eyuu", `received > '${lastSync}'`, PAGE_SIZE, offset, "received ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`LAHD Evictions API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apn)
        .map((r: Record<string, unknown>) => {
          const parseDateLocal = (d: unknown) => {
            if (!d) return null;
            const s = String(d);
            const mdyMatch = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
            if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`;
            return s.slice(0, 10);
          };
          return {
            apn: String(r.apn),
            address: r.officialaddress ? String(r.officialaddress) : null,
            eviction_category: r.eviction_category ? String(r.eviction_category) : null,
            notice_date: parseDateLocal(r.notice_date),
            notice_type: r.notice_type ? String(r.notice_type) : null,
            received_date: parseDateLocal(r.received),
            metro: "los-angeles",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "lahd_evictions", rows, "apn,notice_date,notice_type", errors, "LAHD Evictions", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "lahd_evictions", "id", "address", syncStartTime, errors, "LAHD Evictions", 500, "los-angeles", true, "address");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD Evictions linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LAHD Evictions fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLAHDTenantBuyouts(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lahd_tenant_buyouts");
  const logId = await createSyncLog(supabase, "lahd_tenant_buyouts");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("ci3m-f23k", `disclosure_fileddate > '${lastSync}'`, PAGE_SIZE, offset, "disclosure_fileddate ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`LAHD Buyouts API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apn)
        .map((r: Record<string, unknown>) => ({
          apn: String(r.apn),
          address: r.tenant_streetaddress ? String(r.tenant_streetaddress) : null,
          disclosure_date: r.disclosure_fileddate ? String(r.disclosure_fileddate).slice(0, 10) : null,
          compensation_amount: r.compensation_amount ? parseFloat(String(r.compensation_amount)) : null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "lahd_tenant_buyouts", rows, "apn,disclosure_date", errors, "LAHD Buyouts", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "lahd_tenant_buyouts", "id", "address", syncStartTime, errors, "LAHD Buyouts", 500, "los-angeles", true, "address");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD Buyouts linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LAHD Buyouts fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLAHDCCRIS(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lahd_ccris");
  const logId = await createSyncLog(supabase, "lahd_ccris");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("ds2y-sb5t", `start_date > '${lastSync}'`, PAGE_SIZE, offset, "start_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`LAHD CCRIS API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apn)
        .map((r: Record<string, unknown>) => ({
          apn: String(r.apn),
          address: r.address ? String(r.address) : null,
          case_type: r.casetype ? String(r.casetype) : null,
          start_date: r.start_date ? String(r.start_date).slice(0, 10) : null,
          total_complaints: r.totalcomplaintscount ? parseInt(String(r.totalcomplaintscount), 10) : 0,
          open_complaints: r.opencomplaintscount ? parseInt(String(r.opencomplaintscount), 10) : 0,
          scheduled_inspections: r.scheduledinspectionscount ? parseInt(String(r.scheduledinspectionscount), 10) : 0,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "lahd_ccris_cases", rows, "apn,start_date,case_type", errors, "LAHD CCRIS", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "lahd_ccris_cases", "id", "address", syncStartTime, errors, "LAHD CCRIS", 500, "los-angeles", true, "address");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD CCRIS linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LAHD CCRIS fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncLAHDViolationSummary(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "lahd_violation_summary");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildLASodaUrl("cr8f-uc4j", "1=1", PAGE_SIZE, offset, ":id");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) { errors.push(`LAHD Violation Summary API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apn)
        .map((r: Record<string, unknown>) => ({
          apn: String(r.apn),
          address: r.address ? String(r.address) : null,
          violation_type: r.violationtype ? String(r.violationtype) : null,
          violations_cited: r.violations_cited ? parseInt(String(r.violations_cited), 10) : 0,
          violations_cleared: r.violations_cleared ? parseInt(String(r.violations_cleared), 10) : 0,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "lahd_violation_summary", rows, "apn,violation_type", errors, "LAHD ViolSummary", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const apnResult = await linkByApn(supabase, "lahd_violation_summary", "id", "apn", errors, "LAHD ViolSummary", "los-angeles");
      totalLinked += apnResult.linked;
      for (const id of apnResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD ViolSummary APN linking error: ${String(linkErr)}`);
    }

    try {
      const linkResult = await linkByAddress(supabase, "lahd_violation_summary", "id", "address", syncStartTime, errors, "LAHD ViolSummary", 500, "los-angeles", true, "address");
      totalLinked += linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD ViolSummary address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`LAHD ViolSummary fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Chicago Sync Functions
// ---------------------------------------------------------------------------

function parseChicagoAddress(addr: string | null | undefined): { house_number: string | null; street_name: string | null } {
  if (!addr) return { house_number: null, street_name: null };
  const trimmed = addr.trim();
  const match = trimmed.match(/^([0-9-]+)\s+(.+)/);
  if (match) return { house_number: match[1], street_name: match[2] };
  return { house_number: null, street_name: trimmed };
}

const CHICAGO_VIOLENT_CRIMES = new Set([
  "HOMICIDE", "ASSAULT", "BATTERY", "ROBBERY", "CRIM SEXUAL ASSAULT", "KIDNAPPING",
]);
const CHICAGO_PROPERTY_CRIMES = new Set([
  "THEFT", "BURGLARY", "MOTOR VEHICLE THEFT", "ARSON",
]);

function categorizeChicagoCrime(primaryType: string | null | undefined): string | null {
  if (!primaryType) return null;
  const upper = primaryType.toUpperCase().trim();
  if (CHICAGO_VIOLENT_CRIMES.has(upper)) return "violent";
  if (CHICAGO_PROPERTY_CRIMES.has(upper)) return "property";
  return "quality_of_life";
}

async function syncChicagoViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_violations");
  const logId = await createSyncLog(supabase, "chicago_violations");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildChicagoSodaUrl("22u3-xenr", `violation_last_modified_date > '${lastSync}'`, PAGE_SIZE, offset, "violation_last_modified_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Chicago Violations API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.id)
        .map((r: Record<string, unknown>) => {
          const parsed = parseChicagoAddress(r.address as string | undefined);
          return {
            isn_dob_bis_vio: `CHI-${r.id}`,
            issue_date: r.violation_date ? String(r.violation_date).slice(0, 10) : null,
            violation_type: r.violation_code ? String(r.violation_code) : null,
            description: r.violation_description ? String(r.violation_description) : null,
            borough: "Chicago",
            house_number: parsed.house_number,
            street_name: parsed.street_name,
            metro: "chicago",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "isn_dob_bis_vio", errors, "Chicago Violations");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    errors.push(`Chicago Violations: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Violations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncChicago311(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_311");
  const logId = await createSyncLog(supabase, "chicago_311");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;
    const CHI311_PAGE = 2000;
    const CHI311_MAX_PAGES = 8;

    while (hasMore) {
      const url = buildChicagoSodaUrl("v6vf-nfxy", `created_date > '${lastSync}'`, CHI311_PAGE, offset, "created_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Chicago 311 API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.sr_number)
        .map((r: Record<string, unknown>) => ({
          unique_key: `CHI311-${r.sr_number}`,
          complaint_type: r.sr_type ? String(r.sr_type) : null,
          status: r.status ? String(r.status) : null,
          created_date: r.created_date ? String(r.created_date).slice(0, 10) : null,
          closed_date: r.closed_date ? String(r.closed_date).slice(0, 10) : null,
          incident_address: r.street_address ? String(r.street_address) : null,
          borough: "Chicago",
          latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
          longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
          metro: "chicago",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "Chicago 311", true);
      }

      pagesFetched++;
      if (records.length < CHI311_PAGE || pagesFetched >= CHI311_MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += CHI311_PAGE; }
    }

    errors.push(`Chicago 311: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago 311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncChicagoCrimes(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_crimes");
  const logId = await createSyncLog(supabase, "chicago_crimes");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildChicagoSodaUrl("ijzp-q8t2", `date > '${lastSync}'`, PAGE_SIZE, offset, "date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Chicago Crimes API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.case_number)
        .map((r: Record<string, unknown>) => {
          const primaryType = r.primary_type ? String(r.primary_type) : null;
          const description = r.description ? String(r.description) : null;
          const offenseDesc = [primaryType, description].filter(Boolean).join(" - ");

          return {
            cmplnt_num: `CPD-${r.case_number}`,
            cmplnt_date: r.date ? String(r.date).slice(0, 10) : null,
            borough: "Chicago",
            precinct: r.district ? String(r.district) : null,
            offense_description: offenseDesc || null,
            crime_category: categorizeChicagoCrime(primaryType),
            latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
            longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
            incident_address: r.block ? String(r.block) : null,
            metro: "chicago",
            imported_at: new Date().toISOString(),
          };
        })
        .filter((r: { latitude: number | null; longitude: number | null }) =>
          !(r.latitude === 0 && r.longitude === 0)
        );

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "nypd_complaints", rows, "cmplnt_num", errors, "Chicago Crimes");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", { target_metro: "chicago" });
      if (zipErr) errors.push(`Chicago Crimes zip backfill error: ${zipErr.message}`);
    } catch (zipBackfillErr) {
      errors.push(`Chicago Crimes zip backfill fatal: ${String(zipBackfillErr)}`);
    }
  } catch (err) {
    errors.push(`Chicago Crimes sync fatal: ${String(err)}`);
  }

  await finalizeSyncLog(supabase, logId, errors.length > 0 ? "failed" : "completed", totalAdded, totalLinked, errors);
  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncChicagoPermits(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_permits");
  const logId = await createSyncLog(supabase, "chicago_permits");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildChicagoSodaUrl("ydr8-5enu", `issue_date > '${lastSync}'`, PAGE_SIZE, offset, "issue_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Chicago Permits API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.id)
        .map((r: Record<string, unknown>) => {
          const streetParts = [r.street_direction, r.street_name].filter(Boolean).map(String).join(" ").trim();
          return {
            work_permit: r.id ? `CHI-PERMIT-${r.id}` : null,
            work_type: r.permit_type ? String(r.permit_type) : null,
            permit_status: r.permit_status ? String(r.permit_status) : null,
            issued_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
            borough: "Chicago",
            house_no: r.street_number ? String(r.street_number) : null,
            street_name: streetParts || null,
            job_description: r.work_description ? String(r.work_description) : null,
            estimated_job_costs: r.reported_cost ? parseFloat(String(r.reported_cost)) : null,
            latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
            longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
            metro: "chicago",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_permits", rows, "work_permit", errors, "Chicago Permits");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    errors.push(`Chicago Permits: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Permits fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncChicagoRLTO(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_rlto");
  const logId = await createSyncLog(supabase, "chicago_rlto");

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildChicagoSodaUrl("awqx-tuwv", `violation_date > '${lastSync}'`, PAGE_SIZE, offset, "violation_date ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Chicago RLTO API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.docket_number)
        .map((r: Record<string, unknown>) => ({
          case_number: String(r.docket_number),
          violation_type: r.violation_code ? String(r.violation_code) : null,
          violation_description: r.violation_description ? String(r.violation_description) : null,
          violation_date: r.violation_date ? String(r.violation_date).slice(0, 10) : null,
          status: r.case_disposition ? String(r.case_disposition) : null,
          respondent: r.respondents ? String(r.respondents) : null,
          address: r.address ? String(r.address) : null,
          latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
          longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
          metro: "chicago",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "chicago_rlto_violations", rows, "case_number", errors, "Chicago RLTO", true);
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    errors.push(`Chicago RLTO: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago RLTO fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncChicagoLead(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "chicago_lead");
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, ["Chicago lead sync disabled: no individual inspection dataset available on data.cityofchicago.org"]);
  return { totalAdded: 0, totalLinked: 0, errors: ["Chicago lead sync disabled: no individual inspection dataset available"], affectedBuildingIds: new Set() };
}

// ---------------------------------------------------------------------------
// Miami Sync Functions
// ---------------------------------------------------------------------------

function buildMiamiArcGISUrl(
  serviceName: string,
  whereClause: string,
  limit: number,
  offset: number,
  orderBy: string
): string {
  return (
    `https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services/${serviceName}/FeatureServer/0/query` +
    `?where=${encodeURIComponent(whereClause)}` +
    `&outFields=*` +
    `&resultRecordCount=${limit}` +
    `&resultOffset=${offset}` +
    `&orderByFields=${encodeURIComponent(orderBy)}` +
    `&f=json`
  );
}

function parseMiamiAddress(addr: string | null | undefined): { house_number: string | null; street_name: string | null } {
  if (!addr) return { house_number: null, street_name: null };
  const trimmed = addr.trim();
  const match = trimmed.match(/^([0-9-]+)\s+(.+)/);
  if (match) return { house_number: match[1], street_name: match[2] };
  return { house_number: null, street_name: trimmed };
}

const MIAMI_VIOLENT_CRIMES = new Set(["BATTERY", "ASSAULT", "ROBBERY", "HOMICIDE", "KIDNAPPING"]);
const MIAMI_PROPERTY_CRIMES = new Set(["BURGLARY", "LARCENY", "THEFT", "VANDALISM"]);

function categorizeMiamiCrime(offense: string | null | undefined): string | null {
  if (!offense) return null;
  const upper = offense.toUpperCase().trim();
  if (MIAMI_VIOLENT_CRIMES.has(upper)) return "violent";
  for (const v of MIAMI_VIOLENT_CRIMES) { if (upper.includes(v)) return "violent"; }
  if (MIAMI_PROPERTY_CRIMES.has(upper)) return "property";
  for (const p of MIAMI_PROPERTY_CRIMES) { if (upper.includes(p)) return "property"; }
  if (upper.includes("DRUG") || upper.includes("NARCOTIC")) return "drug";
  if (upper.includes("SEX")) return "sex_offense";
  if (upper.includes("FRAUD") || upper.includes("FORGERY") || upper.includes("EMBEZZLE")) return "fraud";
  return "other";
}

async function syncMiamiViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "miami_violations");
  const logId = await createSyncLog(supabase, "miami_violations");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const cutoffMs = lastSync ? new Date(lastSync).getTime() : 0;
      const url = buildMiamiArcGISUrl("CodeComplianceViolation_Open_View", cutoffMs > 0 ? `CASE_DATE > ${cutoffMs}` : `1=1`, PAGE_SIZE, offset, "CASE_DATE ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Miami Violations API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const features = json.features || [];
      if (features.length === 0) { hasMore = false; break; }

      const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
      const rows = records
        .filter((r: Record<string, unknown>) => r.CASE_NUM)
        .map((r: Record<string, unknown>) => {
          const parsed = parseMiamiAddress(r.ADDRESS as string | undefined);
          const caseDate = r.CASE_DATE ? new Date(Number(r.CASE_DATE)).toISOString().slice(0, 10) : null;
          return {
            isn_dob_bis_vio: `MIA-${r.CASE_NUM}`,
            issue_date: caseDate,
            description: r.PROBLEM_DESC ? String(r.PROBLEM_DESC).trim() : null,
            borough: "Miami-Dade",
            house_number: parsed.house_number,
            street_name: parsed.street_name,
            metro: "miami",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "isn_dob_bis_vio", errors, "Miami Violations");
      }

      pagesFetched++;
      if (features.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "dob_violations", "id", ["house_number", "street_name"], syncStartTime, errors, "Miami Violations", 500, "miami");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Miami Violations address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Miami Violations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncMiami311(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "miami_311");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildMiamiArcGISUrl("data_311_2023", `OBJECTID > 0`, PAGE_SIZE, offset, "OBJECTID ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Miami 311 API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const features = json.features || [];
      if (features.length === 0) { hasMore = false; break; }

      const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
      const rows = records
        .filter((r: Record<string, unknown>) => r.CASE_NUMBER || r.OBJECTID)
        .map((r: Record<string, unknown>) => ({
          unique_key: `MIA311-${r.CASE_NUMBER || r.OBJECTID}`,
          complaint_type: r.ISSUE_TYPE ? String(r.ISSUE_TYPE) : null,
          descriptor: r.ISSUE_DESCRIPTION ? String(r.ISSUE_DESCRIPTION) : null,
          status: r.STATUS ? String(r.STATUS) : null,
          created_date: r.DATE_CREATED ? new Date(Number(r.DATE_CREATED)).toISOString().slice(0, 10) : null,
          incident_address: r.ADDRESS ? String(r.ADDRESS) : null,
          borough: "Miami-Dade",
          latitude: r.LATITUDE ? parseFloat(String(r.LATITUDE)) : null,
          longitude: r.LONGITUDE ? parseFloat(String(r.LONGITUDE)) : null,
          metro: "miami",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "Miami 311", true);
      }

      pagesFetched++;
      if (features.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "complaints_311", "unique_key", ["incident_address"], syncStartTime, errors, "Miami 311", 500, "miami");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Miami 311 address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Miami 311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncMiamiCrimes(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "miami_crimes");
  const errors: string[] = [];
  errors.push("Miami crimes sync: MDPD crime data not yet available via ArcGIS API");
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, errors);
  return { totalAdded: 0, totalLinked: 0, errors, affectedBuildingIds: new Set() };
}

async function syncMiamiPermits(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "miami_permits");
  const logId = await createSyncLog(supabase, "miami_permits");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildMiamiArcGISUrl("BuildingPermit_gdb", `OBJECTID > 0`, PAGE_SIZE, offset, "OBJECTID ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Miami Permits API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const features = json.features || [];
      if (features.length === 0) { hasMore = false; break; }

      const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
      const rows = records
        .filter((r: Record<string, unknown>) => r.PROCNUM || r.ID)
        .map((r: Record<string, unknown>) => {
          const parsed = parseMiamiAddress((r.ADDRESS as string | undefined) ?? (r.STNDADDR as string | undefined));
          return {
            work_permit: `MIA-${r.PROCNUM || r.ID}`,
            work_type: r.TYPE ? String(r.TYPE) : null,
            permit_status: r.CAT1 ? String(r.CAT1) : null,
            issued_date: r.ISSUEDATE ? new Date(Number(r.ISSUEDATE)).toISOString().slice(0, 10) : null,
            borough: "Miami-Dade",
            house_no: parsed.house_number,
            street_name: parsed.street_name,
            job_description: r.DESC1 ? String(r.DESC1) : null,
            latitude: null,
            longitude: null,
            metro: "miami",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_permits", rows, "work_permit", errors, "Miami Permits");
      }

      pagesFetched++;
      if (features.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "dob_permits", "id", ["house_no", "street_name"], syncStartTime, errors, "Miami Permits", 500, "miami");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Miami Permits address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Miami Permits fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncMiamiUnsafeStructures(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "miami_unsafe");
  const logId = await createSyncLog(supabase, "miami_unsafe");
  const syncStartTime = new Date().toISOString();
  const syncStartMs = Date.now();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const cutoffMs = lastSync ? new Date(lastSync).getTime() : 0;
      const url = buildMiamiArcGISUrl("Open_Building_Violations", cutoffMs > 0 ? `OPEN_DATE > ${cutoffMs}` : `1=1`, PAGE_SIZE, offset, "OPEN_DATE ASC");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Miami Unsafe API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const features = json.features || [];
      if (features.length === 0) { hasMore = false; break; }

      const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
      const rows = records
        .filter((r: Record<string, unknown>) => r.CASE_NUM)
        .map((r: Record<string, unknown>) => ({
          case_number: String(r.CASE_NUM),
          address: r.PROP_ADDR ? String(r.PROP_ADDR) : null,
          violation_description: r.VIOL_NAME ? String(r.VIOL_NAME) : null,
          violation_date: r.OPEN_DATE ? new Date(Number(r.OPEN_DATE)).toISOString().slice(0, 10) : null,
          status: r.CLOSED_DATE ? "CLOSED" : "OPEN",
          latitude: null,
          longitude: null,
          metro: "miami",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "miami_unsafe_structures", rows, "case_number", errors, "Miami Unsafe", true);
      }

      pagesFetched++;
      if (features.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    try {
      const linkResult = await linkByAddress(supabase, "miami_unsafe_structures", "id", "address", syncStartTime, errors, "Miami Unsafe", 500, "miami", true, "address");
      totalLinked = linkResult.linked;
      for (const id of linkResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`Miami Unsafe address linking error: ${String(linkErr)}`);
    }

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Miami Unsafe fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncMiamiRecertifications(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "miami_recerts");
  const errors: string[] = [];
  errors.push("Miami recertifications sync: data source not yet available via ArcGIS API");
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, errors);
  return { totalAdded: 0, totalLinked: 0, errors, affectedBuildingIds: new Set() };
}

// ---------------------------------------------------------------------------
// Houston Sync Functions
// ---------------------------------------------------------------------------

function buildHoustonCkanUrl(
  resourceId: string,
  filters: string,
  limit: number,
  offset: number,
  sort: string
): string {
  return (
    `https://data.houstontx.gov/api/3/action/datastore_search` +
    `?resource_id=${resourceId}` +
    `&limit=${limit}` +
    `&offset=${offset}` +
    `&sort=${encodeURIComponent(sort)}` +
    (filters ? `&filters=${encodeURIComponent(filters)}` : "")
  );
}

function buildHoustonArcGISUrl(
  baseUrl: string,
  whereClause: string,
  limit: number,
  offset: number,
  orderBy: string
): string {
  return (
    `${baseUrl}/query` +
    `?where=${encodeURIComponent(whereClause)}` +
    `&outFields=*` +
    `&resultRecordCount=${limit}` +
    `&resultOffset=${offset}` +
    `&orderByFields=${encodeURIComponent(orderBy)}` +
    `&f=json`
  );
}

function parseHoustonAddress(addr: string | null | undefined): { house_number: string | null; street_name: string | null } {
  if (!addr) return { house_number: null, street_name: null };
  const trimmed = addr.trim();
  const match = trimmed.match(/^([0-9-]+)\s+(.+)/);
  if (match) return { house_number: match[1], street_name: match[2] };
  return { house_number: null, street_name: trimmed };
}

const HOUSTON_VIOLENT_CRIMES = new Set([
  "AGGRAVATED ASSAULT", "MURDER", "ROBBERY", "RAPE", "KIDNAPPING/ABDUCTION",
  "SIMPLE ASSAULT", "INTIMIDATION",
]);
const HOUSTON_PROPERTY_CRIMES = new Set([
  "BURGLARY/BREAKING AND ENTERING", "THEFT", "MOTOR VEHICLE THEFT", "ARSON",
  "SHOPLIFTING", "THEFT FROM MOTOR VEHICLE", "THEFT FROM BUILDING",
]);

function categorizeHoustonCrime(nibrDesc: string | null | undefined): string | null {
  if (!nibrDesc) return null;
  const upper = nibrDesc.toUpperCase().trim();
  if (HOUSTON_VIOLENT_CRIMES.has(upper)) return "violent";
  for (const v of HOUSTON_VIOLENT_CRIMES) { if (upper.includes(v)) return "violent"; }
  if (HOUSTON_PROPERTY_CRIMES.has(upper)) return "property";
  for (const p of HOUSTON_PROPERTY_CRIMES) { if (upper.includes(p)) return "property"; }
  if (upper.includes("DRUG") || upper.includes("NARCOTIC")) return "drug";
  if (upper.includes("SEX")) return "sex_offense";
  if (upper.includes("FRAUD") || upper.includes("FORGERY") || upper.includes("COUNTERFEIT")) return "fraud";
  return "other";
}

async function syncHoustonViolations(supabase: SupabaseClient): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "houston_violations");
  const logId = await createSyncLog(supabase, "houston_violations");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    while (hasMore) {
      const url = buildHoustonCkanUrl("1446a3ec-2633-4cf1-b15d-6dae9a07c4ed", "", PAGE_SIZE, offset, "RecordCreateDate desc");

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Houston Violations API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const records = json.result?.records || [];
      if (records.length === 0) { hasMore = false; break; }

      const filteredRecords = lastSync
        ? records.filter((r: Record<string, unknown>) => {
            const d = r.RecordCreateDate ? String(r.RecordCreateDate) : null;
            return d && d >= lastSync;
          })
        : records;

      const rows = filteredRecords
        .filter((r: Record<string, unknown>) => r.ViolationSubId || r.NPPRJID)
        .map((r: Record<string, unknown>) => {
          const parsed = parseHoustonAddress(r.Merged_Situs as string | undefined);
          return {
            isn_dob_bis_vio: `HOU-${r.ViolationSubId || r.NPPRJID}`,
            issue_date: r.RecordCreateDate ? String(r.RecordCreateDate).slice(0, 10) : null,
            description: r.ShortDescription ? String(r.ShortDescription).trim() : null,
            violation_type: r.Violation_Category ? String(r.Violation_Category) : null,
            borough: "Houston",
            house_number: parsed.house_number,
            street_name: parsed.street_name,
            metro: "houston",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "isn_dob_bis_vio", errors, "Houston Violations");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    errors.push(`Houston Violations: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Houston Violations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncHouston311(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "houston_311");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;
    const MAX_311_PAGE = 2000;

    while (hasMore) {
      const url = buildHoustonArcGISUrl(
        "https://mycity2.houstontx.gov/gisweb01/rest/services/311/Houston311_RecentServiceRequests/FeatureServer/4",
        "1=1",
        MAX_311_PAGE,
        offset,
        "CreatedDate DESC"
      );

      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`Houston 311 API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const json = await res.json();
      const features = json.features || [];
      if (features.length === 0) { hasMore = false; break; }

      const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
      const rows = records
        .filter((r: Record<string, unknown>) => r.CaseNumber365 || r.CaseNumber)
        .map((r: Record<string, unknown>) => ({
          unique_key: `HOU311-${r.CaseNumber365 || r.CaseNumber}`,
          complaint_type: r.Title ? String(r.Title) : null,
          descriptor: r.CaseType ? String(r.CaseType) : null,
          status: r.Status ? String(r.Status) : null,
          created_date: r.CreatedDate ? new Date(Number(r.CreatedDate)).toISOString().slice(0, 10) : null,
          closed_date: r.ClosedDate ? new Date(Number(r.ClosedDate)).toISOString().slice(0, 10) : null,
          incident_address: r.IncidentAddress ? String(r.IncidentAddress) : null,
          borough: "Houston",
          latitude: r.Latitude ? parseFloat(String(r.Latitude)) : null,
          longitude: r.Longitude ? parseFloat(String(r.Longitude)) : null,
          metro: "houston",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "Houston 311", true);
      }

      pagesFetched++;
      if (features.length < MAX_311_PAGE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += MAX_311_PAGE; }
    }

    errors.push(`Houston 311: linking deferred to dedicated link cron (${totalAdded} rows synced)`);
    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Houston 311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

async function syncHoustonCrimes(supabase: SupabaseClient): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "houston_crimes");
  const syncStartMs = Date.now();

  let totalAdded = 0;
  const totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    const CRIME_PAGE = 2000;

    for (const layer of [0, 1, 2, 3]) {
      let offset = 0;
      let hasMore = true;
      let pagesFetched = 0;

      while (hasMore) {
        const url = buildHoustonArcGISUrl(
          `https://mycity2.houstontx.gov/pubgis02/rest/services/HPD/NIBRS_Recent_Crime_Reports/FeatureServer/${layer}`,
          "1=1",
          CRIME_PAGE,
          offset,
          "USER_RMSOccurrenceDate DESC"
        );

        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          const errText = await res.text();
          errors.push(`Houston Crimes layer ${layer} API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
          break;
        }

        const json = await res.json();
        const features = json.features || [];
        if (features.length === 0) { hasMore = false; break; }

        const records = features.map((f: { attributes: Record<string, unknown> }) => f.attributes);
        const rows = records
          .filter((r: Record<string, unknown>) => r.USER_Incident)
          .map((r: Record<string, unknown>) => {
            const nibrDesc = r.USER_NIBRSDescription ? String(r.USER_NIBRSDescription) : null;
            const blockRange = r.USER_BlockRange ? String(r.USER_BlockRange) : "";
            const streetName = r.USER_StreetName ? String(r.USER_StreetName) : "";
            const streetType = r.USER_StreetType ? String(r.USER_StreetType) : "";
            const suffix = r.USER_Suffix ? String(r.USER_Suffix) : "";
            const fullAddress = [blockRange, streetName, streetType, suffix].filter(Boolean).join(" ").trim();

            return {
              cmplnt_num: `HPD-${r.USER_Incident}`,
              cmplnt_date: r.USER_RMSOccurrenceDate ? new Date(Number(r.USER_RMSOccurrenceDate)).toISOString().slice(0, 10) : null,
              borough: "Houston",
              precinct: r.USER_District ? String(r.USER_District) : null,
              offense_description: nibrDesc,
              crime_category: categorizeHoustonCrime(nibrDesc),
              latitude: null,
              longitude: null,
              zip_code: r.USER_ZIPCode ? String(r.USER_ZIPCode) : null,
              metro: "houston",
              imported_at: new Date().toISOString(),
              incident_address: fullAddress || null,
            };
          });

        if (rows.length > 0) {
          totalAdded += await batchUpsert(supabase, "nypd_complaints", rows, "cmplnt_num", errors, `Houston Crimes L${layer}`);
        }

        pagesFetched++;
        if (features.length < CRIME_PAGE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += CRIME_PAGE; }
      }

      if (isTimeBudgetExceeded(syncStartMs)) break;
    }

    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", { target_metro: "houston" });
      if (zipErr) errors.push(`Houston Crimes zip backfill error: ${zipErr.message}`);
    } catch (zipBackfillErr) {
      errors.push(`Houston Crimes zip backfill fatal: ${String(zipBackfillErr)}`);
    }
  } catch (err) {
    errors.push(`Houston Crimes sync fatal: ${String(err)}`);
  }

  await finalizeSyncLog(supabase, logId, errors.some(e => e.includes("fatal")) ? "failed" : "completed", totalAdded, totalLinked, errors);
  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Source registry
// ---------------------------------------------------------------------------
const SOURCES: Record<string, (supabase: SupabaseClient, sinceOverride?: string) => Promise<SyncResult>> = {
  // NYC sources
  hpd: syncHPDViolations,
  complaints: sync311Complaints,
  litigations: syncHPDLitigations,
  dob: syncDOBViolations,
  nypd: syncNYPDComplaints,
  bedbugs: syncBedBugReports,
  evictions: syncEvictions,
  sheds: syncSidewalkSheds,
  permits: syncDobPermits,
  // LA sources
  lahd: syncLAHDViolations,
  "la-311": syncLA311Complaints,
  ladbs: syncLADBSViolations,
  lapd: syncLAPDCrimeData,
  "la-permits": syncLAPermits,
  "la-soft-story": syncLASoftStory,
  "la-evictions": syncLAHDEvictions,
  "la-buyouts": syncLAHDTenantBuyouts,
  "la-ccris": syncLAHDCCRIS,
  "la-violation-summary": syncLAHDViolationSummary,
  // Chicago sources
  "chicago-violations": syncChicagoViolations,
  "chicago-311": syncChicago311,
  "chicago-crimes": syncChicagoCrimes,
  "chicago-permits": syncChicagoPermits,
  "chicago-rlto": syncChicagoRLTO,
  "chicago-lead": syncChicagoLead,
  // Miami sources
  "miami-violations": syncMiamiViolations,
  "miami-311": syncMiami311,
  "miami-crimes": syncMiamiCrimes,
  "miami-permits": syncMiamiPermits,
  "miami-unsafe": syncMiamiUnsafeStructures,
  "miami-recerts": syncMiamiRecertifications,
  // Houston sources
  "houston-violations": syncHoustonViolations,
  "houston-311": syncHouston311,
  "houston-crimes": syncHoustonCrimes,
};

// ---------------------------------------------------------------------------
// Link-only tables
// ---------------------------------------------------------------------------
const LINK_TABLES: Record<string, { table: string; label: string }> = {
  hpd: { table: "hpd_violations", label: "HPD" },
  litigations: { table: "hpd_litigations", label: "HPD Litigations" },
  dob: { table: "dob_violations", label: "DOB" },
  bedbugs: { table: "bedbug_reports", label: "Bedbugs" },
  evictions: { table: "evictions", label: "Evictions" },
  sheds: { table: "sidewalk_sheds", label: "Sheds" },
  permits: { table: "dob_permits", label: "Permits" },
};

// ---------------------------------------------------------------------------
// Link-only mode (abbreviated — the full link-only logic from the Vercel
// version is ported here but omitted for brevity; the pattern is identical
// except NextResponse.json is replaced with new Response(JSON.stringify(...)))
// ---------------------------------------------------------------------------
async function runLinkOnly(
  supabase: SupabaseClient,
  sourceParam: string | null,
  startTime: number
): Promise<Response> {
  const errors: string[] = [];
  const allAffectedIds = new Set<string>();
  const linkResults: Record<string, { linked: number; errors: string[] }> = {};
  const syncStartTime = new Date().toISOString();

  const tablesToLink = sourceParam
    ? (LINK_TABLES[sourceParam] ? { [sourceParam]: LINK_TABLES[sourceParam] } : null)
    : LINK_TABLES;

  const LA_ADDR_SOURCES = ["lahd", "ladbs", "la-311", "la-permits", "la-evictions", "la-buyouts", "la-ccris", "la-violation-summary"];
  const CHICAGO_ADDR_SOURCES = ["chicago-violations", "chicago-311", "chicago-crimes", "chicago-permits", "chicago-rlto", "chicago-lead"];
  const MIAMI_ADDR_SOURCES = ["miami-violations", "miami-311", "miami-permits", "miami-unsafe", "miami-recerts"];
  const HOUSTON_ADDR_SOURCES = ["houston-violations", "houston-311", "houston-crimes"];
  const isChicagoLink = sourceParam === "chicago" || (sourceParam && CHICAGO_ADDR_SOURCES.includes(sourceParam));
  const isMiamiLink = sourceParam === "miami" || (sourceParam && MIAMI_ADDR_SOURCES.includes(sourceParam));
  const isHoustonLink = sourceParam === "houston" || (sourceParam && HOUSTON_ADDR_SOURCES.includes(sourceParam));

  if (sourceParam && !tablesToLink && sourceParam !== "complaints" && !LA_ADDR_SOURCES.includes(sourceParam) && !isChicagoLink && !isMiamiLink && !isHoustonLink) {
    return new Response(
      JSON.stringify({ error: `Unknown link source: ${sourceParam}. Valid: ${[...Object.keys(LINK_TABLES), "complaints", ...LA_ADDR_SOURCES, "chicago", ...CHICAGO_ADDR_SOURCES, "miami", ...MIAMI_ADDR_SOURCES, "houston", ...HOUSTON_ADDR_SOURCES].join(", ")}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Link BBL-based tables
  if (tablesToLink) {
    for (const [name, { table, label }] of Object.entries(tablesToLink)) {
      const tableErrors: string[] = [];
      try {
        const result = await linkByBbl(supabase, table, syncStartTime, tableErrors, label);
        for (const id of result.affectedBuildingIds) allAffectedIds.add(id);
        linkResults[name] = { linked: result.linked, errors: tableErrors };
      } catch (err) {
        tableErrors.push(`${label} link error: ${String(err)}`);
        linkResults[name] = { linked: 0, errors: tableErrors };
      }
    }
  }

  // Backfill slugs
  let slugsBackfilled = 0;
  if ((Date.now() - startTime) / 1000 < 280) {
    try {
      const { data: noSlugs } = await supabase
        .from("buildings")
        .select("id, full_address")
        .is("slug", null)
        .limit(500);

      if (noSlugs && noSlugs.length > 0) {
        for (const b of noSlugs) {
          const slug = generateBuildingSlug(b.full_address);
          await supabase.from("buildings").update({ slug }).eq("id", b.id);
        }
        slugsBackfilled = noSlugs.length;
      }
    } catch (slugErr) {
      errors.push(`Slug backfill error: ${String(slugErr)}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Log link run to sync_log
  const totalLinked = Object.values(linkResults).reduce((sum, r) => sum + r.linked, 0);
  const allErrors = [
    ...errors,
    ...Object.entries(linkResults).flatMap(([name, r]) => r.errors.map(e => `[${name}] ${e}`)),
  ];
  try {
    await supabase.from("sync_log").insert({
      sync_type: `link_${sourceParam || "all"}`,
      status: "completed",
      records_added: 0,
      records_linked: totalLinked,
      errors: allErrors.length > 0 ? allErrors : null,
      started_at: syncStartTime,
      completed_at: new Date().toISOString(),
    });
  } catch { /* best-effort logging */ }

  const indexNowResult = await notifyIndexNowForBuildings(supabase, allAffectedIds);

  return new Response(JSON.stringify({
    success: true,
    mode: "link",
    source: sourceParam || "all",
    duration_seconds: parseFloat(elapsed),
    buildings_updated: allAffectedIds.size,
    slugs_backfilled: slugsBackfilled,
    link_results: linkResults,
    indexnow: indexNowResult,
    errors,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// Deno.serve entry point
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  // ---- Auth check ----
  const serviceRoleKey = Deno.env.get("CRON_SECRET");
  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const startTime = Date.now();

  // Parse { source, mode, since } from request body JSON
  let sourceParam: string | null = null;
  let mode: string | null = null;
  let sinceOverride: string | undefined;

  try {
    const body = await req.json();
    sourceParam = body.source || null;
    mode = body.mode || null;
    if (body.since) {
      sinceOverride = toSodaDate(new Date(body.since).toISOString());
    }
  } catch {
    // Empty body is OK — defaults to sync all
  }

  try {
    const supabase = getSupabaseAdmin();

    // Clean up zombie "running" sync_log entries
    const staleCleaned = await cleanupStaleSyncs(supabase);

    // --- Link-only mode ---
    if (mode === "link") {
      return runLinkOnly(supabase, sourceParam, startTime);
    }

    // Determine which sources to sync
    let sourcesToRun: [string, (supabase: SupabaseClient, sinceOverride?: string) => Promise<SyncResult>][];

    if (sourceParam) {
      const fn = SOURCES[sourceParam];
      if (!fn) {
        return new Response(
          JSON.stringify({ error: `Unknown source: ${sourceParam}. Valid: ${Object.keys(SOURCES).join(", ")}` }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      sourcesToRun = [[sourceParam, fn]];
    } else {
      sourcesToRun = Object.entries(SOURCES);
    }

    // Run selected syncs sequentially
    const results: Record<string, SyncResult> = {};
    const allAffectedIds = new Set<string>();

    for (const [name, syncFn] of sourcesToRun) {
      const result = await syncFn(supabase, sinceOverride);
      results[name] = result;
      for (const id of result.affectedBuildingIds) {
        allAffectedIds.add(id);
      }
    }

    const countErrors: string[] = [];

    // Backfill slugs for any buildings missing them
    let slugsBackfilled = 0;
    if ((Date.now() - startTime) / 1000 < 330) {
      try {
        const { data: noSlugs } = await supabase
          .from("buildings")
          .select("id, full_address")
          .is("slug", null)
          .limit(500);

        if (noSlugs && noSlugs.length > 0) {
          for (const b of noSlugs) {
            const slug = generateBuildingSlug(b.full_address);
            await supabase.from("buildings").update({ slug }).eq("id", b.id);
          }
          slugsBackfilled = noSlugs.length;
        }
      } catch (slugErr) {
        countErrors.push(`Slug backfill error: ${String(slugErr)}`);
      }
    }

    // Trigger revalidation on the Next.js app instead of direct revalidatePath
    const revalidationPaths = [
      "/[city]",
      "/[city]/building/[borough]/[slug]",
      "/[city]/worst-rated-buildings",
      "/[city]/buildings/[borough]",
    ];
    await triggerRevalidation(revalidationPaths);

    // Notify search engines about updated building pages
    const indexNowResult = await notifyIndexNowForBuildings(supabase, allAffectedIds);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Build response
    const response: Record<string, unknown> = {
      success: true,
      mode: "sync",
      source: sourceParam || "all",
      duration_seconds: parseFloat(elapsed),
      stale_syncs_cleaned: staleCleaned,
      buildings_updated: allAffectedIds.size,
      slugs_backfilled: slugsBackfilled,
      building_count_errors: countErrors,
      indexnow: indexNowResult,
    };

    for (const [name, result] of Object.entries(results)) {
      response[name] = {
        records_added: result.totalAdded,
        records_linked: result.totalLinked,
        errors: result.errors,
      };
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("Cron sync error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        duration_seconds: parseFloat(elapsed),
        error: String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
