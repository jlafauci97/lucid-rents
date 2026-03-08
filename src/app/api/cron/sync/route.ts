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
const MAX_PAGES = 4; // Safety limit: max API pages per sync (prevents 60s timeout)
const STALE_SYNC_MINUTES = 5; // Mark "running" syncs older than this as "failed"

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
  return normalized;
}

/** Upsert rows in batches to avoid payload size limits. */
async function batchUpsert(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  errors: string[],
  label: string
): Promise<number> {
  let totalCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error: upsertError, count } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false, count: "exact" });

    if (upsertError) {
      errors.push(`${label} upsert error (batch ${i}): ${upsertError.message}`);
    } else {
      totalCount += count ?? batch.length;
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
    // Subtract 3 days from last sync time to account for data publishing lag.
    // NYC Open Data may update records a few days after the date they occurred.
    // The upsert with onConflict ensures re-fetched records don't create duplicates.
    // Truncate to start-of-day since SODA dates are at midnight (T00:00:00).
    const syncDate = new Date(data.completed_at);
    syncDate.setDate(syncDate.getDate() - 3);
    syncDate.setUTCHours(0, 0, 0, 0);
    return toSodaDate(syncDate.toISOString());
  }

  // Default: 3 days ago (keeps initial sync small enough for 60s limit)
  const d = new Date();
  d.setDate(d.getDate() - 3);
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

