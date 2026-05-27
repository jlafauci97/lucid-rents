#!/usr/bin/env node
/**
 * Sync NYC Local Law 104 of 2019 — the city's daily-refreshed permit-restriction
 * list. Fetches the public dataset from https://github.com/NYCDOB/LL104 and
 * upserts the current snapshot into public.local_law_104, then joins to the
 * buildings table by BIN to populate building_id.
 *
 * Usage:
 *   node scripts/sync-ll104.mjs                # full sync (default)
 *   node scripts/sync-ll104.mjs --dry-run      # show what would change
 *   node scripts/sync-ll104.mjs --skip-bootstrap   # skip index check
 *
 * Schedule: idempotent and cheap (~7K rows). Safe to run daily via cron.
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createRequire } from "module";

// Parse .env.local
const envPath = resolve(process.cwd(), ".env.local");
const env = {};
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, "").replace(/\\n/g, "");
}

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith("--")).map((a) => {
    const [k, v] = a.slice(2).split("=");
    return [k, v ?? "true"];
  })
);
const DRY_RUN = args["dry-run"] === "true";
const SKIP_BOOTSTRAP = args["skip-bootstrap"] === "true";
// Comma-separated UUID list. When set, only the data-table backfill runs —
// useful for re-running on previously-created buildings without re-syncing.
const BACKFILL_IDS = args["backfill-ids"] ? args["backfill-ids"].split(",").map((s) => s.trim()).filter(Boolean) : null;

// pg client lives in /tmp/pg-helper so the project tree stays clean.
// If the host doesn't have it yet, install on first run.
const PG_HELPER = "/tmp/pg-helper";
const PG_PATH = `${PG_HELPER}/node_modules/pg`;
if (!existsSync(PG_PATH)) {
  console.log("Installing pg client to", PG_HELPER, "...");
  const { execSync } = await import("child_process");
  execSync(`mkdir -p ${PG_HELPER} && cd ${PG_HELPER} && npm install pg --silent`, { stdio: "inherit" });
}
const require = createRequire(`${PG_HELPER}/`);
const { Client } = require("pg");

// Build connection URI from project ref + password.
// Direct connection (port 5432) on db.<ref>.supabase.co — required for
// long-running DDL because the pooler may apply its own timeouts.
const PROJECT_REF = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([^.]+)/)[1];
const DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error("SUPABASE_DB_PASSWORD missing from .env.local");
  process.exit(1);
}
const CONN = {
  host: `db.${PROJECT_REF}.supabase.co`,
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
  statement_timeout: 30 * 60 * 1000, // 30 min, plenty for any DDL/upsert here
};

const LL104_URL = "https://raw.githubusercontent.com/NYCDOB/LL104/gh-pages/data/LL104_details.json";
const LL104_COMMIT_API = "https://api.github.com/repos/NYCDOB/LL104/commits?path=data/LL104_details.json&page=1&per_page=1";

async function fetchUpstream() {
  console.log("\n→ Fetching LL104 dataset and last-modified date...");
  const [dataRes, commitRes] = await Promise.all([
    fetch(LL104_URL),
    fetch(LL104_COMMIT_API, { headers: { "User-Agent": "lucid-rents-sync" } }),
  ]);
  if (!dataRes.ok) throw new Error(`LL104 JSON fetch failed: ${dataRes.status}`);
  if (!commitRes.ok) throw new Error(`Commit API failed: ${commitRes.status}`);
  const rows = await dataRes.json();
  const commits = await commitRes.json();
  const asOfDate = commits[0]?.commit?.committer?.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  console.log(`  ${rows.length.toLocaleString()} buildings, as_of_date=${asOfDate}`);
  return { rows, asOfDate };
}

async function ensureBinIndex(client) {
  if (SKIP_BOOTSTRAP) return;
  console.log("\n→ Ensuring idx_buildings_bin is valid...");
  const { rows } = await client.query(`
    SELECT indisvalid, indisready
    FROM pg_class c
    JOIN pg_index i ON i.indexrelid = c.oid
    WHERE c.relname = 'idx_buildings_bin'
  `);
  const valid = rows[0]?.indisvalid && rows[0]?.indisready;
  if (valid) {
    console.log("  idx_buildings_bin already valid");
    return;
  }
  console.log("  idx_buildings_bin missing or invalid — rebuilding...");
  await client.query("DROP INDEX IF EXISTS public.idx_buildings_bin");
  await client.query(
    "CREATE INDEX idx_buildings_bin ON public.buildings (bin) WHERE bin IS NOT NULL"
  );
  console.log("  idx_buildings_bin rebuilt");
}

function normalizeRow(r, asOfDate) {
  // BIN comes as a number in the upstream JSON; coerce to string for varchar.
  const bin = r.BIN != null ? String(r.BIN) : null;
  if (!bin) return null;
  return {
    bin,
    house_number: r.HOUSE_NUMBER ?? null,
    street_name: r.STREET_NAME ?? null,
    zip: r.ZIP != null ? String(r.ZIP) : null,
    borough: r.BOROUGH ?? null,
    comm_district: r.COMM_DISTRICT ?? null,
    hpd_violations: r.HPD_VIOLATIONS ?? 0,
    dob_violations: r.DOB_VIOLATIONS ?? 0,
    total_violations: r.TOTAL_VIOLATIONS ?? 0,
    dwelling_units: r.DWELLING_UNITS ?? null,
    vio_units_ratio: r.VIO_UNITS_RATIO ?? null,
    latitude: r.LATITUDE_POINT_Y ?? null,
    longitude: r.LONGITUDE_POINT_X ?? null,
    as_of_date: asOfDate,
  };
}

async function upsertRows(client, rows) {
  console.log(`\n→ Upserting ${rows.length.toLocaleString()} rows into local_law_104...`);
  if (DRY_RUN) {
    console.log("  [dry-run] skipping write");
    return;
  }

  const cols = [
    "bin", "house_number", "street_name", "zip", "borough", "comm_district",
    "hpd_violations", "dob_violations", "total_violations", "dwelling_units",
    "vio_units_ratio", "latitude", "longitude", "as_of_date",
  ];
  // Postgres wire protocol caps parameters at 65,535. Stay well under by
  // chunking to 1,000 rows × 14 cols = 14,000 params per query.
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const values = [];
    const placeholders = [];
    for (const r of slice) {
      const base = values.length;
      placeholders.push(`(${cols.map((_, j) => `$${base + j + 1}`).join(", ")}, now())`);
      for (const c of cols) values.push(r[c]);
    }
    const sql = `
      INSERT INTO public.local_law_104 (${cols.join(", ")}, updated_at)
      VALUES ${placeholders.join(", ")}
      ON CONFLICT (bin) DO UPDATE SET
        house_number = EXCLUDED.house_number,
        street_name = EXCLUDED.street_name,
        zip = EXCLUDED.zip,
        borough = EXCLUDED.borough,
        comm_district = EXCLUDED.comm_district,
        hpd_violations = EXCLUDED.hpd_violations,
        dob_violations = EXCLUDED.dob_violations,
        total_violations = EXCLUDED.total_violations,
        dwelling_units = EXCLUDED.dwelling_units,
        vio_units_ratio = EXCLUDED.vio_units_ratio,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        as_of_date = EXCLUDED.as_of_date,
        updated_at = now()
    `;
    await client.query(sql, values);
    process.stdout.write(`  ${Math.min(i + CHUNK, rows.length)}/${rows.length}\r`);
  }
  console.log(`  ${rows.length}/${rows.length} ✓`);
}

async function pruneRemoved(client, currentBins) {
  if (DRY_RUN) {
    const { rows } = await client.query(
      "SELECT COUNT(*)::int AS n FROM public.local_law_104 WHERE bin <> ALL($1)",
      [currentBins]
    );
    console.log(`\n→ [dry-run] Would prune ${rows[0].n} rows no longer on the list`);
    return;
  }
  const { rowCount } = await client.query(
    "DELETE FROM public.local_law_104 WHERE bin <> ALL($1)",
    [currentBins]
  );
  console.log(`\n→ Pruned ${rowCount} rows that fell off the list`);
}

async function linkBuildings(client) {
  console.log("\n→ Linking local_law_104.building_id by BIN...");
  if (DRY_RUN) {
    const { rows: bin } = await client.query(`
      SELECT COUNT(*)::int AS n
      FROM public.local_law_104 ll
      JOIN public.buildings b ON b.bin = ll.bin AND b.metro = 'nyc'
      WHERE ll.building_id IS DISTINCT FROM b.id
    `);
    console.log(`  [dry-run] Would link ${bin[0].n} via BIN`);
    return;
  }

  const { rowCount: byBin } = await client.query(`
    UPDATE public.local_law_104 ll
    SET building_id = b.id
    FROM public.buildings b
    WHERE b.bin = ll.bin
      AND b.metro = 'nyc'
      AND ll.building_id IS DISTINCT FROM b.id
  `);
  console.log(`  Linked ${byBin} via BIN`);

  // Most NYC buildings have NULL bin (the bin-backfill is a separate ongoing
  // effort). Fall back to address matching for remaining rows. LL104 stores
  // STREET_NAME in uppercase; buildings.street_name is mixed-case.
  console.log("\n→ Falling back to address matching for unlinked rows...");
  const { rowCount: byAddr } = await client.query(`
    UPDATE public.local_law_104 ll
    SET building_id = sub.building_id
    FROM (
      SELECT DISTINCT ON (ll2.bin) ll2.bin, b.id AS building_id
      FROM public.local_law_104 ll2
      JOIN public.buildings b
        ON b.metro = 'nyc'
       AND b.house_number = ll2.house_number
       AND UPPER(b.street_name) = ll2.street_name
       AND LOWER(b.borough)     = LOWER(ll2.borough)
      WHERE ll2.building_id IS NULL
      ORDER BY ll2.bin, b.id
    ) sub
    WHERE ll.bin = sub.bin
      AND ll.building_id IS NULL
  `);
  console.log(`  Linked ${byAddr} via address`);

  // Opportunistically backfill buildings.bin where we made an address link
  // and the building's bin is still NULL. Cheap, indexed, and keeps the BIN
  // path winning on future runs.
  const { rowCount: backfilledBin } = await client.query(`
    UPDATE public.buildings b
    SET bin = ll.bin
    FROM public.local_law_104 ll
    WHERE ll.building_id = b.id
      AND b.bin IS NULL
  `);
  console.log(`  Back-filled bin on ${backfilledBin} buildings`);
}

// NYC GeoSearch — resolve a free-text address to its canonical BBL/BIN.
// Used as the 3rd pass for LL104 rows that don't match by BIN or by
// exact address (whitespace, ordinals, abbreviations cause misses).
async function geosearchOne(houseNumber, streetName, borough) {
  // Collapse the LL104 multi-space "SOUTH    3 STREET" to "SOUTH 3 STREET".
  const cleanStreet = (streetName ?? "").replace(/\s+/g, " ").trim();
  const addr = `${houseNumber} ${cleanStreet}, ${borough}, NY`;
  const url = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(addr)}&size=1`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const props = data?.features?.[0]?.properties;
    const pad = props?.addendum?.pad;
    if (!pad?.bbl) return null;
    return {
      bbl: String(pad.bbl),
      bin: pad.bin ? String(pad.bin) : null,
      lat: data.features[0].geometry?.coordinates?.[1] ?? null,
      lon: data.features[0].geometry?.coordinates?.[0] ?? null,
    };
  } catch {
    return null;
  }
}

// Resolve BBL for all unlinked LL104 rows in parallel, throttled to
// avoid overwhelming the GeoSearch service.
async function resolveBblsForUnlinked(client) {
  console.log("\n→ Resolving BBL via NYC GeoSearch for unlinked rows...");
  const { rows: unlinked } = await client.query(`
    SELECT bin, house_number, street_name, borough
    FROM public.local_law_104
    WHERE building_id IS NULL AND bbl IS NULL
  `);
  if (unlinked.length === 0) {
    console.log("  none to resolve");
    return;
  }
  console.log(`  ${unlinked.length} addresses to resolve`);

  const CONCURRENCY = 10;
  let idx = 0;
  let resolved = 0;
  let failed = 0;
  const updates = [];

  async function worker() {
    while (true) {
      const myIdx = idx++;
      if (myIdx >= unlinked.length) return;
      const row = unlinked[myIdx];
      const result = await geosearchOne(row.house_number, row.street_name, row.borough);
      if (result?.bbl) {
        updates.push({ bin: row.bin, bbl: result.bbl });
        resolved++;
      } else {
        failed++;
      }
      if ((myIdx + 1) % 100 === 0) {
        process.stdout.write(`  ${myIdx + 1}/${unlinked.length} (${resolved} resolved)\r`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  console.log(`  ${unlinked.length}/${unlinked.length} done — ${resolved} resolved, ${failed} failed`);

  if (DRY_RUN || updates.length === 0) return;

  // Bulk update local_law_104.bbl by VALUES list.
  const CHUNK = 1000;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const slice = updates.slice(i, i + CHUNK);
    const values = [];
    const placeholders = [];
    for (const u of slice) {
      const base = values.length;
      placeholders.push(`($${base + 1}::varchar, $${base + 2}::varchar)`);
      values.push(u.bin, u.bbl);
    }
    await client.query(
      `UPDATE public.local_law_104 ll
       SET bbl = v.bbl
       FROM (VALUES ${placeholders.join(", ")}) AS v(bin, bbl)
       WHERE ll.bin = v.bin`,
      values
    );
  }

  // Now link by BBL → buildings (uniquely indexed).
  const { rowCount: byBbl } = await client.query(`
    UPDATE public.local_law_104 ll
    SET building_id = b.id
    FROM public.buildings b
    WHERE b.bbl = ll.bbl
      AND b.metro = 'nyc'
      AND ll.building_id IS NULL
  `);
  console.log(`  Linked ${byBbl} via BBL`);

  // Backfill buildings.bbl where we now know it but buildings doesn't.
  // (e.g. a building matched by address but never had a property ID populated.)
  const { rowCount: backfilledBbl } = await client.query(`
    UPDATE public.buildings b
    SET bbl = ll.bbl
    FROM public.local_law_104 ll
    WHERE ll.building_id = b.id
      AND b.bbl IS NULL
      AND ll.bbl IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.buildings b2 WHERE b2.bbl = ll.bbl)
  `);
  console.log(`  Back-filled bbl on ${backfilledBbl} buildings`);
}

// Last resort: any LL104 row still without a building_id gets a new
// building inserted. We have BIN, address, lat/lon, dwelling units, and
// (where GeoSearch resolved) BBL. The building rows are minimal but
// real — they'll show up in search and link future data automatically.
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

async function createBuildingsForResiduals(client) {
  console.log("\n→ Creating new buildings for residual LL104 rows...");
  const { rows: residuals } = await client.query(`
    SELECT bin, bbl, house_number, street_name, zip, borough,
           dwelling_units, latitude, longitude
    FROM public.local_law_104
    WHERE building_id IS NULL
  `);
  if (residuals.length === 0) {
    console.log("  none to create");
    return [];
  }
  console.log(`  ${residuals.length} new buildings to create`);
  if (DRY_RUN) {
    console.log("  [dry-run] skipping insert");
    return [];
  }

  const newBuildingIds = [];
  let created = 0;
  let skipped = 0;
  for (const r of residuals) {
    // Skip rows missing the required NOT-NULL columns. We need borough,
    // street_name, and enough to build a full_address + slug. LL104 always
    // has these so this is mostly defensive.
    if (!r.borough || !r.street_name || !r.house_number) {
      skipped++;
      continue;
    }
    const cleanStreet = r.street_name.replace(/\s+/g, " ").trim();
    const fullAddress = `${r.house_number} ${cleanStreet}, ${r.borough}, NY${r.zip ? ` ${r.zip}` : ""}`;
    const baseSlug = slugify(`${r.house_number} ${cleanStreet} ${r.borough} ny ${r.zip ?? ""}`);
    try {
      // Insert; on slug collision, append the BIN to disambiguate.
      const insert = await client.query(
        `INSERT INTO public.buildings (
           metro, borough, house_number, street_name, full_address, slug,
           zip_code, bin, bbl, total_units, latitude, longitude
         )
         VALUES ('nyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (bbl) DO UPDATE SET bin = COALESCE(public.buildings.bin, EXCLUDED.bin)
         RETURNING id`,
        [
          r.borough, r.house_number, cleanStreet, fullAddress, baseSlug,
          r.zip, r.bin, r.bbl, r.dwelling_units, r.latitude, r.longitude,
        ]
      );
      const buildingId = insert.rows[0].id;
      await client.query(
        `UPDATE public.local_law_104 SET building_id = $1 WHERE bin = $2`,
        [buildingId, r.bin]
      );
      newBuildingIds.push(buildingId);
      created++;
    } catch (err) {
      // Most likely cause: slug collision when bbl is NULL (no ON CONFLICT
      // target). Retry with bin-suffixed slug.
      try {
        const fallbackSlug = `${baseSlug}-${r.bin}`;
        const insert = await client.query(
          `INSERT INTO public.buildings (
             metro, borough, house_number, street_name, full_address, slug,
             zip_code, bin, bbl, total_units, latitude, longitude
           )
           VALUES ('nyc', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           RETURNING id`,
          [
            r.borough, r.house_number, cleanStreet, fullAddress, fallbackSlug,
            r.zip, r.bin, r.bbl, r.dwelling_units, r.latitude, r.longitude,
          ]
        );
        const buildingId = insert.rows[0].id;
        await client.query(
          `UPDATE public.local_law_104 SET building_id = $1 WHERE bin = $2`,
          [buildingId, r.bin]
        );
        newBuildingIds.push(buildingId);
        created++;
      } catch (err2) {
        console.warn(`  ⚠ failed to create bin=${r.bin}: ${err2.message}`);
        skipped++;
      }
    }
    if ((created + skipped) % 100 === 0) {
      process.stdout.write(`  ${created + skipped}/${residuals.length} (${created} created)\r`);
    }
  }
  console.log(`  ${residuals.length}/${residuals.length} done — ${created} created, ${skipped} skipped`);
  return newBuildingIds;
}

// For freshly-created buildings, attach every NYC data table that keys on
// BBL or BIN. NYC's data ecosystem keys most signals on these property IDs,
// so the public records for these buildings often already exist in our
// tables — they're just missing a building_id pointer. After linking, we
// recompute the denormalized counts and is_rent_stabilized flag the
// building detail page reads directly.
async function backfillNewBuildings(client, buildingIds) {
  if (!buildingIds || buildingIds.length === 0) return;
  if (DRY_RUN) {
    console.log(`\n→ [dry-run] would backfill data for ${buildingIds.length} new buildings`);
    return;
  }
  console.log(`\n→ Backfilling data tables for ${buildingIds.length} new buildings...`);

  // Tables keyed on BBL and/or BIN that we want to associate with the new
  // buildings. Each table gets one UPDATE per join key. The `_count` column
  // (if any) gets recomputed below.
  const TABLES = [
    { table: "hpd_violations",      bbl: true, bin: true },
    { table: "dob_violations",      bbl: true, bin: true },
    { table: "dob_permits",         bbl: true, bin: true },
    { table: "hpd_registrations",   bbl: true, bin: true },
    { table: "hpd_lead_violations", bbl: true, bin: true },
    { table: "hpd_litigations",     bbl: true, bin: false },
    { table: "hpd_contacts",        bbl: false, bin: false }, // joins via registration_id elsewhere
    { table: "bedbug_reports",      bbl: true, bin: true },
    { table: "evictions",           bbl: true, bin: true },
    { table: "sidewalk_sheds",      bbl: true, bin: true },
    { table: "energy_benchmarks",   bbl: true, bin: false },
    { table: "rent_stabilization",  bbl: true, bin: false },
  ];

  for (const t of TABLES) {
    if (t.bbl) {
      const { rowCount } = await client.query(
        `UPDATE public.${t.table} t
         SET building_id = b.id
         FROM public.buildings b
         WHERE b.id = ANY($1::uuid[])
           AND t.bbl = b.bbl
           AND b.bbl IS NOT NULL
           AND t.building_id IS DISTINCT FROM b.id`,
        [buildingIds]
      );
      if (rowCount > 0) console.log(`  ${t.table} ↔ bbl: linked ${rowCount} rows`);
    }
    if (t.bin) {
      const { rowCount } = await client.query(
        `UPDATE public.${t.table} t
         SET building_id = b.id
         FROM public.buildings b
         WHERE b.id = ANY($1::uuid[])
           AND t.bin = b.bin
           AND b.bin IS NOT NULL
           AND t.building_id IS DISTINCT FROM b.id`,
        [buildingIds]
      );
      if (rowCount > 0) console.log(`  ${t.table} ↔ bin: linked ${rowCount} rows`);
    }
  }

  // Recompute denormalized counts that the building detail page renders.
  // owner_name/management_company are intentionally left for the building
  // page's `get_building_owner_info_by_bbl` RPC to resolve at render time —
  // it joins hpd_registrations with hpd_contacts (the table that actually
  // holds the head-officer name), which is logic we don't want to duplicate.
  console.log("  Recomputing counts on buildings rows...");
  await client.query(
    `UPDATE public.buildings b
     SET
       violation_count       = COALESCE(v.cnt, 0),
       dob_violation_count   = COALESCE(dv.cnt, 0),
       permit_count          = COALESCE(p.cnt, 0),
       bedbug_report_count   = COALESCE(bb.cnt, 0),
       eviction_count        = COALESCE(e.cnt, 0),
       lead_violation_count  = COALESCE(lv.cnt, 0),
       litigation_count      = COALESCE(lt.cnt, 0),
       sidewalk_shed_count   = COALESCE(ss.cnt, 0),
       is_rent_stabilized    = COALESCE(rs.is_stab, false),
       energy_star_score     = eb.energy_star_score
     FROM public.buildings b0
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.hpd_violations      WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) v   ON v.building_id  = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.dob_violations      WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) dv  ON dv.building_id = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.dob_permits         WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) p   ON p.building_id  = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.bedbug_reports      WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) bb  ON bb.building_id = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.evictions           WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) e   ON e.building_id  = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.hpd_lead_violations WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) lv  ON lv.building_id = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.hpd_litigations     WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) lt  ON lt.building_id = b0.id
     LEFT JOIN (SELECT building_id, COUNT(*)::int AS cnt FROM public.sidewalk_sheds      WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) ss  ON ss.building_id = b0.id
     LEFT JOIN (SELECT building_id, bool_or(true) AS is_stab FROM public.rent_stabilization WHERE building_id = ANY($1::uuid[]) GROUP BY building_id) rs ON rs.building_id = b0.id
     LEFT JOIN (SELECT DISTINCT ON (building_id) building_id, energy_star_score FROM public.energy_benchmarks WHERE building_id = ANY($1::uuid[]) ORDER BY building_id, report_year DESC NULLS LAST) eb ON eb.building_id = b0.id
     WHERE b.id = b0.id AND b.id = ANY($1::uuid[])`,
    [buildingIds]
  );

  // Print per-building summary so we can verify the backfill at a glance.
  const { rows } = await client.query(
    `SELECT slug, violation_count, dob_violation_count, eviction_count,
            permit_count, is_rent_stabilized
     FROM public.buildings WHERE id = ANY($1::uuid[]) ORDER BY violation_count DESC`,
    [buildingIds]
  );
  for (const r of rows) {
    console.log(
      `  ${r.slug.padEnd(50)} viol=${String(r.violation_count).padStart(4)} dob=${String(r.dob_violation_count).padStart(3)} ` +
      `evict=${String(r.eviction_count).padStart(2)} permits=${String(r.permit_count).padStart(3)} ` +
      `rs=${r.is_rent_stabilized ? "Y" : "·"}`
    );
  }
}

async function summary(client) {
  const { rows } = await client.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(building_id)::int AS linked,
      MIN(as_of_date) AS oldest,
      MAX(as_of_date) AS newest
    FROM public.local_law_104
  `);
  const r = rows[0];
  console.log("\n=== Summary ===");
  console.log(`  Total LL104 rows:   ${r.total.toLocaleString()}`);
  console.log(`  Linked to buildings: ${r.linked.toLocaleString()} (${((r.linked / r.total) * 100).toFixed(1)}%)`);
  console.log(`  as_of_date:          ${r.newest === r.oldest ? r.newest : `${r.oldest} – ${r.newest}`}`);
}

async function main() {
  console.log("=== Sync Local Law 104 ===");
  console.log(`  ${DRY_RUN ? "DRY RUN" : "LIVE"}`);

  const client = new Client(CONN);
  await client.connect();
  try {
    if (BACKFILL_IDS) {
      console.log(`  Mode: backfill-only (${BACKFILL_IDS.length} ids)`);
      await backfillNewBuildings(client, BACKFILL_IDS);
      return;
    }

    const { rows: upstream, asOfDate } = await fetchUpstream();
    const normalized = upstream.map((r) => normalizeRow(r, asOfDate)).filter(Boolean);
    if (normalized.length === 0) throw new Error("No valid rows in upstream dataset");

    await ensureBinIndex(client);
    await upsertRows(client, normalized);
    await pruneRemoved(client, normalized.map((r) => r.bin));
    await linkBuildings(client);
    await resolveBblsForUnlinked(client);
    const newBuildingIds = await createBuildingsForResiduals(client);
    await backfillNewBuildings(client, newBuildingIds);
    await summary(client);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("\n✗ Sync failed:", err.message);
  console.error(err.stack);
  process.exit(1);
});
