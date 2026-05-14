/**
 * Prune deleted-building URLs from public/sitemap/b-*.xml.
 *
 * Why: after the building dedup pass (~402K rows deleted across 5 metros),
 * the committed b-*.xml sitemaps still listed ~18K removed slugs. GSC's
 * Coverage report flagged 18,969 URLs as "Page with redirect".
 *
 * Strategy (slug-driven, not full-table):
 *   1. Walk b-*.xml locally and extract (url, slug, borough_slug, city) for
 *      every <loc>. This is ~3M tuples — fast and local.
 *   2. Batch the unique slugs (~2.7M) and query the slug index in chunks:
 *      `WHERE slug = ANY($1)`. Slug lookups are ~ms-fast (idx_buildings_slug);
 *      the full-table-by-id scan we'd avoided was 2ms/row × 2.7M = 90+ min.
 *   3. Build a Set of alive `slug__borough__metro` triples from returned rows.
 *   4. For each sitemap URL, if its reconstructed triple isn't in the set,
 *      mark it for removal.
 *   5. Rewrite affected b-*.xml atomically (tmp file → rename).
 *
 * Non-destructive vs generate-sitemaps.mjs:
 *   - Does NOT touch 0.xml, hubs.xml, l-*.xml, index.xml, sitemap.xml.
 *   - Does NOT wipe public/sitemap/ — only edits b-*.xml in place.
 *   - URLs in DB but missing from sitemaps are left as-is.
 *
 * Usage:
 *   node scripts/prune-deleted-buildings-from-sitemap.mjs           # dry-run
 *   node scripts/prune-deleted-buildings-from-sitemap.mjs --apply   # writes
 */

import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from "node:fs";

const BASE_URL = "https://lucidrents.com";
const OUT_DIR = "public/sitemap";
const APPLY = process.argv.includes("--apply");
// BATCH_SIZE = 400 keeps the in.(...) URL under ~12KB; at 500 some pages
// hit ~14KB and the test with 1000 hit "Bad Request" at 28KB.
const BATCH_SIZE = 400;
const PARALLEL = 10;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE keys");
  process.exit(1);
}

// ─── URL parsing ────────────────────────────────────────────────
//
// Sitemap URL formats per generate-sitemaps.mjs:
//   /nyc/building/<borough_slug>/<slug>
//   /TX/Houston/building/<borough_slug>/<slug>
//   /CA/Los-Angeles/building/<borough_slug>/<slug>
//   /IL/Chicago/building/<borough_slug>/<slug>
//   /FL/Miami/building/<borough_slug>/<slug>
//
// City detection from the leading path segment(s) before "/building/".

function parseUrl(url) {
  // Strip BASE_URL prefix and leading slash.
  if (!url.startsWith(BASE_URL + "/")) return null;
  const path = url.slice(BASE_URL.length + 1);
  // Match "<prefix>/building/<borough>/<slug>"
  const m = path.match(/^(.+?)\/building\/([^/]+)\/(.+)$/);
  if (!m) return null;
  const [, prefix, boroughSlug, slug] = m;
  let city = null;
  if (prefix === "nyc") city = "nyc";
  else if (prefix === "TX/Houston") city = "houston";
  else if (prefix === "CA/Los-Angeles") city = "los-angeles";
  else if (prefix === "IL/Chicago") city = "chicago";
  else if (prefix === "FL/Miami") city = "miami";
  else return null;
  return { city, boroughSlug, slug };
}

function metroForCity(city) {
  // Inverse of generate-sitemaps.mjs metroToCity().
  // All cities here are also valid metros.
  return city;
}

function regionSlug(name) {
  return name.toLowerCase().replace(/\s+/g, "-");
}

// ─── Phase 1: extract URLs from sitemap files ───────────────────