/** Link records by BBL and return set of affected building IDs. */
async function linkByBbl(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  table: string,
  syncStartTime: string,
  errors: string[],
  label: string
): Promise<{ linked: number; affectedBuildingIds: Set<string> }> {
  let linked = 0;
  const affectedBuildingIds = new Set<string>();

  const { data: unlinked } = await supabase
    .from(table)
    .select("id, bbl")
    .is("building_id", null)
    .not("bbl", "is", null)
    .gte("imported_at", syncStartTime)
    .limit(50000);

  if (!unlinked || unlinked.length === 0) return { linked, affectedBuildingIds };

  const bblSet = [...new Set(unlinked.map((r) => r.bbl).filter(Boolean))] as string[];

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
    const { error: linkError } = await supabase
      .from(table)
      .update({ building_id: buildingId })
      .in("id", recordIds);

    if (!linkError) {
      linked += recordIds.length;
      affectedBuildingIds.add(buildingId);
    } else {
      errors.push(`${label} link error (building ${buildingId}): ${linkError.message}`);
    }
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

async function syncHPDViolations(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<SyncResult> {
  const lastSync = await getLastSyncDate(supabase, "hpd_violations");
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
        .map((r) => ({
          violation_id: String(r.violationid),
          bbl: r.bbl || null,
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
        }));

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
      const linkResult = await linkByBbl(supabase, "hpd_violations", syncStartTime, errors, "HPD");
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
  const lastSync = await getLastSyncDate(supabase, "complaints_311");
  const logId = await createSyncLog(supabase, "complaints_311");
  const syncStartTime = new Date().toISOString();

  let totalAdded = 0;
  let totalLinked = 0;
  const errors: string[] = [];
  const affectedBuildingIds = new Set<string>();

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
        PAGE_SIZE,
        offset,
        "created_date ASC"
      );

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
        totalAdded += await batchUpsert(supabase, "complaints_311", rows, "unique_key", errors, "311");
      }

      pagesFetched++;
      if (records.length < PAGE_SIZE || pagesFetched >= MAX_PAGES) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }

    // Linking: match by address using in-memory data (avoids slow imported_at query)
    try {
      let lookupCount = 0;
      const MAX_LOOKUPS = 50;

      for (const [address, uniqueKeys] of addressToKeys) {
        if (lookupCount >= MAX_LOOKUPS) break;
        lookupCount++;

        const { data: matchedBuildings } = await supabase
          .from("buildings")
          .select("id")
          .ilike("full_address", `%${address}%`)
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
          case_open_date: r.caseopendate ? r.caseopendate.slice(0, 10) : null,
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
      const linkResult = await linkByBbl(supabase, "hpd_litigations", syncStartTime, errors, "HPD Litigations");
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
            const block = r.block.padStart(5, "0").slice(-5);
            const lot = r.lot.padStart(4, "0").slice(-4);
            bbl = `${r.boro}${block}${lot}`;
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
      const linkResult = await linkByBbl(supabase, "dob_violations", syncStartTime, errors, "DOB");
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
  // For initial sync, use 1 year lookback (NYPD data may lag behind current date)
  const { data: lastSyncData } = await supabase
    .from("sync_log")
    .select("completed_at")
    .eq("sync_type", "nypd_complaints")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .single();

  let lastSync: string;
  if (lastSyncData?.completed_at) {
    // Subtract 3 days for data publishing lag (same as getLastSyncDate)
    const syncDate = new Date(lastSyncData.completed_at);
    syncDate.setDate(syncDate.getDate() - 3);
    syncDate.setUTCHours(0, 0, 0, 0);
    lastSync = toSodaDate(syncDate.toISOString());
  } else {
    // First sync: go back 3 days (keeps within 60s function limit)
    const d = new Date();
    d.setDate(d.getDate() - 3);
    lastSync = toSodaDate(d.toISOString());
  }

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
      const { error: zipErr } = await supabase.rpc("backfill_crime_zip_codes");
      if (zipErr) {
        errors.push(`NYPD zip backfill error: ${zipErr.message}`);
      }
    } catch (zipBackfillErr) {
      errors.push(`NYPD zip backfill fatal: ${String(zipBackfillErr)}`);
    }

    // No BBL linking for crimes — they're area-based, matched by zip code.
    // Instead, update crime_count on buildings that share a zip code with new crimes.
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

        // For each zip, count crimes in last 12 months and update buildings
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const sinceDate = oneYearAgo.toISOString().slice(0, 10);

        for (const zip of uniqueZips) {
          // Count crimes in this zip for last 12 months
          const { count: crimeCount } = await supabase
            .from("nypd_complaints")
            .select("id", { count: "exact", head: true })
            .eq("zip_code", zip)
            .gte("cmplnt_date", sinceDate);

          // Update all buildings in this zip
          const { data: buildingsInZip } = await supabase
            .from("buildings")
            .select("id")
            .eq("zip_code", zip);

          if (buildingsInZip && buildingsInZip.length > 0) {
            for (const b of buildingsInZip) {
              await supabase
                .from("buildings")
                .update({ crime_count: crimeCount ?? 0 })
                .eq("id", b.id);
              affectedBuildingIds.add(b.id);
            }
          }
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
// Update building counts — only for affected buildings
// ---------------------------------------------------------------------------
async function updateBuildingCounts(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  affectedBuildingIds: Set<string>
) {
  const errors: string[] = [];

  if (affectedBuildingIds.size === 0) return errors;

  const buildingIds = [...affectedBuildingIds];

  const countTasks: { table: string; column: string }[] = [
    { table: "hpd_violations", column: "violation_count" },
    { table: "complaints_311", column: "complaint_count" },
    { table: "hpd_litigations", column: "litigation_count" },
    { table: "dob_violations", column: "dob_violation_count" },
  ];

  for (const { table, column } of countTasks) {
    try {
      for (const bid of buildingIds) {
        const { count } = await supabase
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("building_id", bid);

        await supabase
          .from("buildings")
          .update({ [column]: count ?? 0 })
          .eq("id", bid);
      }
    } catch (err) {
      errors.push(`Update ${column} error: ${String(err)}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Max duration for Vercel serverless functions (Hobby=60s)
// ---------------------------------------------------------------------------
export const maxDuration = 60;

// Source registry — maps query param to sync function
const SOURCES: Record<string, (supabase: ReturnType<typeof getSupabaseAdmin>) => Promise<SyncResult>> = {
  hpd: syncHPDViolations,
  complaints: sync311Complaints,
  litigations: syncHPDLitigations,
  dob: syncDOBViolations,
  nypd: syncNYPDComplaints,
};

// ---------------------------------------------------------------------------
// GET handler -- works as both Vercel cron and manual trigger
// Use ?source=hpd|complaints|litigations|dob|nypd to sync one source at a time.
// Omit source param to run all (may timeout on Hobby plan).
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  // ---- Auth check ----
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const { searchParams } = new URL(req.url);
  const sourceParam = searchParams.get("source");

  try {
    const supabase = getSupabaseAdmin();

    // Clean up any zombie "running" sync_log entries from previous timeouts
    const staleCleaned = await cleanupStaleSyncs(supabase);

    // Determine which sources to sync
    let sourcesToRun: [string, (supabase: ReturnType<typeof getSupabaseAdmin>) => Promise<SyncResult>][];

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
      const result = await syncFn(supabase);
      results[name] = result;
      for (const id of result.affectedBuildingIds) {
        allAffectedIds.add(id);
      }
    }

    // Update aggregate counts only for affected buildings
    const countErrors = await updateBuildingCounts(supabase, allAffectedIds);

    // Backfill slugs for any buildings missing them
    let slugsBackfilled = 0;
    try {
      const { data: noSlugs } = await supabase
        .from("buildings")
        .select("id, full_address")
        .is("slug", null)
        .limit(5000);

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

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Build response
    const response: Record<string, unknown> = {
      success: true,
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
