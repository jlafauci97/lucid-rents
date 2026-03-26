import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { categorizeCrime } from "@/lib/crime-categories";
import { generateBuildingSlug } from "@/lib/seo";

// ---------------------------------------------------------------------------
// Supabase admin client (service role -- bypasses RLS, no cookies needed)
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
const MAX_PAGES = 10; // Safety limit: max API pages per sync (Pro plan: 300s timeout)
const SYNC_TIME_BUDGET_MS = 220_000; // Stop fetching new pages after 220s to leave time for linking + response
const STALE_SYNC_MINUTES = 20; // Mark "running" syncs older than this as "failed"

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
  const appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
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

/** Validate a date string — rejects garbage like "Y9990120". */
function parseDate(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const sliced = raw.slice(0, 10);
  // Must look like YYYY-MM-DD or YYYYMMDD
  const normalized = sliced.includes("-") ? sliced : `${sliced.slice(0, 4)}-${sliced.slice(4, 6)}-${sliced.slice(6, 8)}`;
  const parsed = new Date(normalized);
  if (isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) return null;
  // Reject dates more than 1 year in the future (bad source data)
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  if (parsed > oneYearFromNow) return null;
  return normalized;
}

/** Check if sync should stop paging (time budget exceeded). */
function isTimeBudgetExceeded(syncStartMs: number): boolean {
  return Date.now() - syncStartMs > SYNC_TIME_BUDGET_MS;
}

/** Upsert rows in batches to avoid payload size limits.
 *  Use ignoreDuplicates=true for high-volume tables where existing records
 *  don't need updating (ON CONFLICT DO NOTHING — much faster).
 *  Note: When ignoreDuplicates is true, Postgres ON CONFLICT DO NOTHING
 *  returns count=0 regardless of how many rows were actually inserted,
 *  so we use batch.length as the count instead. */
async function batchUpsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  errors: string[],
  label: string,
  ignoreDuplicates = false
): Promise<number> {
  let totalCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    if (ignoreDuplicates) {
      // Skip count: "exact" — Postgres ON CONFLICT DO NOTHING always returns 0
      const { error: upsertError } = await supabase
        .from(table)
        .upsert(batch, { onConflict, ignoreDuplicates });

      if (upsertError) {
        errors.push(`${label} upsert error (batch ${i}): ${upsertError.message}`);
      } else {
        totalCount += batch.length;
      }
    } else {
      const { error: upsertError, count } = await supabase
        .from(table)
        .upsert(batch, { onConflict, count: "exact" });

      if (upsertError) {
        errors.push(`${label} upsert error (batch ${i}): ${upsertError.message}`);
      } else {
        totalCount += count ?? batch.length;
      }
    }
  }

  return totalCount;
}

/** Format a date for SODA API $where clauses (floating timestamp, no Z). */
function toSodaDate(isoString: string): string {
  // SODA floating timestamps need format: YYYY-MM-DDTHH:MM:SS.sss (no Z)
  return isoString.replace("Z", "").replace(/\+00:00$/, "");
}

/** Get the last successful sync date for a given sync type.
 *  Subtracts a 3-day safety overlap to catch delayed data updates on
 *  NYC Open Data. The upsert (onConflict) ensures no duplicates. */
async function getLastSyncDate(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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
    // Subtract 7 days from last sync time to account for data publishing lag.
    // NYC Open Data may update records up to a week after the date they occurred.
    // The upsert with onConflict ensures re-fetched records don't create duplicates.
    // Truncate to start-of-day since SODA dates are at midnight (T00:00:00).
    const syncDate = new Date(data.completed_at);
    syncDate.setDate(syncDate.getDate() - 7);
    syncDate.setUTCHours(0, 0, 0, 0);
    return toSodaDate(syncDate.toISOString());
  }

  // Default: 14 days ago for initial sync. Keeps first run within Vercel's
  // 300s timeout even for high-volume sources (Chicago 311 has ~5K records/day).
  // Subsequent runs use the last sync_log entry with 7-day overlap.
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return toSodaDate(d.toISOString());
}

