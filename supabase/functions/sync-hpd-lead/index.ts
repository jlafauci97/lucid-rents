import { getSupabaseAdmin } from "shared/supabase-admin.ts";

/**
 * HPD lead-paint violations (NYC Local Law 1) — SODA dataset au8t-hgv2.
 *
 * Why this is a standalone function rather than a source in the big `sync`
 * function: the `hpd_lead_violations` table was originally filled by a one-off
 * import and stopped on 2026-03-09. There was never a handler in the sync
 * registry, so no cron could reach it. Adding one there would mean redeploying
 * a 4,400-line function; this is self-contained and cheap to deploy instead.
 *
 * Dispatched via /api/cron/trigger?source=sync-hpd-lead (STANDALONE_FUNCTIONS).
 */

const SODA_URL = "https://data.cityofnewyork.us/resource/au8t-hgv2.json";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;
/**
 * Pages per invocation. Edge functions are killed at a 150s idle timeout, so a
 * run has to stay bounded. 3 pages ≈ 15K rows finishes comfortably inside it.
 *
 * NOTE: the upstream dataset is RETIRED — au8t-hgv2 stops at 2020-01-07 with
 * 29,416 rows total and has had zero new records for years. This sync exists to
 * complete and hold the historical set, not to pull anything new. The cron runs
 * weekly rather than daily for that reason; if NYC ever republishes, it picks
 * back up automatically.
 */
const MAX_PAGES = 3;

interface SodaRow {
  violationid?: string;
  bbl?: string;
  bin?: string;
  ordernumber?: string;
  novdescription?: string;
  violationstatus?: string;
  currentstatus?: string;
  inspectiondate?: string;
  novissueddate?: string;
  originalcorrectbydate?: string;
  currentstatusdate?: string;
  boro?: string;
  borough?: string;
  housenumber?: string;
  streetname?: string;
  zip?: string;
  apartment?: string;
  story?: string;
}

/** SODA sends full ISO timestamps; the table columns are `date`. */
function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function trunc(v: string | undefined, max: number): string | null {
  if (!v) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function mapRow(r: SodaRow): Record<string, unknown> | null {
  const violationId = trunc(r.violationid, 20);
  if (!violationId) return null;
  return {
    violation_id: violationId,
    bbl: trunc(r.bbl, 10),
    bin: trunc(r.bin, 10),
    order_number: trunc(r.ordernumber, 20),
    nov_description: r.novdescription ?? null,
    violation_status: trunc(r.violationstatus, 20),
    current_status: trunc(r.currentstatus, 50),
    inspection_date: toDate(r.inspectiondate),
    nov_issued_date: toDate(r.novissueddate),
    original_correct_by_date: toDate(r.originalcorrectbydate),
    current_status_date: toDate(r.currentstatusdate),
    borough: trunc(r.boro ?? r.borough, 20),
    house_number: trunc(r.housenumber, 20),
    street_name: trunc(r.streetname, 100),
    zip: trunc(r.zip, 10),
    apartment: trunc(r.apartment, 20),
    story: trunc(r.story, 20),
  };
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("authorization");
  const expectedKey = Deno.env.get("CRON_SECRET");
  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const startTime = Date.now();
  const supabase = getSupabaseAdmin();
  const errors: string[] = [];

  const { data: logData } = await supabase
    .from("sync_log")
    .insert({ sync_type: "hpd_lead_violations", status: "running" })
    .select("id")
    .single();
  const logId = logData?.id;

  // POST {"full": true} ignores the incremental cursor and walks the dataset
  // from the beginning — used to drain the historical backlog left by the
  // original partial import. Safe to re-run: upsert is keyed on violation_id.
  let full = false;
  let startOffset = 0;
  try {
    const body = await req.json();
    full = body?.full === true;
    if (typeof body?.offset === "number" && body.offset >= 0) startOffset = body.offset;
  } catch {
    // empty body — incremental run
  }

  // Incremental: pull everything issued since the newest row we already hold,
  // minus a small overlap so late-arriving records aren't skipped. Falls back
  // to a full pull when the table is empty.
  let since = "2010-01-01";
  const { data: newest } = full ? { data: null } : await supabase
    .from("hpd_lead_violations")
    .select("nov_issued_date")
    .not("nov_issued_date", "is", null)
    .order("nov_issued_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (newest?.nov_issued_date) {
    const d = new Date(newest.nov_issued_date);
    d.setDate(d.getDate() - 7);
    since = d.toISOString().slice(0, 10);
  }

  let added = 0;
  let fetched = 0;
  let pages = 0;
  let linked = 0;

  try {
    for (let offset = startOffset; pages < MAX_PAGES; offset += PAGE_SIZE) {
      const url =
        `${SODA_URL}?$limit=${PAGE_SIZE}&$offset=${offset}` +
        `&$where=novissueddate>='${since}T00:00:00'` +
        `&$order=novissueddate`;

      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        errors.push(`SODA ${res.status} at offset ${offset}`);
        break;
      }

      const rows = (await res.json()) as SodaRow[];
      if (!Array.isArray(rows) || rows.length === 0) break;
      fetched += rows.length;
      pages++;

      const mapped = rows.map(mapRow).filter((r): r is Record<string, unknown> => r !== null);

      // Resolve building_id inline so rows land already linked. The previous
      // approach — a separate pass issuing one UPDATE per row — was the main
      // reason a run blew through the 150s idle timeout.
      const pageBbls = [...new Set(mapped.map((r) => r.bbl).filter(Boolean))] as string[];
      if (pageBbls.length > 0) {
        const { data: buildings } = await supabase
          .from("buildings")
          .select("id, bbl")
          .in("bbl", pageBbls);
        const byBbl = new Map(
          ((buildings ?? []) as { id: string; bbl: string }[]).map((b) => [b.bbl, b.id])
        );
        for (const row of mapped) {
          const id = byBbl.get(row.bbl as string);
          if (id) {
            row.building_id = id;
            linked++;
          }
        }
      }

      for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
        const batch = mapped.slice(i, i + BATCH_SIZE);
        const { error, count } = await supabase
          .from("hpd_lead_violations")
          .upsert(batch, {
            onConflict: "violation_id",
            ignoreDuplicates: false,
            count: "exact",
          });
        if (error) {
          errors.push(`Upsert error (offset ${offset}+${i}): ${error.message}`);
        } else {
          added += count ?? batch.length;
        }
      }

      if (rows.length < PAGE_SIZE) break;
    }

    if (logId) {
      await supabase
        .from("sync_log")
        .update({
          status: errors.length > 0 && added === 0 ? "failed" : "completed",
          completed_at: new Date().toISOString(),
          records_added: added,
          records_linked: linked,
          errors: errors.length > 0 ? errors : null,
        })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        since,
        full,
        startOffset,
        nextOffset: startOffset + pages * PAGE_SIZE,
        pages,
        fetched,
        added,
        linked,
        errors,
        elapsed_s: ((Date.now() - startTime) / 1000).toFixed(1),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (logId) {
      await supabase
        .from("sync_log")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          records_added: added,
          errors: [...errors, message],
        })
        .eq("id", logId);
    }
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
