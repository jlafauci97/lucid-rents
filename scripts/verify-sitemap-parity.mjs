/**
 * Sitemap parity verifier — diffs the new TS generator's output against the
 * checked-in static XML in public/sitemap/.
 *
 * The new chunk-generation logic lives in src/lib/sitemap/generator.ts; this
 * script imports it via jiti so we can run TS without a build step.
 *
 * Usage:
 *   node scripts/verify-sitemap-parity.mjs                  # diff all chunks
 *   node scripts/verify-sitemap-parity.mjs 0.xml hubs.xml   # diff specific chunks
 *
 * Required env (same as scripts/generate-sitemaps.mjs):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 *
 * Expected drift: legacy b-N.xml files predating PR #213 use a different
 * indentation for `<url>` (no leading whitespace on the open tag). The new
 * generator emits `  <url>` (2 spaces), matching what l-N.xml/hubs.xml/0.xml
 * already use. URL content, lastmod, and ordering should match exactly.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createJiti } from "jiti";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");
const PUBLIC_SITEMAP = join(ROOT, "public", "sitemap");

const jiti = createJiti(import.meta.url, { interopDefault: true });
const generator = await jiti.import(
  join(ROOT, "src", "lib", "sitemap", "generator.ts"),
);

const requested = process.argv.slice(2);

function listChunks() {
  if (requested.length > 0) return requested;
  if (!existsSync(PUBLIC_SITEMAP)) {
    console.error(`No public/sitemap/ directory at ${PUBLIC_SITEMAP}`);
    process.exit(1);
  }
  return readdirSync(PUBLIC_SITEMAP).filter((f) => f.endsWith(".xml") && f !== "index.xml");
}

function summarise(xml) {
  return {
    bytes: xml.length,
    urls: (xml.match(/<loc>/g) || []).length,
    sha: (() => {
      // Cheap fingerprint without pulling in crypto — sum of char codes mod
      // a prime. Good enough to flag accidental drift.
      let h = 0;
      for (let i = 0; i < xml.length; i += 1) h = (h * 31 + xml.charCodeAt(i)) >>> 0;
      return h.toString(16);
    })(),
  };
}

function diffLines(a, b, maxLines = 5) {
  const aL = a.split("\n");
  const bL = b.split("\n");
  const out = [];
  const max = Math.max(aL.length, bL.length);
  for (let i = 0; i < max && out.length < maxLines; i += 1) {
    if (aL[i] !== bL[i]) {
      out.push(`  line ${i + 1}:`);
      out.push(`    legacy: ${JSON.stringify(aL[i]?.slice(0, 120))}`);
      out.push(`    new:    ${JSON.stringify(bL[i]?.slice(0, 120))}`);
    }
  }
  return out.join("\n");
}

const chunks = listChunks();
console.log(`Verifying ${chunks.length} chunk(s) against ${PUBLIC_SITEMAP}\n`);

let identicalCount = 0;
let driftCount = 0;
const failures = [];

for (const name of chunks) {
  const onDiskPath = join(PUBLIC_SITEMAP, name);
  if (!existsSync(onDiskPath)) {
    failures.push(`${name}: not present on disk`);
    continue;
  }

  let legacy;
  let fresh;
  try {
    legacy = readFileSync(onDiskPath, "utf8");
  } catch (e) {
    failures.push(`${name}: read failed — ${e.message}`);
    continue;
  }

  try {
    fresh = await generator.generateChunk(name);
  } catch (e) {
    failures.push(`${name}: regenerate failed — ${e.message}`);
    continue;
  }

  if (legacy === fresh) {
    identicalCount += 1;
    console.log(`  IDENTICAL  ${name} (${legacy.length.toLocaleString()} bytes)`);
    continue;
  }

  driftCount += 1;
  const a = summarise(legacy);
  const b = summarise(fresh);
  console.log(
    `  DRIFT      ${name}: legacy=${a.bytes}B/${a.urls}urls/${a.sha}  new=${b.bytes}B/${b.urls}urls/${b.sha}`,
  );
  const diff = diffLines(legacy, fresh);
  if (diff) console.log(diff);
}

console.log(
  `\nSummary: ${identicalCount} identical, ${driftCount} drift, ${failures.length} failure(s)`,
);
if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) console.log(`  ${f}`);
}
process.exit(failures.length > 0 ? 1 : 0);
