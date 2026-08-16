/**
 * Nightly sitemap regeneration — runs on the always-on Mac mini via launchd
 * (scripts/launchd/com.lucidrents.sitemaps.plist), NOT on Vercel: enumerating
 * ~2.5M buildings + ~1M landlords takes longer than any Vercel function tier
 * allows. Writes every chunk to Vercel Blob; the site serves them through
 * src/app/sitemap-v2/[chunk] via the /sitemap/* rewrites in next.config.ts.
 *
 * Run manually with:  npx tsx scripts/generate-sitemaps-blob.mts
 *
 * Required env (loaded from .env.local like the other Mini scripts):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOB_READ_WRITE_TOKEN
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "BLOB_READ_WRITE_TOKEN",
]) {
  if (!process.env[key]) {
    console.error(`[generate-sitemaps-blob] missing env: ${key}`);
    process.exit(1);
  }
}

const { regenerateAllToBlob } = await import("../src/lib/sitemap/generator");

console.log(`[generate-sitemaps-blob] start ${new Date().toISOString()}`);
const result = await regenerateAllToBlob();
console.log(
  `[generate-sitemaps-blob] done in ${Math.round(result.durationMs / 1000)}s — ` +
    `${result.buildingChunks} building chunks, ${result.landlordChunks} landlord chunks, ` +
    `${result.staticUrls} static urls, ${result.hubsUrls} hub urls`,
);

if (!result.ok) {
  for (const err of result.errors) {
    console.error(`[generate-sitemaps-blob] ERROR: ${err}`);
  }
  process.exit(1);
}
