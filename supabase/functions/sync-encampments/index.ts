import { getSupabaseAdmin } from "shared/supabase-admin.ts";

// MyLA311 2026 dataset -- filter for "Homeless Encampment" type
const SODA_ENDPOINT = "https://data.lacity.org/resource/2cy6-i7zn.json";
const ENCAMPMENT_TYPE = "Homeless Encampment";
const PAGE_SIZE = 5000;
const BATCH_SIZE = 500;

interface SodaRecord {
  casenumber?: string;
  createddate?: string;
  closeddate?: string;
  status?: string;
  type?: string;
  locator_gis_returned_address?: string;
  locator_sr_house_number_?: string;
  locator_sr_street_name__c?: string;
  locator_service_request_suffix?: string;
  zipcode__c?: string;
  geolocation__latitude__s?: string;
  geolocation__longitude__s?: string;
  locator_council_district?: string;
  locator_sr_neigborhood_council_1?: string;
}

function buildAddress(r: SodaRecord): string {
  if (r.locator_gis_returned_address) return r.locator_gis_returned_address;
  const parts = [
    r.locator_sr_house_number_,
    r.locator_sr_street_name__c,
    r.locator_service_request_suffix,
  ].filter(Boolean);
  return parts.join(" ") || "";
}

async function getLastSyncDate(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string | null> {
  const { data, error } = await supabase
    .from("encampments")
    .select("created_date")
    .order("created_date", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return data[0].created_date;
}

async function fetchPage(offset: number, extraWhere?: string): Promise<SodaRecord[]> {
  const whereParts = [`type='${ENCAMPMENT_TYPE}'`];
  if (extraWhere) whereParts.push(extraWhere);

  const params = new URLSearchParams({
    $limit: String(PAGE_SIZE),
    $offset: String(offset),
    $order: "createddate ASC",
    $where: whereParts.join(" AND "),
  });

  const url = `${SODA_ENDPOINT}?${params}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SODA API returned ${res.status}: ${await res.text()}`);
  return res.json();
}

async function upsertBatch(supabase: ReturnType<typeof getSupabaseAdmin>, records: SodaRecord[]) {
  const rows = records
    .filter((r) => r.casenumber && r.createddate)
    .map((r) => ({
      sr_number: r.casenumber!,
      created_date: r.createddate!,
      closed_date: r.closeddate || null,
      status: r.status || null,
      request_type: r.type || null,
      address: buildAddress(r),
      zip_code: r.zipcode__c || null,
      latitude: r.geolocation__latitude__s ? parseFloat(r.geolocation__latitude__s) : null,
      longitude: r.geolocation__longitude__s ? parseFloat(r.geolocation__longitude__s) : null,
      council_district: r.locator_council_district || null,
      nc_name: r.locator_sr_neigborhood_council_1 || null,
      metro: "los-angeles",
    }));

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("encampments")
      .upsert(batch, { onConflict: "sr_number" });
    if (error) throw new Error(`Upsert error: ${error.message}`);
  }

  return rows.length;
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

  const supabase = getSupabaseAdmin();

  try {
    const lastSync = await getLastSyncDate(supabase);
    const whereClause = lastSync
      ? `createddate > '${lastSync.slice(0, 19)}'`
      : undefined;

    let totalSynced = 0;
    let offset = 0;

    while (true) {
      const records = await fetchPage(offset, whereClause);
      if (records.length === 0) break;

      const count = await upsertBatch(supabase, records);
      totalSynced += count;
      offset += PAGE_SIZE;

      if (records.length < PAGE_SIZE) break;
    }

    return new Response(JSON.stringify({
      ok: true,
      synced: totalSynced,
      incremental: !!lastSync,
      message: `Synced ${totalSynced} encampment records`,
    }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Encampment sync error:", err);
    return new Response(JSON.stringify(
      { ok: false, error: String(err) }
    ), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