/** Create a new sync_log entry and return its id. */
async function createSyncLog(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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

/** Mark stale "running" sync_log entries as "failed" to prevent zombie accumulation.
 *  This handles the case where a previous sync was killed by Vercel's 60s timeout
 *  before it could finalize the log entry. */
async function cleanupStaleSyncs(
  supabase: ReturnType<typeof getSupabaseAdmin>
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
  supabase: ReturnType<typeof getSupabaseAdmin>,
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

/** Look up address info for a BBL from the source table that has it.
 *  Returns enough data to create a building entry. */
async function getAddressForBbl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  bbl: string
): Promise<{ borough: string; house_number: string; street_name: string; zip_code: string | null; full_address: string } | null> {
  // Try bedbug_reports first (has structured address fields)
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

  // Try evictions (has eviction_address as a single string)
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

/** Link records by BBL and return set of affected building IDs.
 *  Creates new building entries for BBLs not found in the buildings table. */
async function linkByBbl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  syncStartTime: string,
  errors: string[],
  label: string,
  createBuildings = true
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  // Link ALL unlinked records from the last 30 days by paginating in batches.
  // Vercel Pro has 900s timeout so we can process much more per sync run.
  const linkCutoff = new Date();
  linkCutoff.setDate(linkCutoff.getDate() - 30);

  const PAGE_SIZE = 5000;
  let allUnlinked: { id: string; bbl: string }[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
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

  // Only keep valid 10-digit numeric BBLs (skip malformed letter-prefix or 11-digit)
  const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter((b) => b && /^\d{10}$/.test(b)))] as string[];

  // Fetch building IDs for those BBLs (batch in groups of 500 for .in())
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

  // Create buildings for unmatched BBLs (only in link-only mode to save time during normal syncs)
  const unmatchedBbls = bblSet.filter((bbl) => !bblToBuilding.has(bbl));
  if (createBuildings && unmatchedBbls.length > 0) {
    let created = 0;
    // Vercel Pro: 900s timeout allows more building creation per sync
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
    // Batch updates in groups of 200 to avoid URL length limits with .in()
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
// Address-based linking for LA records (no BBL, use house_number + street_name
// or incident_address or address column to match buildings.full_address)
// ---------------------------------------------------------------------------
async function linkByAddress(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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
  const primaryAddrCol = cols[cols.length - 1]; // filter on the main address column

  // Fetch unlinked records with an address
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
    // Build address string from columns (e.g. house_number + street_name → "123 MAIN ST")
    let raw: string;
    if (cols.length > 1) {
      raw = cols.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
    } else {
      raw = String(r[cols[0]] || "").trim();
    }
    raw = raw.toUpperCase().replace(/\s+/g, " ");
    if (!raw || raw.length < 5) continue;
    // Strip apartment/unit suffixes for better matching
    const addr = raw.replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
    if (!addr) continue;
    if (!addressToIds.has(addr)) addressToIds.set(addr, []);
    addressToIds.get(addr)!.push(String(r[idColumn]));
  }

  let lookupCount = 0;
  for (const [address, recordIds] of addressToIds) {
    if (lookupCount >= maxLookups) break;
    lookupCount++;

    // Use exact prefix match (address + comma) to avoid "123 MAIN" matching "1234 MAIN"
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
      // Auto-create building from the first unlinked record's full address
      const sample = allUnlinked.find(r => {
        const addr = String(r[fullAddressColumn] || "").trim();
        return addr.toUpperCase().includes(address);
      });
      if (sample) {
        const fullAddr = String(sample[fullAddressColumn] || "").trim();
        if (fullAddr.length > 5) {
          // Extract borough/neighborhood from address or use default
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
// Link records to buildings by APN (normalizes dashes)
// Used for LA data where violation APNs lack dashes but building APNs have them
// ---------------------------------------------------------------------------
async function linkByApn(
  supabase: ReturnType<typeof getSupabaseAdmin>,
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

  // Fetch unlinked records that have an APN
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

  // Group record IDs by APN
  const apnToIds = new Map<string, string[]>();
  for (const r of allUnlinked) {
    const apn = String(r[apnColumn] || "").trim();
    if (!apn) continue;
    if (!apnToIds.has(apn)) apnToIds.set(apn, []);
    apnToIds.get(apn)!.push(String(r[idColumn]));
  }

  // Look up buildings by APN — try both raw APN and dashed format (XXXX-XXX-XXX)
  for (const [apn, recordIds] of apnToIds) {
    // Try formatted APN with dashes: 10-digit LA APNs → XXXX-XXX-XXX
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
  [key: string]: unknown;
}

async function syncHPDViolations(supabase: ReturnType<typeof getSupabaseAdmin>, sinceOverride?: string): Promise<SyncResult> {
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

      const res = await fetch(url);
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
          // Construct BBL from boroid + block + lot (HPD API doesn't provide a bbl field)
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

    // Linking: match by BBL to buildings (scoped to this sync run)
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

async function sync311Complaints(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
  const fnStart = Date.now();

  // Use 7-day overlap (same as getLastSyncDate) to catch delayed data
  // publishing. NYC Open Data publishes 311 data with a 2-3 day lag.
  // With ignoreDuplicates (ON CONFLICT DO NOTHING), re-fetching existing
  // records is cheap — they get skipped without updating.
  const lastSync = await getLastSyncDate(supabase, "complaints_311");
  const logId = await createSyncLog(supabase, "complaints_311");

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  // 311 uses a smaller page size + $select to stay within 60s Vercel timeout
  const COMPLAINTS_PAGE_SIZE = 2000;
  const COMPLAINTS_SELECT = "unique_key,complaint_type,descriptor,agency,status,created_date,closed_date,resolution_description,borough,incident_address,latitude,longitude";

  try {
    let offset = 0;
    let hasMore = true;
    let pagesFetched = 0;

    const typesIn = COMPLAINT_TYPES.map((t) => `'${t}'`).join(",");

    // Collect address → unique_keys mapping in memory during fetch
    // to avoid re-querying the complaints_311 table (no imported_at index)
    const addressToKeys = new Map<string, string[]>();

    while (hasMore) {
      const url = buildSodaUrl(
        "erm2-nwe9",
        `created_date > '${lastSync}' AND complaint_type IN (${typesIn})`,
        COMPLAINTS_PAGE_SIZE,
        offset,
        "created_date ASC"
      ) + `&$select=${encodeURIComponent(COMPLAINTS_SELECT)}`;

      const res = await fetch(url);
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

      // Build address → unique_keys map for linking (avoids slow imported_at queries)
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

      // Time budget: stop fetching if >35s elapsed (leave time for linking + finalization)
      if (Date.now() - fnStart > 35_000) {
        errors.push(`311 stopped fetching after ${pagesFetched} pages (time budget)`);
        hasMore = false;
      }
    }

    // Linking: match by address using in-memory data (avoids slow imported_at query)
    // Skip if running low on time (>45s elapsed)
    const elapsedMs = Date.now() - fnStart;
    if (elapsedMs < 45_000 && addressToKeys.size > 0) {
      try {
        let lookupCount = 0;
        const MAX_LOOKUPS = 500;

        for (const [address, uniqueKeys] of addressToKeys) {
          if (lookupCount >= MAX_LOOKUPS) break;
          // Stop linking if running low on time
          if (Date.now() - fnStart > 50_000) break;
          lookupCount++;

          // Use exact street prefix match (not loose substring) to avoid
          // "123 MAIN ST" matching "1234 MAIN ST"
          const { data: matchedBuildings } = await supabase
            .from("buildings")
            .select("id")
            .ilike("full_address", `${address},%`)
            .eq("metro", "nyc")
            .limit(1);

          if (matchedBuildings && matchedBuildings.length > 0) {
            const buildingId = matchedBuildings[0].id;

            // Update in batches of 500 to avoid URL length limits
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

async function syncHPDLitigations(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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
        `caseopendate > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "caseopendate ASC"
      );

      const res = await fetch(url);
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

    // Linking: match by BBL (scoped to this sync run)
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
  isn_dob_bis_viol?: string; // API field name has trailing L
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

async function syncDOBViolations(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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

      const res = await fetch(url);
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
        .filter((r) => r.isn_dob_bis_viol) // Fixed: API field has trailing L
        .map((r) => {
          // Construct BBL from boro/block/lot (DOB doesn't have a bbl field)
          // Standard NYC BBL = boro(1) + block(5) + lot(4) = 10 digits
          // DOB API returns lot as 5 digits; we take last 4 to match buildings table
          let bbl: string | null = null;
          if (r.boro && r.block && r.lot) {
            // Normalize boro to numeric code (API sometimes returns text)
            const boroMap: Record<string, string> = { "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", MANHATTAN: "1", BRONX: "2", BROOKLYN: "3", QUEENS: "4", "STATEN ISLAND": "5" };
            const boroCode = boroMap[r.boro.toUpperCase()] || r.boro;
            if (/^\d$/.test(boroCode)) {
              const block = r.block.padStart(5, "0").slice(-5);
              const lot = r.lot.padStart(4, "0").slice(-4);
              bbl = `${boroCode}${block}${lot}`;
            }
          }

          return {
            isn_dob_bis_vio: String(r.isn_dob_bis_viol), // DB column without L
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

    // Linking: match by BBL (scoped to this sync run)
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

async function syncNYPDComplaints(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
  // Use standard 7-day overlap to catch delayed data publishing
  const lastSync = await getLastSyncDate(supabase, "nypd_complaints");

  const logId = await createSyncLog(supabase, "nypd_complaints");

  let totalAdded = 0;
  const totalLinked = 0; // No building linking for crime (area-based)
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

      const res = await fetch(url);
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
          zip_code: null, // Derived from lat/lon after upsert via nyc_zip_centroids
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

    // Backfill zip_code from lat/lon using nearest centroid in nyc_zip_centroids.
    // The NYPD SODA API does not include zip codes, so we derive them.
    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", { target_metro: "nyc" });
      if (zipErr) {
        errors.push(`NYPD zip backfill error: ${zipErr.message}`);
      }
    } catch (zipBackfillErr) {
      errors.push(`NYPD zip backfill fatal: ${String(zipBackfillErr)}`);
    }

    // No BBL linking for crimes — they're area-based, matched by zip code.
    // Instead, update crime_count on buildings that share a zip code with new crimes.
    // Batched: count per zip, then bulk-update all buildings in that zip at once.
    try {
      // Get distinct zip codes from recently synced crimes
      const { data: recentZips } = await supabase
        .from("nypd_complaints")
        .select("zip_code")
        .not("zip_code", "is", null)
        .gte("imported_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(50000);

      if (recentZips && recentZips.length > 0) {
        const uniqueZips = [...new Set(recentZips.map((r) => r.zip_code).filter(Boolean))] as string[];

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const sinceDate = oneYearAgo.toISOString().slice(0, 10);

        // Process zips in parallel batches of 5
        for (let i = 0; i < uniqueZips.length; i += 5) {
          const zipBatch = uniqueZips.slice(i, i + 5);
          await Promise.all(zipBatch.map(async (zip) => {
            const { count: crimeCount } = await supabase
              .from("nypd_complaints")
              .select("id", { count: "exact", head: true })
              .eq("zip_code", zip)
              .gte("cmplnt_date", sinceDate);

            // Bulk-update all buildings in this zip at once (no N+1)
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

async function syncBedBugReports(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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

      const res = await fetch(url);
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

    // Linking: match by BBL
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

async function syncEvictions(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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

      const res = await fetch(url);
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

    // Linking: match by BBL (for the few evictions that have BBLs)
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
          // Extract just the street address (before any apartment info)
          const raw = (r.eviction_address as string).trim().toUpperCase();
          // Remove apartment/unit suffixes for matching
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
  permittee_s_business_name?: string;
  [key: string]: unknown;
}

async function syncSidewalkSheds(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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

      const res = await fetch(url);
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
          // Construct BBL from borough + block + lot
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

    // Linking: match by BBL
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
// Sync DOB Permits (ALL work types)
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

async function syncDobPermits(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
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

      const res = await fetch(url);
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

    // Linking: match by BBL
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
// Update building counts — uses a single SQL RPC to count all 8 tables per
// building in one database round-trip per batch. Replaces the old approach of
// 8 separate COUNT queries per building (80+ queries for 10 buildings).
// ---------------------------------------------------------------------------
async function updateBuildingCounts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  affectedBuildingIds: Set<string>
) {
  const errors: string[] = [];

  if (affectedBuildingIds.size === 0) return errors;

  const buildingIds = [...affectedBuildingIds];

  // Process in batches of 50 via the SQL RPC (1 query per batch instead of 8×N)
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
  const appToken = process.env.LA_OPEN_DATA_APP_TOKEN;
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
  const appToken = process.env.CHICAGO_OPEN_DATA_APP_TOKEN;
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
// LA Sync Functions — data.lacity.org SODA API
// ---------------------------------------------------------------------------

// LA address matching: normalize address for matching against buildings table
function normalizeLAAddress(addr: string): string {
  return addr.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
}

// Link LA records to buildings by matching normalized address + zip
async function linkLAByAddress(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  sinceDate: string,
  errors: string[],
  label: string
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  // Find unlinked records from this sync run
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

  // Get unique zip codes from unlinked records
  const zips = [...new Set(unlinked.map((r) => r.zip_code).filter(Boolean))];
  if (zips.length === 0) return { linked, affectedBuildingIds };

  // Fetch LA buildings in those zips
  const { data: buildings } = await supabase
    .from("buildings")
    .select("id, full_address, zip_code")
    .eq("metro", "los-angeles")
    .in("zip_code", zips);

  if (!buildings || buildings.length === 0) return { linked, affectedBuildingIds };

  // Build address lookup map
  const addrMap = new Map<string, string>();
  for (const b of buildings) {
    // Extract street part before ", Los Angeles"
    const street = b.full_address.split(",")[0]?.trim() || "";
    const key = `${normalizeLAAddress(street)}|${b.zip_code}`;
    addrMap.set(key, b.id);
  }

  // Match and update
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

  // Batch update building_id
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE);
    for (const u of batch) {
      await supabase.from(table).update({ building_id: u.building_id }).eq("id", u.id);
      linked++;
    }
  }

  return { linked, affectedBuildingIds };
}

/**
 * Sync LADBS Code Enforcement cases (housing violations).
 * LA Open Data endpoint: u82d-eh7z (Building and Safety Code Enforcement)
 * Equivalent of NYC HPD violations — stores in hpd_violations with metro='los-angeles'
 */
async function syncLAHDViolations(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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

      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`LAHD API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      // LADBS fields: apno, stno, predir, stname, suffix, zip, apc, stat, adddttm, aptype
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
          zip_code: r.zip ? String(r.zip).replace(/-.*/, "").slice(0, 5) : null,
          metro: "los-angeles",
          imported_at: new Date().toISOString(),
        }));

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "hpd_violations", rows, "violation_id", errors, "LAHD");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    // Address-based linking for LA violations (no BBLs — use house_number + street_name)
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

/**
 * Sync MyLA311 service requests.
 * LA Open Data endpoint: 2cy6-i7zn (2026 data — "MyLA311 Cases 2026")
 * Equivalent of NYC 311 complaints — stores in complaints_311 with metro='los-angeles'
 */
async function syncLA311Complaints(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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

      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`LA 311 API error (offset ${offset}): ${res.status}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      // 2026 dataset fields: casenumber, createddate, closeddate, type, status, origin,
      // locator_gis_returned_address, locator_sr_house_number_, locator_sr_street_name__c,
      // zipcode__c, geolocation__latitude__s, geolocation__longitude__s,
      // locator_sr_area_planning, resolution_code__c
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

    // Address-based linking for LA 311 complaints
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

/**
 * Sync LADBS building code enforcement violations.
 * LA Open Data endpoint: u82d-eh7z (same dataset, different filter for DOB-equivalent)
 * Stores in dob_violations with metro='los-angeles'
 */
async function syncLADBSViolations(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      // LADBS code enforcement dataset filtered for violation types
      // Fields: apno, stno, predir, stname, suffix, zip, apc, stat, adddttm, aptype
      const url = buildLASodaUrl(
        "u82d-eh7z",
        `adddttm > '${lastSync}' AND aptype LIKE '%VIOL%'`,
        PAGE_SIZE,
        offset,
        "adddttm ASC"
      );

      const res = await fetch(url);
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

    // Address-based linking for LADBS violations (use house_number + street_name)
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

/**
 * Sync LAPD crime data — SKIPPED for now.
 * The 2020-2024 dataset is deprecated (NIBRS transition).
 * Will implement when a reliable current data source is identified.
 */
async function syncLAPDCrimeData(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "lapd_crime");
  const logId = await createSyncLog(supabase, "lapd_crime");
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
        "2nrs-mtv8",
        `date_occ > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "date_occ ASC"
      );

      const res = await fetch(url);
      if (!res.ok) {
        const errText = await res.text();
        errors.push(`LAPD API error (offset ${offset}): ${res.status} ${errText.slice(0, 200)}`);
        break;
      }

      const records = await res.json();
      if (!records || records.length === 0) {
        hasMore = false;
        break;
      }

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
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    // Backfill zip codes from lat/lon using nearest LA centroid
    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", {
        target_metro: "los-angeles",
      });
      if (zipErr) {
        errors.push(`LAPD zip backfill error: ${zipErr.message}`);
      }
    } catch (zipBackfillErr) {
      errors.push(`LAPD zip backfill fatal: ${String(zipBackfillErr)}`);
    }
  } catch (err) {
    errors.push(`LAPD crime sync fatal: ${String(err)}`);
  }

  await finalizeSyncLog(
    supabase,
    logId,
    errors.length > 0 ? "failed" : "completed",
    totalAdded,
    totalLinked,
    errors
  );
  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync LADBS building permits.
 * LA Open Data endpoint: pi9x-tg5x (Building Permits Issued 2020+)
 * Equivalent of NYC DOB permits — stores in dob_permits with metro='los-angeles'
 */
async function syncLAPermits(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildLASodaUrl(
        "pi9x-tg5x",
        `issue_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "issue_date ASC"
      );

      const res = await fetch(url);
      if (!res.ok) {
        errors.push(`LA Permits API error (offset ${offset}): ${res.status}`);
        break;
      }

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

    // Address-based linking for LA permits (use house_no + street_name)
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

/**
 * Sync LA soft-story seismic retrofit data (monthly).
 * Source: LADBS Soft Story Permits (nc44-6znn)
 * Updates is_soft_story and soft_story_status on buildings.
 */
async function syncLASoftStory(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "la_soft_story");
  let totalAdded = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  try {
    let offset = 0;

    while (true) {
      const url = buildLASodaUrl(
        "nc44-6znn",
        "1=1",
        PAGE_SIZE,
        offset,
        "pcis_permit ASC"
      );

      const res = await fetch(url);
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

// ---------------------------------------------------------------------------
// LAHD Eviction Cases sync (data.lacity.org/resource/2u8b-eyuu)
// ---------------------------------------------------------------------------
async function syncLAHDEvictions(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildLASodaUrl(
        "2u8b-eyuu",
        `received > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "received ASC"
      );

      const res = await fetch(url);
      if (!res.ok) { errors.push(`LAHD Evictions API error (offset ${offset}): ${res.status}`); break; }

      const records = await res.json();
      if (!records || records.length === 0) { hasMore = false; break; }

      const rows = records
        .filter((r: Record<string, unknown>) => r.apn)
        .map((r: Record<string, unknown>) => {
          // Parse dates — format is "MM-DD-YYYY" or ISO
          const parseDate = (d: unknown) => {
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
            notice_date: parseDate(r.notice_date),
            notice_type: r.notice_type ? String(r.notice_type) : null,
            received_date: parseDate(r.received),
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

// ---------------------------------------------------------------------------
// LAHD Tenant Buyout Cases sync (data.lacity.org/resource/ci3m-f23k)
// ---------------------------------------------------------------------------
async function syncLAHDTenantBuyouts(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildLASodaUrl(
        "ci3m-f23k",
        `disclosure_fileddate > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "disclosure_fileddate ASC"
      );

      const res = await fetch(url);
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

// ---------------------------------------------------------------------------
// LAHD CCRIS Cases sync (data.lacity.org/resource/ds2y-sb5t)
// ---------------------------------------------------------------------------
async function syncLAHDCCRIS(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildLASodaUrl(
        "ds2y-sb5t",
        `start_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "start_date ASC"
      );

      const res = await fetch(url);
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

// ---------------------------------------------------------------------------
// LAHD Violation Summary sync — building enrichment only, no dates
// (data.lacity.org/resource/cr8f-uc4j)
// ---------------------------------------------------------------------------
async function syncLAHDViolationSummary(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildLASodaUrl(
        "cr8f-uc4j",
        "1=1",
        PAGE_SIZE,
        offset,
        ":id"
      );

      const res = await fetch(url);
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

    // Link by APN first (most reliable — normalizes dash format mismatch)
    try {
      const apnResult = await linkByApn(supabase, "lahd_violation_summary", "id", "apn", errors, "LAHD ViolSummary", "los-angeles");
      totalLinked += apnResult.linked;
      for (const id of apnResult.affectedBuildingIds) affectedBuildingIds.add(id);
    } catch (linkErr) {
      errors.push(`LAHD ViolSummary APN linking error: ${String(linkErr)}`);
    }

    // Then link remaining by address (catches records where APN didn't match)
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
// Chicago Sync Functions — data.cityofchicago.org SODA API
// ---------------------------------------------------------------------------

/** Parse a Chicago address string into house_number + street_name. */
function parseChicagoAddress(addr: string | null | undefined): { house_number: string | null; street_name: string | null } {
  if (!addr) return { house_number: null, street_name: null };
  const trimmed = addr.trim();
  const match = trimmed.match(/^([0-9-]+)\s+(.+)/);
  if (match) return { house_number: match[1], street_name: match[2] };
  return { house_number: null, street_name: trimmed };
}

// Chicago crime category mapping
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

/**
 * Sync Chicago Building Violations.
 * Chicago Open Data endpoint: 22u3-xenr (Building Violations)
 * Stores in dob_violations with metro='chicago'
 */
async function syncChicagoViolations(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_violations");
  const logId = await createSyncLog(supabase, "chicago_violations");
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
      const url = buildChicagoSodaUrl(
        "22u3-xenr",
        `violation_last_modified_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "violation_last_modified_date ASC"
      );

      const res = await fetch(url);
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
            violation_id: `CHI-${r.id}`,
            inspection_date: r.violation_date ? String(r.violation_date).slice(0, 10) : null,
            violation_number: r.violation_code ? String(r.violation_code) : null,
            nov_description: r.violation_description ? String(r.violation_description) : null,
            status: r.violation_status ? String(r.violation_status) : null,
            borough: "Chicago",
            house_number: parsed.house_number,
            street_name: parsed.street_name,
            latitude: r.latitude ? parseFloat(String(r.latitude)) : null,
            longitude: r.longitude ? parseFloat(String(r.longitude)) : null,
            metro: "chicago",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "violation_id", errors, "Chicago Violations");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    // Skip inline linking — deferred to dedicated cron: mode=link&source=chicago at 15:30 UTC.
    errors.push(`Chicago Violations: linking deferred to dedicated link cron (${totalAdded} rows synced)`);

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Violations fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync Chicago 311 Service Requests.
 * Chicago Open Data endpoint: v6vf-nfxy (311 Service Requests)
 * Stores in complaints_311 with metro='chicago'
 */
async function syncChicago311(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_311");
  const logId = await createSyncLog(supabase, "chicago_311");
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

    // Chicago 311 is extremely high-volume (~5K records/day). Use smaller pages
    // and a per-request timeout to stay within Vercel's 300s limit.
    const CHI311_PAGE = 2000;
    const CHI311_MAX_PAGES = 8;

    while (hasMore) {
      const url = buildChicagoSodaUrl(
        "v6vf-nfxy",
        `created_date > '${lastSync}'`,
        CHI311_PAGE,
        offset,
        "created_date ASC"
      );

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

    // Skip inline linking — Chicago 311 is too high-volume to link during sync.
    // Linking is handled by the dedicated cron: mode=link&source=chicago at 15:30 UTC.
    errors.push(`Chicago 311: linking deferred to dedicated link cron (${totalAdded} rows synced)`);

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago 311 fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync CPD Crime Data.
 * Chicago Open Data endpoint: ijzp-q8t2 (Crimes - 2001 to Present)
 * Stores in nypd_complaints with metro='chicago'
 */
async function syncChicagoCrimes(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_crimes");
  const logId = await createSyncLog(supabase, "chicago_crimes");
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
      const url = buildChicagoSodaUrl(
        "ijzp-q8t2",
        `date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "date ASC"
      );

      const res = await fetch(url);
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

    // Backfill zip codes from lat/lon
    try {
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes", {
        target_metro: "chicago",
      });
      if (zipErr) {
        errors.push(`Chicago Crimes zip backfill error: ${zipErr.message}`);
      }
    } catch (zipBackfillErr) {
      errors.push(`Chicago Crimes zip backfill fatal: ${String(zipBackfillErr)}`);
    }
  } catch (err) {
    errors.push(`Chicago Crimes sync fatal: ${String(err)}`);
  }

  await finalizeSyncLog(
    supabase,
    logId,
    errors.length > 0 ? "failed" : "completed",
    totalAdded,
    totalLinked,
    errors
  );
  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync Chicago Building Permits.
 * Chicago Open Data endpoint: ydr8-5enu (Building Permits)
 * Stores in dob_permits with metro='chicago'
 */
async function syncChicagoPermits(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_permits");
  const logId = await createSyncLog(supabase, "chicago_permits");
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
      const url = buildChicagoSodaUrl(
        "ydr8-5enu",
        `issue_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "issue_date ASC"
      );

      const res = await fetch(url);
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
            job_number: `CHI-PERMIT-${r.id}`,
            work_permit: r.id ? String(r.id) : null,
            work_type: r.permit_type ? String(r.permit_type) : null,
            permit_status: r.permit_status ? String(r.permit_status) : null,
            issuance_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
            filing_date: r.issue_date ? String(r.issue_date).slice(0, 10) : null,
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
        totalAdded += await batchUpsert(supabase, "dob_permits", rows, "job_number", errors, "Chicago Permits");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES || isTimeBudgetExceeded(syncStartMs)) { hasMore = false; } else { offset += PAGE_SIZE; }
    }

    // Skip inline linking — deferred to dedicated cron: mode=link&source=chicago at 15:30 UTC.
    errors.push(`Chicago Permits: linking deferred to dedicated link cron (${totalAdded} rows synced)`);

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago Permits fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync Chicago RLTO Violations.
 * Chicago Open Data endpoint: xgbn-v72z (RLTO Violations)
 * Stores in chicago_rlto_violations table
 */
async function syncChicagoRLTO(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_rlto");
  const logId = await createSyncLog(supabase, "chicago_rlto");
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
      const url = buildChicagoSodaUrl(
        "awqx-tuwv",
        `violation_date > '${lastSync}'`,
        PAGE_SIZE,
        offset,
        "violation_date ASC"
      );

      const res = await fetch(url);
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

    // Skip inline linking — deferred to dedicated cron: mode=link&source=chicago at 15:30 UTC.
    errors.push(`Chicago RLTO: linking deferred to dedicated link cron (${totalAdded} rows synced)`);

    await finalizeSyncLog(supabase, logId, "completed", totalAdded, totalLinked, errors);
  } catch (err) {
    errors.push(`Chicago RLTO fatal error: ${String(err)}`);
    await finalizeSyncLog(supabase, logId, "failed", totalAdded, totalLinked, errors);
  }

  return { totalAdded, totalLinked, errors, affectedBuildingIds };
}

/**
 * Sync Chicago Lead Inspections.
 * Chicago Open Data endpoint: v2z5-jyrq (Lead Inspections)
 * Stores in chicago_lead_inspections table
 */
async function syncChicagoLead(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "chicago_lead");
  const logId = await createSyncLog(supabase, "chicago_lead");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  // NOTE: Chicago does not publish individual lead inspection records via SODA API.
  // Dataset v2z5-jyrq contains community-area-level screening stats, not addressable inspections.
  // This sync is disabled until an appropriate dataset is identified.
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, ["Chicago lead sync disabled: no individual inspection dataset available on data.cityofchicago.org"]);
  return { totalAdded: 0, totalLinked: 0, errors: ["Chicago lead sync disabled: no individual inspection dataset available"], affectedBuildingIds: new Set() };
}

// ---------------------------------------------------------------------------
// Miami Sync Functions — opendata.miamidade.gov SODA API
// ---------------------------------------------------------------------------

/** Build a SODA API URL for Miami-Dade Open Data portal. */
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

/** Parse a Miami address string into house_number + street_name. */
function parseMiamiAddress(addr: string | null | undefined): { house_number: string | null; street_name: string | null } {
  if (!addr) return { house_number: null, street_name: null };
  const trimmed = addr.trim();
  const match = trimmed.match(/^([0-9-]+)\s+(.+)/);
  if (match) return { house_number: match[1], street_name: match[2] };
  return { house_number: null, street_name: trimmed };
}

// Miami crime category mapping
const MIAMI_VIOLENT_CRIMES = new Set([
  "BATTERY", "ASSAULT", "ROBBERY", "HOMICIDE", "KIDNAPPING",
]);
const MIAMI_PROPERTY_CRIMES = new Set([
  "BURGLARY", "LARCENY", "THEFT", "VANDALISM",
]);

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

/**
 * Sync Miami-Dade Code Enforcement Violations.
 * Miami-Dade Open Data endpoint: abu5-gyuu (Code Enforcement Violations)
 * Stores in dob_violations with metro='miami'
 */
async function syncMiamiViolations(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildMiamiArcGISUrl(
        "CodeComplianceViolation_Open_View",
        cutoffMs > 0 ? `CASE_DATE > ${cutoffMs}` : `1=1`,
        PAGE_SIZE,
        offset,
        "CASE_DATE ASC"
      );

      const res = await fetch(url);
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
            violation_id: `MIA-${r.CASE_NUM}`,
            inspection_date: caseDate,
            nov_description: r.PROBLEM_DESC ? String(r.PROBLEM_DESC).trim() : null,
            status: r.STAT_DESC ? String(r.STAT_DESC).trim() : null,
            borough: "Miami-Dade",
            house_number: parsed.house_number,
            street_name: parsed.street_name,
            latitude: null,
            longitude: null,
            metro: "miami",
            imported_at: new Date().toISOString(),
          };
        });

      if (rows.length > 0) {
        totalAdded += await batchUpsert(supabase, "dob_violations", rows, "violation_id", errors, "Miami Violations");
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

/**
 * Sync Miami-Dade 311 Service Requests.
 * ArcGIS FeatureServer: 311_Service_Request (via data_311_2023)
 * Stores in complaints_311 with metro='miami'
 */
async function syncMiami311(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "miami_311");
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
      const cutoffMs = lastSync ? new Date(lastSync).getTime() : 0;
      const url = buildMiamiArcGISUrl(
        "data_311_2023",
        cutoffMs > 0 ? `OBJECTID > 0` : `OBJECTID > 0`,
        PAGE_SIZE,
        offset,
        "OBJECTID ASC"
      );

      const res = await fetch(url);
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

/**
 * Sync MDPD Crime Incidents.
 * MDPD crime data not yet available via ArcGIS API — disabled until source is identified.
 * Stores in nypd_complaints with metro='miami'
 */
async function syncMiamiCrimes(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "miami_crimes");
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  errors.push("Miami crimes sync: MDPD crime data not yet available via ArcGIS API");
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, errors);
  return { totalAdded: 0, totalLinked: 0, errors, affectedBuildingIds };
}

/**
 * Sync Miami-Dade Building Permits.
 * ArcGIS FeatureServer: BuildingPermit_gdb
 * Stores in dob_permits with metro='miami'
 */
async function syncMiamiPermits(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const cutoffMs = lastSync ? new Date(lastSync).getTime() : 0;
      const url = buildMiamiArcGISUrl(
        "BuildingPermit_gdb",
        cutoffMs > 0 ? `OBJECTID > 0` : `OBJECTID > 0`,
        PAGE_SIZE,
        offset,
        "OBJECTID ASC"
      );

      const res = await fetch(url);
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
          const parsed = parseMiamiAddress(r.ADDRESS as string | undefined ?? r.STNDADDR as string | undefined);
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

/**
 * Sync Miami-Dade Unsafe/Condemned Structures.
 * ArcGIS FeatureServer: Open_Building_Violations
 * Stores in miami_unsafe_structures table.
 */
async function syncMiamiUnsafeStructures(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
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
      const url = buildMiamiArcGISUrl(
        "Open_Building_Violations",
        cutoffMs > 0 ? `OPEN_DATE > ${cutoffMs}` : `1=1`,
        PAGE_SIZE,
        offset,
        "OPEN_DATE ASC"
      );

      const res = await fetch(url);
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

/**
 * Sync Miami-Dade 40-Year Building Recertification Data.
 * Data source not yet available via ArcGIS API — disabled until source is identified.
 * Stores in miami_forty_year_recerts table.
 */
async function syncMiamiRecertifications(
  supabase: ReturnType<typeof getSupabaseAdmin>
): Promise<SyncResult> {
  const logId = await createSyncLog(supabase, "miami_recerts");
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

  errors.push("Miami recertifications sync: data source not yet available via ArcGIS API");
  await finalizeSyncLog(supabase, logId, "completed", 0, 0, errors);
  return { totalAdded: 0, totalLinked: 0, errors, affectedBuildingIds };
}

// ---------------------------------------------------------------------------
// Max duration for Vercel serverless functions (Pro max=300s)
// ---------------------------------------------------------------------------
export const maxDuration = 300;

// Source registry — maps query param to sync function
// The optional second arg (sinceOverride) lets callers pass ?since=YYYY-MM-DD to backfill historical data.
const SOURCES: Record<string, (supabase: ReturnType<typeof getSupabaseAdmin>, sinceOverride?: string) => Promise<SyncResult>> = {
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
};

// ---------------------------------------------------------------------------
// Link-only tables — maps source name to the DB table + label used by linkByBbl
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

/**
 * Link-only mode: runs linkByBbl for all (or specific) tables without fetching
 * new data. Also handles 311 address-based linking with a generous time budget.
 */
async function runLinkOnly(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  sourceParam: string | null,
  startTime: number
): Promise<NextResponse> {
  const errors: string[] = [];
  const allAffectedIds = new Set<string>();
  const linkResults: Record<string, { linked: number; errors: string[] }> = {};
  const syncStartTime = new Date().toISOString();

  // Determine which tables to link
  const tablesToLink = sourceParam
    ? (LINK_TABLES[sourceParam] ? { [sourceParam]: LINK_TABLES[sourceParam] } : null)
    : LINK_TABLES;

  const LA_ADDR_SOURCES = ["lahd", "ladbs", "la-311", "la-permits", "la-evictions", "la-buyouts", "la-ccris", "la-violation-summary"];
  const CHICAGO_ADDR_SOURCES = ["chicago-violations", "chicago-311", "chicago-permits", "chicago-rlto", "chicago-lead"];
  const MIAMI_ADDR_SOURCES = ["miami-violations", "miami-311", "miami-permits", "miami-unsafe", "miami-recerts"];
  const isChicagoLink = sourceParam === "chicago" || (sourceParam && CHICAGO_ADDR_SOURCES.includes(sourceParam));
  const isMiamiLink = sourceParam === "miami" || (sourceParam && MIAMI_ADDR_SOURCES.includes(sourceParam));
  if (sourceParam && !tablesToLink && sourceParam !== "complaints" && !LA_ADDR_SOURCES.includes(sourceParam) && !isChicagoLink && !isMiamiLink) {
    return NextResponse.json(
      { error: `Unknown link source: ${sourceParam}. Valid: ${[...Object.keys(LINK_TABLES), "complaints", ...LA_ADDR_SOURCES, "chicago", ...CHICAGO_ADDR_SOURCES, "miami", ...MIAMI_ADDR_SOURCES].join(", ")}` },
      { status: 400 }
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

  // Link NYC 311 complaints by address using in-memory batch matching.
  // Same fast pattern as LA/Chicago: load NYC buildings once, normalize, match in bulk.
  if (!sourceParam || sourceParam === "complaints") {
    const complaintsErrors: string[] = [];
    let complaintsLinked = 0;
    try {
      // Load NYC buildings into memory for fast address matching
      const allBuildings: { id: string; full_address: string }[] = [];
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("buildings")
          .select("id, full_address")
          .eq("metro", "nyc")
          .range(offset, offset + 10000 - 1);
        if (!batch || batch.length === 0) break;
        allBuildings.push(...batch);
        if (batch.length < 10000) break;
        offset += 10000;
      }

      const nycBuildingAddrMap = new Map<string, string>();
      for (const b of allBuildings) {
        // Extract street portion (before first comma) and normalize
        const street = b.full_address.split(",")[0]?.trim() || "";
        const normalized = street.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
        if (normalized.length >= 5) {
          nycBuildingAddrMap.set(normalized, b.id);
        }
      }
      complaintsErrors.push(`Loaded ${allBuildings.length} NYC buildings, ${nycBuildingAddrMap.size} unique addresses`);

      if (nycBuildingAddrMap.size > 0) {
        // Find unlinked NYC 311 records from last 90 days
        const linkCutoff = new Date();
        linkCutoff.setDate(linkCutoff.getDate() - 90);

        let allUnlinked: { unique_key: string; incident_address: string }[] = [];
        let uOffset = 0;
        while (true) {
          const { data: batch, error: fetchErr } = await supabase
            .from("complaints_311")
            .select("unique_key, incident_address")
            .is("building_id", null)
            .eq("metro", "nyc")
            .not("incident_address", "is", null)
            .gte("imported_at", linkCutoff.toISOString())
            .range(uOffset, uOffset + 5000 - 1);
          if (fetchErr) {
            complaintsErrors.push(`NYC 311 fetch error: ${fetchErr.message}`);
            break;
          }
          if (!batch || batch.length === 0) break;
          allUnlinked = allUnlinked.concat(batch as { unique_key: string; incident_address: string }[]);
          if (batch.length < 5000) break;
          uOffset += 5000;
        }

        if (allUnlinked.length > 0) {
          // Group by normalized address
          const addrToKeys = new Map<string, string[]>();
          for (const r of allUnlinked) {
            const normalized = (r.incident_address as string)
              .trim().toUpperCase()
              .replace(/[.,#]/g, "")
              .replace(/\s+/g, " ")
              .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "")
              .trim();
            if (normalized.length < 5) continue;
            if (!addrToKeys.has(normalized)) addrToKeys.set(normalized, []);
            addrToKeys.get(normalized)!.push(r.unique_key);
          }

          let matched = 0;
          let unmatched = 0;
          for (const [addr, uniqueKeys] of addrToKeys) {
            if ((Date.now() - startTime) / 1000 > 250) {
              complaintsErrors.push(`311 linking stopped at time budget (${matched} matched, ${unmatched} unmatched so far)`);
              break;
            }

            const buildingId = nycBuildingAddrMap.get(addr);
            if (!buildingId) { unmatched++; continue; }
            matched++;

            for (let i = 0; i < uniqueKeys.length; i += 500) {
              const keyBatch = uniqueKeys.slice(i, i + 500);
              const { error: linkError } = await supabase
                .from("complaints_311")
                .update({ building_id: buildingId })
                .in("unique_key", keyBatch);

              if (!linkError) {
                complaintsLinked += keyBatch.length;
              } else {
                complaintsErrors.push(`311 link error (${addr}): ${linkError.message}`);
              }
            }
            allAffectedIds.add(buildingId);
          }
          complaintsErrors.push(`NYC 311: ${allUnlinked.length} unlinked, ${matched} addresses matched, ${unmatched} unmatched`);
        } else {
          complaintsErrors.push(`NYC 311: no unlinked records found`);
        }
      }
    } catch (err) {
      complaintsErrors.push(`311 link error: ${String(err)}`);
    }
    linkResults["complaints"] = { linked: complaintsLinked, errors: complaintsErrors };
  }

  // Link LA records by address using in-memory batch matching.
  // Load LA buildings once, then match all unlinked records locally (fast).
  const laAddrTables: { name: string; table: string; idColumn: string; addressColumns: string[]; label: string }[] = [
    { name: "lahd", table: "hpd_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "LAHD" },
    { name: "ladbs", table: "dob_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "LADBS" },
    { name: "la-311", table: "complaints_311", idColumn: "unique_key", addressColumns: ["incident_address"], label: "LA311" },
    { name: "la-permits", table: "dob_permits", idColumn: "id", addressColumns: ["house_no", "street_name"], label: "LA Permits" },
    { name: "la-evictions", table: "lahd_evictions", idColumn: "id", addressColumns: ["address"], label: "LAHD Evictions" },
    { name: "la-buyouts", table: "lahd_tenant_buyouts", idColumn: "id", addressColumns: ["address"], label: "LAHD Buyouts" },
    { name: "la-ccris", table: "lahd_ccris_cases", idColumn: "id", addressColumns: ["address"], label: "LAHD CCRIS" },
    { name: "la-violation-summary", table: "lahd_violation_summary", idColumn: "id", addressColumns: ["address"], label: "LAHD ViolSummary" },
  ];

  const shouldLinkLA = laAddrTables.some(t => !sourceParam || sourceParam === t.name);
  if (shouldLinkLA && (Date.now() - startTime) / 1000 < 200) {
    // Load all LA buildings into an in-memory address map (one query, ~30MB for 278K rows)
    const laErrors: string[] = [];
    let buildingAddrMap: Map<string, string> | null = null;
    try {
      const allBuildings: { id: string; full_address: string }[] = [];
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("buildings")
          .select("id, full_address")
          .eq("metro", "los-angeles")
          .range(offset, offset + 10000 - 1);
        if (!batch || batch.length === 0) break;
        allBuildings.push(...batch);
        if (batch.length < 10000) break;
        offset += 10000;
      }

      // Build normalized address → building_id map
      // Key is the street portion before ", Los Angeles" normalized
      buildingAddrMap = new Map<string, string>();
      for (const b of allBuildings) {
        const street = b.full_address.split(",")[0]?.trim() || "";
        const normalized = street.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
        if (normalized.length >= 5) {
          buildingAddrMap.set(normalized, b.id);
        }
      }
      laErrors.push(`Loaded ${allBuildings.length} LA buildings, ${buildingAddrMap.size} unique addresses`);
    } catch (err) {
      laErrors.push(`Failed to load LA buildings: ${String(err)}`);
    }

    if (buildingAddrMap && buildingAddrMap.size > 0) {
      const linkCutoff = new Date();
      linkCutoff.setDate(linkCutoff.getDate() - 30);

      for (const { name, table, idColumn, addressColumns, label } of laAddrTables) {
        if (sourceParam && sourceParam !== name) continue;
        if ((Date.now() - startTime) / 1000 > 260) break;

        const tableErrors: string[] = [...laErrors];
        let tableLinked = 0;
        try {
          // Fetch unlinked LA records
          const cols = [idColumn, ...addressColumns].join(", ");
          const primaryCol = addressColumns[addressColumns.length - 1];
          let allUnlinked: Record<string, unknown>[] = [];
          let offset = 0;
          while (true) {
            const { data: batch } = await supabase
              .from(table)
              .select(cols)
              .is("building_id", null)
              .eq("metro", "los-angeles")
              .not(primaryCol, "is", null)
              .gte("imported_at", linkCutoff.toISOString())
              .range(offset, offset + 5000 - 1);
            if (!batch || batch.length === 0) break;
            allUnlinked = allUnlinked.concat(batch as unknown as Record<string, unknown>[]);
            if (batch.length < 5000) break;
            offset += 5000;
          }

          if (allUnlinked.length === 0) {
            tableErrors.push(`${label}: no unlinked records found`);
            linkResults[name] = { linked: 0, errors: tableErrors };
            continue;
          }

          // Group by normalized address
          const addrToIds = new Map<string, string[]>();
          for (const r of allUnlinked) {
            let raw: string;
            if (addressColumns.length > 1) {
              raw = addressColumns.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
            } else {
              raw = String(r[addressColumns[0]] || "").trim();
            }
            const normalized = raw.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ")
              .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
            if (normalized.length < 5) continue;
            if (!addrToIds.has(normalized)) addrToIds.set(normalized, []);
            addrToIds.get(normalized)!.push(String(r[idColumn]));
          }

          // Match in-memory
          let matched = 0;
          let unmatched = 0;
          for (const [addr, recordIds] of addrToIds) {
            const buildingId = buildingAddrMap.get(addr);
            if (!buildingId) { unmatched++; continue; }
            matched++;

            for (let i = 0; i < recordIds.length; i += 200) {
              const batch = recordIds.slice(i, i + 200);
              const { error: linkError } = await supabase
                .from(table)
                .update({ building_id: buildingId })
                .in(idColumn, batch);

              if (!linkError) {
                tableLinked += batch.length;
              } else {
                tableErrors.push(`${label} link error: ${linkError.message}`);
              }
            }
            allAffectedIds.add(buildingId);
          }
          tableErrors.push(`${label}: ${allUnlinked.length} unlinked, ${matched} addresses matched, ${unmatched} unmatched`);
        } catch (err) {
          tableErrors.push(`${label} LA link error: ${String(err)}`);
        }

        const existing = linkResults[name];
        linkResults[name] = {
          linked: (existing?.linked ?? 0) + tableLinked,
          errors: [...(existing?.errors ?? []), ...tableErrors],
        };
      }
    }
  }

  // Link Chicago records by address using in-memory batch matching.
  // Same pattern as LA: load Chicago buildings once, then match locally.
  const chicagoAddrTables: { name: string; table: string; idColumn: string; addressColumns: string[]; label: string }[] = [
    { name: "chicago-violations", table: "dob_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Chicago Violations" },
    { name: "chicago-311", table: "complaints_311", idColumn: "unique_key", addressColumns: ["incident_address"], label: "Chicago 311" },
    { name: "chicago-permits", table: "dob_permits", idColumn: "id", addressColumns: ["house_no", "street_name"], label: "Chicago Permits" },
    { name: "chicago-rlto", table: "chicago_rlto_violations", idColumn: "id", addressColumns: ["address"], label: "Chicago RLTO" },
    { name: "chicago-lead", table: "chicago_lead_inspections", idColumn: "id", addressColumns: ["address"], label: "Chicago Lead" },
  ];

  const shouldLinkChicago = chicagoAddrTables.some(t => sourceParam === "chicago" || sourceParam === t.name) || !sourceParam;
  if (shouldLinkChicago && (Date.now() - startTime) / 1000 < 200) {
    const chiErrors: string[] = [];
    let chicagoBuildingAddrMap: Map<string, string> | null = null;
    try {
      const allBuildings: { id: string; full_address: string }[] = [];
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("buildings")
          .select("id, full_address")
          .eq("metro", "chicago")
          .range(offset, offset + 10000 - 1);
        if (!batch || batch.length === 0) break;
        allBuildings.push(...batch);
        if (batch.length < 10000) break;
        offset += 10000;
      }

      chicagoBuildingAddrMap = new Map<string, string>();
      for (const b of allBuildings) {
        const street = b.full_address.split(",")[0]?.trim() || "";
        const normalized = street.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
        if (normalized.length >= 5) {
          chicagoBuildingAddrMap.set(normalized, b.id);
        }
      }
      chiErrors.push(`Loaded ${allBuildings.length} Chicago buildings, ${chicagoBuildingAddrMap.size} unique addresses`);
    } catch (err) {
      chiErrors.push(`Failed to load Chicago buildings: ${String(err)}`);
    }

    if (chicagoBuildingAddrMap && chicagoBuildingAddrMap.size > 0) {
      const linkCutoff = new Date();
      linkCutoff.setDate(linkCutoff.getDate() - 30);

      for (const { name, table, idColumn, addressColumns, label } of chicagoAddrTables) {
        if (sourceParam && sourceParam !== "chicago" && sourceParam !== name) continue;
        if ((Date.now() - startTime) / 1000 > 260) break;

        const tableErrors: string[] = [...chiErrors];
        let tableLinked = 0;
        try {
          const cols = [idColumn, ...addressColumns, "latitude", "longitude"].join(", ");
          const primaryCol = addressColumns[addressColumns.length - 1];
          let allUnlinked: Record<string, unknown>[] = [];
          let offset = 0;
          while (true) {
            const { data: batch } = await supabase
              .from(table)
              .select(cols)
              .is("building_id", null)
              .eq("metro", "chicago")
              .not(primaryCol, "is", null)
              .gte("imported_at", linkCutoff.toISOString())
              .range(offset, offset + 5000 - 1);
            if (!batch || batch.length === 0) break;
            allUnlinked = allUnlinked.concat(batch as unknown as Record<string, unknown>[]);
            if (batch.length < 5000) break;
            offset += 5000;
          }

          if (allUnlinked.length === 0) {
            tableErrors.push(`${label}: no unlinked records found`);
            linkResults[name] = { linked: 0, errors: tableErrors };
            continue;
          }

          // Build address -> record IDs map, also track first lat/lng per address for auto-creation
          const addrToIds = new Map<string, string[]>();
          const addrToCoords = new Map<string, { lat: number; lng: number }>();
          for (const r of allUnlinked) {
            let raw: string;
            if (addressColumns.length > 1) {
              raw = addressColumns.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
            } else {
              raw = String(r[addressColumns[0]] || "").trim();
            }
            const normalized = raw.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ")
              .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
            if (normalized.length < 5) continue;
            if (!addrToIds.has(normalized)) addrToIds.set(normalized, []);
            addrToIds.get(normalized)!.push(String(r[idColumn]));
            // Store first available coordinates for this address
            if (!addrToCoords.has(normalized) && r.latitude && r.longitude) {
              addrToCoords.set(normalized, { lat: parseFloat(String(r.latitude)), lng: parseFloat(String(r.longitude)) });
            }
          }

          let matched = 0;
          let unmatched = 0;
          let autoCreated = 0;
          for (const [addr, recordIds] of addrToIds) {
            let buildingId = chicagoBuildingAddrMap.get(addr);

            // Auto-create building if not found
            if (!buildingId) {
              const parts = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
              const houseNum = parts ? parts[1] : "";
              const streetName = parts ? parts[2] : addr;
              const fullAddr = `${addr}, CHICAGO, IL`;
              const slug = generateBuildingSlug(fullAddr);
              const coords = addrToCoords.get(addr);

              const { data: newBuilding, error: createErr } = await supabase
                .from("buildings")
                .insert({
                  full_address: fullAddr,
                  house_number: houseNum,
                  street_name: streetName,
                  city: "Chicago",
                  state: "IL",
                  metro: "chicago",
                  slug,
                  latitude: coords?.lat ?? null,
                  longitude: coords?.lng ?? null,
                  violation_count: 0,
                  complaint_count: 0,
                  review_count: 0,
                  overall_score: null,
                })
                .select("id")
                .single();

              if (createErr) {
                // Likely duplicate slug — try to fetch existing
                if (createErr.code === "23505") {
                  const { data: existing } = await supabase
                    .from("buildings")
                    .select("id")
                    .eq("slug", slug)
                    .eq("metro", "chicago")
                    .single();
                  if (existing) buildingId = existing.id;
                }
                if (!buildingId) { unmatched++; continue; }
              } else if (newBuilding?.id) {
                buildingId = newBuilding.id;
                autoCreated++;
                // Add to map so subsequent tables can match without re-creating
                chicagoBuildingAddrMap.set(addr, newBuilding.id);
              }
            }

            matched++;

            for (let i = 0; i < recordIds.length; i += 200) {
              const batch = recordIds.slice(i, i + 200);
              const { error: linkError } = await supabase
                .from(table)
                .update({ building_id: buildingId })
                .in(idColumn, batch);

              if (!linkError) {
                tableLinked += batch.length;
              } else {
                tableErrors.push(`${label} link error: ${linkError.message}`);
              }
            }
            allAffectedIds.add(buildingId!);
          }
          tableErrors.push(`${label}: ${allUnlinked.length} unlinked, ${matched} matched, ${unmatched} unmatched, ${autoCreated} buildings auto-created`);
        } catch (err) {
          tableErrors.push(`${label} Chicago link error: ${String(err)}`);
        }

        const existing = linkResults[name];
        linkResults[name] = {
          linked: (existing?.linked ?? 0) + tableLinked,
          errors: [...(existing?.errors ?? []), ...tableErrors],
        };
      }
    }
  }

  // Link Miami records by address using in-memory batch matching.
  // Same pattern as Chicago: load Miami buildings once, then match locally.
  const miamiAddrTables: { name: string; table: string; idColumn: string; addressColumns: string[]; label: string }[] = [
    { name: "miami-violations", table: "dob_violations", idColumn: "id", addressColumns: ["house_number", "street_name"], label: "Miami Violations" },
    { name: "miami-311", table: "complaints_311", idColumn: "unique_key", addressColumns: ["incident_address"], label: "Miami 311" },
    { name: "miami-permits", table: "dob_permits", idColumn: "id", addressColumns: ["house_no", "street_name"], label: "Miami Permits" },
    { name: "miami-unsafe", table: "miami_unsafe_structures", idColumn: "id", addressColumns: ["address"], label: "Miami Unsafe" },
    { name: "miami-recerts", table: "miami_forty_year_recerts", idColumn: "id", addressColumns: ["address"], label: "Miami Recerts" },
  ];

  const shouldLinkMiami = miamiAddrTables.some(t => sourceParam === "miami" || sourceParam === t.name) || !sourceParam;
  if (shouldLinkMiami && (Date.now() - startTime) / 1000 < 200) {
    const miaErrors: string[] = [];
    let miamiBuildingAddrMap: Map<string, string> | null = null;
    try {
      const allBuildings: { id: string; full_address: string }[] = [];
      let offset = 0;
      while (true) {
        const { data: batch } = await supabase
          .from("buildings")
          .select("id, full_address")
          .eq("metro", "miami")
          .range(offset, offset + 10000 - 1);
        if (!batch || batch.length === 0) break;
        allBuildings.push(...batch);
        if (batch.length < 10000) break;
        offset += 10000;
      }

      miamiBuildingAddrMap = new Map<string, string>();
      for (const b of allBuildings) {
        const street = b.full_address.split(",")[0]?.trim() || "";
        const normalized = street.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ").trim();
        if (normalized.length >= 5) {
          miamiBuildingAddrMap.set(normalized, b.id);
        }
      }
      miaErrors.push(`Loaded ${allBuildings.length} Miami buildings, ${miamiBuildingAddrMap.size} unique addresses`);
    } catch (err) {
      miaErrors.push(`Failed to load Miami buildings: ${String(err)}`);
    }

    if (miamiBuildingAddrMap && miamiBuildingAddrMap.size > 0) {
      const linkCutoff = new Date();
      linkCutoff.setDate(linkCutoff.getDate() - 30);

      for (const { name, table, idColumn, addressColumns, label } of miamiAddrTables) {
        if (sourceParam && sourceParam !== "miami" && sourceParam !== name) continue;
        if ((Date.now() - startTime) / 1000 > 260) break;

        const tableErrors: string[] = [...miaErrors];
        let tableLinked = 0;
        try {
          const cols = [idColumn, ...addressColumns, "latitude", "longitude"].join(", ");
          const primaryCol = addressColumns[addressColumns.length - 1];
          let allUnlinked: Record<string, unknown>[] = [];
          let offset = 0;
          while (true) {
            const { data: batch } = await supabase
              .from(table)
              .select(cols)
              .is("building_id", null)
              .eq("metro", "miami")
              .not(primaryCol, "is", null)
              .gte("imported_at", linkCutoff.toISOString())
              .range(offset, offset + 5000 - 1);
            if (!batch || batch.length === 0) break;
            allUnlinked = allUnlinked.concat(batch as unknown as Record<string, unknown>[]);
            if (batch.length < 5000) break;
            offset += 5000;
          }

          if (allUnlinked.length === 0) {
            tableErrors.push(`${label}: no unlinked records found`);
            linkResults[name] = { linked: 0, errors: tableErrors };
            continue;
          }

          // Build address -> record IDs map, also track first lat/lng per address for auto-creation
          const addrToIds = new Map<string, string[]>();
          const addrToCoords = new Map<string, { lat: number; lng: number }>();
          for (const r of allUnlinked) {
            let raw: string;
            if (addressColumns.length > 1) {
              raw = addressColumns.map(c => String(r[c] || "").trim()).filter(Boolean).join(" ");
            } else {
              raw = String(r[addressColumns[0]] || "").trim();
            }
            const normalized = raw.toUpperCase().replace(/[.,#]/g, "").replace(/\s+/g, " ")
              .replace(/\s+(APT|UNIT|#|FL|FLOOR|STE|SUITE|RM|ROOM)\b.*$/i, "").trim();
            if (normalized.length < 5) continue;
            if (!addrToIds.has(normalized)) addrToIds.set(normalized, []);
            addrToIds.get(normalized)!.push(String(r[idColumn]));
            // Store first available coordinates for this address
            if (!addrToCoords.has(normalized) && r.latitude && r.longitude) {
              addrToCoords.set(normalized, { lat: parseFloat(String(r.latitude)), lng: parseFloat(String(r.longitude)) });
            }
          }

          let matched = 0;
          let unmatched = 0;
          let autoCreated = 0;
          for (const [addr, recordIds] of addrToIds) {
            let buildingId = miamiBuildingAddrMap.get(addr);

            // Auto-create building if not found
            if (!buildingId) {
              const parts = addr.match(/^(\d+[-\d]*)\s+(.+)$/);
              const houseNum = parts ? parts[1] : "";
              const streetName = parts ? parts[2] : addr;
              const fullAddr = `${addr}, MIAMI, FL`;
              const slug = generateBuildingSlug(fullAddr);
              const coords = addrToCoords.get(addr);

              const { data: newBuilding, error: createErr } = await supabase
                .from("buildings")
                .insert({
                  full_address: fullAddr,
                  house_number: houseNum,
                  street_name: streetName,
                  city: "Miami",
                  state: "FL",
                  metro: "miami",
                  slug,
                  latitude: coords?.lat ?? null,
                  longitude: coords?.lng ?? null,
                  violation_count: 0,
                  complaint_count: 0,
                  review_count: 0,
                  overall_score: null,
                })
                .select("id")
                .single();

              if (createErr) {
                // Likely duplicate slug — try to fetch existing
                if (createErr.code === "23505") {
                  const { data: existing } = await supabase
                    .from("buildings")
                    .select("id")
                    .eq("slug", slug)
                    .eq("metro", "miami")
                    .single();
                  if (existing) buildingId = existing.id;
                }
                if (!buildingId) { unmatched++; continue; }
              } else if (newBuilding?.id) {
                buildingId = newBuilding.id;
                autoCreated++;
                // Add to map so subsequent tables can match without re-creating
                miamiBuildingAddrMap.set(addr, newBuilding.id);
              }
            }

            matched++;

            for (let i = 0; i < recordIds.length; i += 200) {
              const batch = recordIds.slice(i, i + 200);
              const { error: linkError } = await supabase
                .from(table)
                .update({ building_id: buildingId })
                .in(idColumn, batch);

              if (!linkError) {
                tableLinked += batch.length;
              } else {
                tableErrors.push(`${label} link error: ${linkError.message}`);
              }
            }
            allAffectedIds.add(buildingId!);
          }
          tableErrors.push(`${label}: ${allUnlinked.length} unlinked, ${matched} matched, ${unmatched} unmatched, ${autoCreated} buildings auto-created`);
        } catch (err) {
          tableErrors.push(`${label} Miami link error: ${String(err)}`);
        }

        const existing = linkResults[name];
        linkResults[name] = {
          linked: (existing?.linked ?? 0) + tableLinked,
          errors: [...(existing?.errors ?? []), ...tableErrors],
        };
      }
    }
  }

  // Update building counts for all affected buildings
  let countErrors: string[] = [];
  if (allAffectedIds.size > 0 && (Date.now() - startTime) / 1000 < 260) {
    countErrors = await updateBuildingCounts(supabase, allAffectedIds);
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

  // Log link run to sync_log for monitoring
  const totalLinked = Object.values(linkResults).reduce((sum, r) => sum + r.linked, 0);
  const allErrors = [
    ...errors,
    ...countErrors,
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

  return NextResponse.json({
    success: true,
    mode: "link",
    source: sourceParam || "all",
    duration_seconds: parseFloat(elapsed),
    buildings_updated: allAffectedIds.size,
    slugs_backfilled: slugsBackfilled,
    building_count_errors: countErrors,
    link_results: linkResults,
    errors,
  });
}

// ---------------------------------------------------------------------------
// GET handler -- works as both Vercel cron and manual trigger
// Use ?source=hpd|complaints|litigations|dob|nypd|bedbugs|evictions to sync one source at a time.
// Use ?mode=link to run linking only (no data fetching).
// Omit source param to run all (may timeout on Hobby plan).
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // ---- Auth check ----
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const sourceParam = searchParams.get("source");
  const mode = searchParams.get("mode"); // "link" = link-only, null = full sync
  const sinceParam = searchParams.get("since"); // optional: override start date e.g. ?since=2024-01-01
  const sinceOverride = sinceParam ? toSodaDate(new Date(sinceParam).toISOString()) : undefined;

  try {
    const supabase = getSupabaseAdmin();

    // Clean up any zombie "running" sync_log entries from previous timeouts
    const staleCleaned = await cleanupStaleSyncs(supabase);

    // --- Link-only mode: skip data fetching, just run BBL/address matching ---
    if (mode === "link") {
      return runLinkOnly(supabase, sourceParam, startTime);
    }

    // Determine which sources to sync
    let sourcesToRun: [string, (supabase: ReturnType<typeof getSupabaseAdmin>, sinceOverride?: string) => Promise<SyncResult>][];

    if (sourceParam) {
      const fn = SOURCES[sourceParam];
      if (!fn) {
        return NextResponse.json(
          { error: `Unknown source: ${sourceParam}. Valid: ${Object.keys(SOURCES).join(", ")}` },
          { status: 400 }
        );
      }
      sourcesToRun = [[sourceParam, fn]];
    } else {
      sourcesToRun = Object.entries(SOURCES);
    }

    // Run selected syncs (sequentially when running all to avoid timeout)
    const results: Record<string, SyncResult> = {};
    const allAffectedIds = new Set<string>();

    for (const [name, syncFn] of sourcesToRun) {
      const result = await syncFn(supabase, sinceOverride);
      results[name] = result;
      for (const id of result.affectedBuildingIds) {
        allAffectedIds.add(id);
      }
    }

    // Update aggregate counts only for affected buildings (skip if running low on time)
    let countErrors: string[] = [];
    const elapsedAfterSync = (Date.now() - startTime) / 1000;
    if (elapsedAfterSync < 250) {
      countErrors = await updateBuildingCounts(supabase, allAffectedIds);
    } else if (allAffectedIds.size > 0) {
      countErrors.push(`Skipped building count update (${elapsedAfterSync.toFixed(1)}s elapsed, ${allAffectedIds.size} buildings)`);
    }

    // Backfill slugs for any buildings missing them (skip if running low on time)
    let slugsBackfilled = 0;
    if ((Date.now() - startTime) / 1000 < 270) {
      try {
        const { data: noSlugs } = await supabase
          .from("buildings")
          .select("id, full_address")
          .is("slug", null)
          .limit(500);

        if (noSlugs && noSlugs.length > 0) {
          for (const b of noSlugs) {
            const slug = generateBuildingSlug(b.full_address);
            await supabase
              .from("buildings")
              .update({ slug })
              .eq("id", b.id);
          }
          slugsBackfilled = noSlugs.length;
        }
      } catch (slugErr) {
        countErrors.push(`Slug backfill error: ${String(slugErr)}`);
      }
    }

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
    };

    for (const [name, result] of Object.entries(results)) {
      response[name] = {
        records_added: result.totalAdded,
        records_linked: result.totalLinked,
        errors: result.errors,
      };
    }

    return NextResponse.json(response);
  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error("Cron sync error:", err);

    return NextResponse.json(
      {
        success: false,
        duration_seconds: parseFloat(elapsed),
        error: String(err),
      },
      { status: 500 }
    );
  }
}
