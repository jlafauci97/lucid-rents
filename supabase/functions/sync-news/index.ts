import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import {
  NEWS_SOURCES,
  type NewsSource,
  categorizeArticle,
  decodeHtmlEntities,
  generateArticleSlug,
  isHousingRelevant,
} from "shared/news-sources.ts";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4.3.4";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "$_",
});

async function parseRSS(url: string) {
  const res = await fetch(url, {
    headers: { "User-Agent": "LucidRents/1.0 (https://lucidrents.com)" },
    signal: AbortSignal.timeout(10000),
  });
  const xml = await res.text();
  const parsed = xmlParser.parse(xml);
  const channel = parsed.rss?.channel || parsed.feed;
  const items = channel?.item || channel?.entry || [];
  return { items: Array.isArray(items) ? items : [items] };
}

/**
 * RSS fields are not reliably strings. fast-xml-parser returns an object when
 * an element carries attributes or CDATA (`{ "#text": "...", "$_type": "html" }`),
 * and the old `as string` casts lied about that — Chicago Sun-Times failed every
 * run with "rawContent.replace is not a function" and contributed 0 articles.
 */
function toText(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (v && typeof v === "object") {
    const text = (v as Record<string, unknown>)["#text"];
    if (typeof text === "string") return text;
    if (typeof text === "number") return String(text);
  }
  return "";
}

/** First field that yields non-empty text, in descending order of richness. */
function pickContent(item: Record<string, unknown>): string {
  for (const key of ["content:encoded", "contentSnippet", "content", "description", "summary"]) {
    const text = toText(item[key]);
    if (text) return text;
  }
  return "";
}

/**
 * Article URL. RSS puts it in <link>text</link>, but Atom uses an attribute-only
 * element — `<link rel="alternate" href="..."/>` — which the parser turns into
 * `{ $_href, $_rel }` with no text node, and feeds may carry several. Chicago
 * Sun-Times is Atom: before this, every entry resolved to an empty link and was
 * dropped by the title/link filter, so the source added 0 articles.
 */
function pickLink(item: Record<string, unknown>): string {
  const hrefOf = (v: unknown): string => {
    const text = toText(v);
    if (text) return text;
    if (v && typeof v === "object") {
      const href = (v as Record<string, unknown>).$_href;
      if (typeof href === "string") return href;
    }
    return "";
  };

  const raw = item.link;
  if (Array.isArray(raw)) {
    const alternate = raw.find(
      (l) => l && typeof l === "object" && (l as Record<string, unknown>).$_rel === "alternate"
    );
    const fromAlternate = hrefOf(alternate);
    if (fromAlternate) return fromAlternate;
    for (const l of raw) {
      const href = hrefOf(l);
      if (href) return href;
    }
    return "";
  }

  return hrefOf(raw) || toText(item.$_href) || toText(item.id);
}

/** Atom nests the author as `<author><name>…</name></author>`. */
function pickAuthor(item: Record<string, unknown>): string | null {
  const direct = toText(item["dc:creator"]) || toText(item.author);
  if (direct) return direct;
  const author = item.author;
  if (author && typeof author === "object") {
    const name = toText((author as Record<string, unknown>).name);
    if (name) return name;
  }
  return null;
}

/**
 * Try to extract an image URL from RSS item metadata.
 */
function extractImageUrl(item: Record<string, unknown>): string | null {
  // media:content or media:thumbnail
  const media = item["media:content"] as
    | { $_url?: string } | undefined;
  if (media?.$_url) return media.$_url;

  const thumb = item["media:thumbnail"] as
    | { $_url?: string } | undefined;
  if (thumb?.$_url) return thumb.$_url;

  // enclosure
  const enclosure = item.enclosure as
    | { $_url?: string; $_type?: string } | undefined;
  if (enclosure?.$_url && enclosure.$_type?.startsWith("image/")) {
    return enclosure.$_url;
  }

  // Fall back to first <img> in content HTML
  // pickContent (not a raw cast) — same object-shaped-field hazard as above.
  const content = pickContent(item);
  if (content) {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/);
    if (match?.[1]) return match[1];
  }

  return null;
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
  const results: { source: string; added: number; error?: string }[] = [];

  // Miami/Houston (July 2026) and LA/Chicago (August 2026) feeds are skipped
  // while those metros are off the public site — feed definitions stay in
  // _shared/news-sources.ts for relaunch.
  const DISABLED_METROS = new Set(["miami", "houston", "los-angeles", "chicago"]);
  const activeSources = NEWS_SOURCES.filter((s: NewsSource) => !s.metro || !DISABLED_METROS.has(s.metro));

  for (const source of activeSources) {
    try {
      const feed = await parseRSS(source.feedUrl);
      const articles = (feed.items || [])
        .filter((item: Record<string, unknown>) => {
          const title = toText(item.title);
          const link = pickLink(item);
          if (!title || !link) return false;
          if (source.alwaysRelevant) return true;
          const excerpt = pickContent(item)
            .replace(/<[^>]+>/g, "")
            .trim();
          return isHousingRelevant(title, excerpt);
        })
        .map((item: Record<string, unknown>) => {
          const title = toText(item.title);
          const link = pickLink(item);
          const guid = toText(item.guid) || link;
          const isoDate = toText(item.pubDate) || toText(item.published) || toText(item.updated);
          const publishedAt = isoDate || new Date().toISOString();
          const excerpt = pickContent(item)
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);

          const author = pickAuthor(item);

          return {
            guid,
            slug: generateArticleSlug(title, publishedAt),
            title: decodeHtmlEntities(title).trim(),
            excerpt: excerpt || null,
            url: link,
            source_name: source.name,
            source_slug: source.slug,
            category: categorizeArticle(
              title,
              excerpt,
              source.defaultCategory
            ),
            image_url: extractImageUrl(item) || null,
            author,
            published_at: publishedAt,
            metro: source.metro || "nyc",
          };
        });

      if (articles.length === 0) {
        results.push({ source: source.name, added: 0 });
        continue;
      }

      // Upsert with ON CONFLICT (guid) DO NOTHING to skip duplicates
      const { error } = await supabase
        .from("news_articles")
        .upsert(articles, { onConflict: "guid", ignoreDuplicates: true });

      if (error) {
        results.push({ source: source.name, added: 0, error: error.message });
      } else {
        results.push({ source: source.name, added: articles.length });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ source: source.name, added: 0, error: message });
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  }), {
    headers: { "Content-Type": "application/json" },
  });
});