function extractSitemap() {
  const t0 = Date.now();
  const files = readdirSync(OUT_DIR)
    .filter((f) => /^b-\d+\.xml$/.test(f))
    .sort((a, b) => {
      const ai = parseInt(a.slice(2, -4), 10);
      const bi = parseInt(b.slice(2, -4), 10);
      return ai - bi;
    });

  // urlsByFile[file] = [{ url, slug, boroughSlug, city, block }]
  const urlsByFile = new Map();
  const slugs = new Set();
  let totalUrls = 0;
  let unparsed = 0;

  for (const file of files) {
    const xml = readFileSync(`${OUT_DIR}/${file}`, "utf8");
    const entries = [];
    const blockRe = /<url>[\s\S]*?<\/url>/g;
    const locRe = /<loc>([^<]+)<\/loc>/;
    let m;
    while ((m = blockRe.exec(xml)) !== null) {
      totalUrls++;
      const block = m[0];
      const locM = block.match(locRe);
      if (!locM) {
        entries.push({ url: null, block, parsed: null });
        continue;
      }
      const parsed = parseUrl(locM[1]);
      if (!parsed) {
        unparsed++;
        entries.push({ url: locM[1], block, parsed: null });
        continue;
      }
      entries.push({ url: locM[1], block, parsed });
      slugs.add(parsed.slug);
    }
    urlsByFile.set(file, entries);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Sitemap scan: ${files.length} files, ${totalUrls.toLocaleString()} URLs, ${slugs.size.toLocaleString()} unique slugs (${unparsed} unparseable) in ${elapsed}s`
  );
  return { urlsByFile, slugs, totalUrls };
}

// ─── Phase 2: bulk-check slugs against DB ───────────────────────

async function postgrest(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        headers: { apikey: SUPABASE_KEY },
      });
      if (!res.ok) {
        const status = res.status;
        if (status >= 500 && attempt < 4) {
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
          continue;
        }
        const text = await res.text().catch(() => "");
        throw new Error(`Supabase ${status}: ${path.slice(0, 80)} — ${text.slice(0, 200)}`);
      }
      return res.json();
    } catch (err) {
      // Network errors (ECONNRESET, fetch failed) — retry with backoff.
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

async function queryBatch(slugBatch) {
  // PostgREST GET /buildings?slug=in.(s1,s2,...). Wrap each slug in double
  // quotes so commas/parens inside the value are safe; escape any " inside.
  const valuesList = slugBatch
    .map((s) => `"${s.replace(/"/g, '\\"')}"`)
    .join(",");
  const path = `buildings?select=slug,borough,metro&slug=in.(${encodeURIComponent(valuesList)})`;
  return postgrest(path);
}

const CACHE_FILE = "/tmp/sitemap-alive-cache.jsonl";

function loadAliveCache() {
  try {
    if (!process.argv.includes("--use-cache")) return null;
    if (!existsSync(CACHE_FILE)) return null;
    const data = readFileSync(CACHE_FILE, "utf8");
    const alive = new Map();
    let count = 0;
    for (const line of data.split("\n")) {
      if (!line) continue;
      const row = JSON.parse(line);
      let list = alive.get(row.slug);
      if (!list) { list = []; alive.set(row.slug, list); }
      list.push({ borough: row.borough, metro: row.metro });
      count++;
    }
    console.log(`Loaded alive cache: ${alive.size.toLocaleString()} slugs / ${count.toLocaleString()} rows from ${CACHE_FILE}`);
    return alive;
  } catch (err) {
    console.warn(`Cache load failed: ${err.message}`);
    return null;
  }
}

function saveAliveCache(alive) {
  const lines = [];
  for (const [slug, list] of alive) {
    for (const c of list) {
      lines.push(JSON.stringify({ slug, borough: c.borough, metro: c.metro }));
    }
  }
  writeFileSync(CACHE_FILE, lines.join("\n") + "\n");
  console.log(`  Wrote alive cache to ${CACHE_FILE} (${lines.length.toLocaleString()} rows)`);
}

