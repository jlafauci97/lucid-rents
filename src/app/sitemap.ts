import type { MetadataRoute } from "next";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

/**
 * Dynamic sitemap using Next.js conventions.
 *
 * Reads pre-generated XML files from public/sitemap/ at BUILD TIME and serves
 * them through Next.js routing (Vercel Functions) instead of as raw static
 * files. This avoids Cloudflare bot-protection blocking Google's crawler from
 * fetching static .xml assets.
 *
 * Data flow:
 *   1. `node scripts/generate-sitemaps.mjs` writes XML to public/sitemap/
 *   2. At build time, this file reads those XMLs and returns parsed entries
 *   3. Next.js generates /sitemap.xml (index) + /sitemap/0.xml … /sitemap/N.xml
 */

const SITEMAP_DIR = join(process.cwd(), "public", "sitemap");

/** Stable sort matching generate-sitemaps.mjs index ordering */
function sortKey(name: string): string {
  if (name === "0.xml") return "0-0";
  if (name.startsWith("l-"))
    return `1-${name.slice(2).replace(".xml", "").padStart(6, "0")}`;
  if (name.startsWith("b-"))
    return `2-${name.slice(2).replace(".xml", "").padStart(6, "0")}`;
  return name;
}

let _files: string[] | null = null;
function getSitemapFiles(): string[] {
  if (!_files) {
    _files = readdirSync(SITEMAP_DIR)
      .filter((f) => f.endsWith(".xml") && f !== "index.xml")
      .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  }
  return _files;
}

export async function generateSitemaps() {
  return getSitemapFiles().map((_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const files = getSitemapFiles();
  const filename = files[id];
  if (!filename) return [];

  const xml = readFileSync(join(SITEMAP_DIR, filename), "utf-8");
  const entries: MetadataRoute.Sitemap = [];

  // Parse <url> blocks from our well-structured generated XML
  const blocks = xml.split("<url>");
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const loc = block.match(/<loc>(.*?)<\/loc>/)?.[1];
    if (!loc) continue;

    const entry: MetadataRoute.Sitemap[number] = { url: loc };
    const lastmod = block.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
    if (lastmod) entry.lastModified = lastmod;
    const freq = block.match(/<changefreq>(.*?)<\/changefreq>/)?.[1];
    if (freq)
      entry.changeFrequency =
        freq as MetadataRoute.Sitemap[number]["changeFrequency"];
    const pri = block.match(/<priority>(.*?)<\/priority>/)?.[1];
    if (pri) entry.priority = Number(pri);

    entries.push(entry);
  }

  return entries;
}
