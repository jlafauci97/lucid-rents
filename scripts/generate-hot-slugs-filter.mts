/**
 * Regenerate src/generated/hot-slugs-filter.ts — the Bloom filters the proxy
 * uses to split building/landlord traffic into the hot tier (ISR, cached) and
 * the long tail (rewritten to the force-dynamic *-dyn twin routes, zero ISR
 * writes). See src/lib/hot-slugs.ts and src/proxy.ts.
 *
 * Hot building: has reviews, or >=10 violations (HPD or DOB) — mirrors
 * isLongTailBuilding in src/lib/building-render-policy.ts.
 * Hot landlord: >=5 buildings, or >=10 violations — mirrors isLongTailLandlord.
 *
 * Staleness is benign in both directions: a newly-hot slug renders dynamically
 * (always fresh, just uncached) until the next regen; a gone-cold slug keeps
 * ISR (today's behavior). Re-run before deploys when counts drift:
 *
 *   npm run generate-hot-filter
 *
 * Required env (loaded from .env.local like the other Mini scripts):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bloomAdd, bloomParams } from "../src/lib/bloom";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(): void {
  const envPath = path.join(ROOT, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const value = m[2].replace(/^["']|["']$/g, "");
      if (!process.env[m[1]]) process.env[m[1]] = value;
    }
  }
}
loadEnv();

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("[generate-hot-slugs-filter] missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function fetchRows(pathAndQuery: string): Promise<Array<Record<string, unknown>>> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: SERVICE_KEY, authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${pathAndQuery}`);
  return (await res.json()) as Array<Record<string, unknown>>;
}

/** Keyset-paginate slugs for rows matching `filter` (PostgREST or= syntax). */
async function fetchHotSlugs(table: string, filter: string): Promise<Set<string>> {
  const slugs = new Set<string>();
  let cursor = "00000000-0000-0000-0000-000000000000";
  const PAGE = 10000;
  for (;;) {
    const rows = await fetchRows(
      `${table}?select=id,slug&${filter}&slug=not.is.null&id=gt.${cursor}&order=id.asc&limit=${PAGE}`,
    );
    for (const r of rows) {
      if (typeof r.slug === "string" && r.slug) slugs.add(r.slug.toLowerCase());
    }
    if (rows.length < PAGE) break;
    cursor = String(rows[rows.length - 1].id);
  }
  return slugs;
}

function buildFilter(slugs: Set<string>, capacity: number) {
  const { m, k } = bloomParams(capacity, 0.02);
  const bits = new Uint8Array(m / 8);
  for (const slug of slugs) bloomAdd(bits, m, k, slug);
  return { m, k, base64: Buffer.from(bits).toString("base64"), count: slugs.size };
}

async function main() {
  console.log("[hot-filter] fetching hot building slugs…");
  const buildingSlugs = await fetchHotSlugs(
    "buildings",
    "or=(review_count.gt.0,violation_count.gte.10,dob_violation_count.gte.10)",
  );
  console.log(`[hot-filter] ${buildingSlugs.size} hot buildings`);

  console.log("[hot-filter] fetching hot landlord slugs…");
  const landlordSlugs = await fetchHotSlugs(
    "landlord_stats",
    "or=(building_count.gte.5,total_violations.gte.10,total_dob_violations.gte.10)",
  );
  console.log(`[hot-filter] ${landlordSlugs.size} hot landlords`);

  // Capacity = current count + ~30% headroom, so counts can grow between
  // regens without the false-positive rate degrading much.
  const b = buildFilter(buildingSlugs, Math.ceil(buildingSlugs.size * 1.3) + 1000);
  const l = buildFilter(landlordSlugs, Math.ceil(landlordSlugs.size * 1.3) + 1000);

  const out = `// GENERATED FILE — do not edit. Regenerate with: npm run generate-hot-filter
// Bloom filters of hot building/landlord slugs for the proxy's ISR/dynamic
// route split. See scripts/generate-hot-slugs-filter.mts and src/lib/hot-slugs.ts.
// Generated ${new Date().toISOString()}

export const HOT_BUILDINGS = {
  m: ${b.m},
  k: ${b.k},
  count: ${b.count},
  base64:
    "${b.base64}",
};

export const HOT_LANDLORDS = {
  m: ${l.m},
  k: ${l.k},
  count: ${l.count},
  base64:
    "${l.base64}",
};
`;
  const dest = path.join(ROOT, "src/generated/hot-slugs-filter.ts");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, out);
  const kb = (fs.statSync(dest).size / 1024).toFixed(0);
  console.log(`[hot-filter] wrote ${dest} (${kb}KB)`);
}

main().catch((err) => {
  console.error("[hot-filter] failed:", err);
  process.exit(1);
});