async function checkSlugs(slugs) {
  const cached = loadAliveCache();
  if (cached) return cached;

  const t0 = Date.now();
  const slugArray = Array.from(slugs);
  const total = slugArray.length;
  console.log(
    `\nChecking ${total.toLocaleString()} unique slugs against DB (batch=${BATCH_SIZE}, parallel=${PARALLEL})...`
  );

  // alive[slug] = Array<{ borough, metro }>
  const alive = new Map();
  let processed = 0;
  let lastLog = 0;

  // Split into batches
  const batches = [];
  for (let i = 0; i < slugArray.length; i += BATCH_SIZE) {
    batches.push(slugArray.slice(i, i + BATCH_SIZE));
  }

  // Worker pool
  let nextBatch = 0;
  async function worker(id) {
    while (nextBatch < batches.length) {
      const myIdx = nextBatch++;
      const batch = batches[myIdx];
      try {
        const rows = await queryBatch(batch);
        for (const row of rows) {
          if (!row.slug) continue;
          let list = alive.get(row.slug);
          if (!list) {
            list = [];
            alive.set(row.slug, list);
          }
          list.push({ borough: row.borough, metro: row.metro });
        }
      } catch (err) {
        console.error(`  worker ${id} batch ${myIdx} failed: ${err.message}`);
        // re-queue once
        if (!batch.__retried) {
          batch.__retried = true;
          batches.push(batch);
        }
      }
      processed += batch.length;
      if (processed - lastLog >= 100000 || processed === total) {
        const rate = (processed / ((Date.now() - t0) / 1000)).toFixed(0);
        const pct = ((processed / total) * 100).toFixed(1);
        console.log(
          `  ${processed.toLocaleString()}/${total.toLocaleString()} slugs (${pct}%, ${rate}/s, ${alive.size.toLocaleString()} alive)`
        );
        lastLog = processed;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(PARALLEL, batches.length) }, (_, i) =>
      worker(i)
    )
  );

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Slug check: ${alive.size.toLocaleString()}/${total.toLocaleString()} slugs alive in ${elapsed}s`
  );
  saveAliveCache(alive);
  return alive;
}

// ─── Phase 3: decide which URLs to keep ─────────────────────────

function urlIsAlive(parsed, alive) {
  const candidates = alive.get(parsed.slug);
  if (!candidates) return false;
  // Match by metro AND borough — same slug can exist in multiple metros
  // (e.g. duplicate addresses) so both must align.
  const expectedMetro = metroForCity(parsed.city);
  for (const c of candidates) {
    if (c.metro !== expectedMetro) continue;
    if (!c.borough) continue;
    if (regionSlug(c.borough) === parsed.boroughSlug) return true;
  }
  return false;
}

// ─── Phase 4: rewrite files ─────────────────────────────────────

function rewrite(urlsByFile, alive) {
  let totalIn = 0,
    totalKept = 0,
    totalRemoved = 0,
    filesChanged = 0;
  const examples = [];
  const changedFiles = [];
  const removedByCity = { nyc: 0, houston: 0, "los-angeles": 0, chicago: 0, miami: 0 };
  const removedUrls = []; // full list, written to disk for review

  for (const [file, entries] of urlsByFile) {
    const keptBlocks = [];
    let removedHere = 0;
    for (const e of entries) {
      totalIn++;
      if (!e.parsed) {
        // Unparseable — keep (don't risk wrongly deleting)
        keptBlocks.push(e.block);
        totalKept++;
        continue;
      }
      if (urlIsAlive(e.parsed, alive)) {
        keptBlocks.push(e.block);
        totalKept++;
      } else {
        removedHere++;
        totalRemoved++;
        removedByCity[e.parsed.city] = (removedByCity[e.parsed.city] || 0) + 1;
        removedUrls.push(e.url);
        if (examples.length < 8) examples.push(e.url);
      }
    }
    if (removedHere === 0) continue;

    filesChanged++;
    changedFiles.push({ file, removed: removedHere });

    if (APPLY) {
      const header = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      const footer = `\n</urlset>`;
      const newXml = header + keptBlocks.join("\n") + footer;
      const path = `${OUT_DIR}/${file}`;
      const tmpPath = `${path}.tmp`;
      writeFileSync(tmpPath, newXml);
      renameSync(tmpPath, path);
    }
  }

  // Persist removed-URL list so the user can audit any time without re-running.
  writeFileSync("/tmp/sitemap-removed-urls.txt", removedUrls.join("\n") + "\n");

  return { totalIn, totalKept, totalRemoved, filesChanged, changedFiles, examples, removedByCity };
}

// ─── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY (will rewrite files)" : "DRY RUN (no writes)"}`);
  const { urlsByFile, slugs, totalUrls } = extractSitemap();
  const alive = await checkSlugs(slugs);
  const stats = rewrite(urlsByFile, alive);

  console.log(`\n─── Summary ────────────────────────────────`);
  console.log(`URLs scanned:   ${stats.totalIn.toLocaleString()}`);
  console.log(`URLs kept:      ${stats.totalKept.toLocaleString()}`);
  console.log(`URLs removed:   ${stats.totalRemoved.toLocaleString()}`);
  console.log(`Files changed:  ${stats.filesChanged}`);

  console.log(`\nRemovals by city:`);
  for (const [city, n] of Object.entries(stats.removedByCity).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${city.padEnd(14)} ${n.toLocaleString()}`);
  }

  if (stats.changedFiles.length > 0) {
    console.log(`\nTop 10 files by removals:`);
    stats.changedFiles
      .sort((a, b) => b.removed - a.removed)
      .slice(0, 10)
      .forEach(({ file, removed }) =>
        console.log(`  ${file.padEnd(12)} ${removed}`)
      );
  }

  if (stats.examples.length > 0) {
    console.log(`\nExample URLs being removed:`);
    stats.examples.forEach((u) => console.log(`  ${u}`));
  }

  if (!APPLY) {
    console.log(`\nDry-run complete. Re-run with --apply to write changes.`);
  } else {
    console.log(`\nApplied. ${stats.filesChanged} files updated.`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
