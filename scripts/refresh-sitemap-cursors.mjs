/**
 * Rebuild sitemap_building_cursors and sitemap_landlord_cursors tables.
 *
 * Walks the buildings/landlord_stats tables in UUID order, recording every
 * 10,000th row as a cursor. Much faster than row_number() over 2.7M rows.
 *
 * Usage:  node scripts/refresh-sitemap-cursors.mjs
 */

const BATCH_SIZE = 10000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

async function supabaseFetch(path, opts = {}, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: { apikey: SUPABASE_KEY, ...opts.headers },
        ...opts,
      });
      if (!res.ok) {
        const body = await res.text();
        if (res.status >= 500 && attempt < retries - 1) {
          console.log(`  Retry ${attempt + 1}/${retries} for ${path.slice(0, 80)}...`);
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        throw new Error(`Supabase ${res.status}: ${path.slice(0, 80)} — ${body}`);
      }
      return res.json();
    } catch (err) {
      if (attempt < retries - 1 && err.message?.includes("timeout")) {
        console.log(`  Retry ${attempt + 1}/${retries} (timeout)...`);
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function supabasePost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${res.status}: ${path} — ${await res.text()}`);
}

async function supabaseDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: { apikey: SUPABASE_KEY, Prefer: "return=minimal" },
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${res.status}: ${path} — ${await res.text()}`);
}

// ─── Building cursors ──────────────────────────────────────────

async function refreshBuildingCursors() {
  console.log("Refreshing building cursors...");

  // Delete existing cursors
  await supabaseDelete("sitemap_building_cursors?batch_index=gte.0");

  // Use smaller page size (1000) to avoid REST API statement timeout,
  // but only record a cursor every BATCH_SIZE rows
  const PAGE = 1000;
  let cursor = "00000000-0000-0000-0000-000000000000";
  let batchIndex = 0;
  let rowsSinceCursor = 0;
  let totalRows = 0;
  let firstIdInBatch = null;

  while (true) {
    const rows = await supabaseFetch(
      `buildings?select=id&id=gt.${cursor}&order=id.asc&limit=${PAGE}`
    );

    if (!rows || rows.length === 0) {
      // Save final partial batch cursor if we have one pending
      if (firstIdInBatch && rowsSinceCursor > 0) {
        await supabasePost("sitemap_building_cursors", {
          batch_index: batchIndex,
          cursor_id: firstIdInBatch,
        });
        batchIndex++;
      }
      break;
    }

    for (const row of rows) {
      if (rowsSinceCursor === 0) {
        firstIdInBatch = row.id;
      }
      rowsSinceCursor++;
      totalRows++;

      if (rowsSinceCursor === BATCH_SIZE) {
        await supabasePost("sitemap_building_cursors", {
          batch_index: batchIndex,
          cursor_id: firstIdInBatch,
        });
        batchIndex++;
        rowsSinceCursor = 0;
        firstIdInBatch = null;

        if (batchIndex % 50 === 0) {
          console.log(`  ... ${batchIndex} batches, ${totalRows.toLocaleString()} buildings`);
        }
      }
    }

    cursor = rows[rows.length - 1].id;

    if (rows.length < PAGE) {
      // Save final partial batch
      if (firstIdInBatch && rowsSinceCursor > 0) {
        await supabasePost("sitemap_building_cursors", {
          batch_index: batchIndex,
          cursor_id: firstIdInBatch,
        });
        batchIndex++;
      }
      break;
    }
  }

  console.log(`  Done: ${batchIndex} batches covering ${totalRows.toLocaleString()} buildings`);
  return batchIndex;
}

// ─── Landlord cursors ──────────────────────────────────────────

async function refreshLandlordCursors() {
  console.log("Refreshing landlord cursors...");

  await supabaseDelete("sitemap_landlord_cursors?batch_index=gte.0");

  const PAGE = 1000;
  let cursor = "";
  let batchIndex = 0;
  let rowsSinceCursor = 0;
  let totalRows = 0;
  let firstNameInBatch = null;

  while (true) {
    const filter = cursor
      ? `landlord_stats?select=name&name=gt.${encodeURIComponent(cursor)}&order=name.asc&limit=${PAGE}`
      : `landlord_stats?select=name&order=name.asc&limit=${PAGE}`;
    const rows = await supabaseFetch(filter);

    if (!rows || rows.length === 0) {
      if (firstNameInBatch && rowsSinceCursor > 0) {
        await supabasePost("sitemap_landlord_cursors", {
          batch_index: batchIndex,
          cursor_name: firstNameInBatch,
        });
        batchIndex++;
      }
      break;
    }

    for (const row of rows) {
      if (rowsSinceCursor === 0) {
        firstNameInBatch = row.name;
      }
      rowsSinceCursor++;
      totalRows++;

      if (rowsSinceCursor === BATCH_SIZE) {
        await supabasePost("sitemap_landlord_cursors", {
          batch_index: batchIndex,
          cursor_name: firstNameInBatch,
        });
        batchIndex++;
        rowsSinceCursor = 0;
        firstNameInBatch = null;

        if (batchIndex % 20 === 0) {
          console.log(`  ... ${batchIndex} batches, ${totalRows.toLocaleString()} landlords`);
        }
      }
    }

    cursor = rows[rows.length - 1].name;

    if (rows.length < PAGE) {
      if (firstNameInBatch && rowsSinceCursor > 0) {
        await supabasePost("sitemap_landlord_cursors", {
          batch_index: batchIndex,
          cursor_name: firstNameInBatch,
        });
        batchIndex++;
      }
      break;
    }
  }

  console.log(`  Done: ${batchIndex} batches covering ${totalRows.toLocaleString()} landlords`);
  return batchIndex;
}

// ─── Main ──────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  await refreshBuildingCursors();
  await refreshLandlordCursors();
  console.log(`\nAll cursors refreshed in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
