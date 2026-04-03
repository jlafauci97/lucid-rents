import { getSupabaseAdmin } from "shared/supabase-admin.ts";
import {
  NEWS_SOURCES,
  categorizeArticle,
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
  const content = (item["content:encoded"] || item.content || item.description) as string | undefined;
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

  for (const source of NEWS_SOURCES) {
    try {
      const feed = await parseRSS(source.feedUrl);
      const articles = (feed.items || [])
        .filter((item: Record<string, unknown>) => {
          const title = (item.title as string) || "";
          const link = (item.link as string) || (item.$_href as string) || "";
          if (!title || !link) return false;
          if (source.alwaysRelevant) return true;
          const rawContent = ((item["content:encoded"] || item.contentSnippet || item.content || item.description || "") as string);
          const excerpt = rawContent
            .replace(/<[^>]+>/g, "")
            .trim();
          return isHousingRelevant(title, excerpt);
        })
        .map((item: Record<string, unknown>) => {
          const title = (item.title as string)!;
          const link = (item.link as string) || (item.$_href as string) || "";
          const guid = (item.guid as string) || link;
          const isoDate = (item.pubDate as string) || (item.published as string) || (item.updated as string) || "";
          const publishedAt = isoDate || new Date().toISOString();
          const rawContent = ((item["content:encoded"] || item.contentSnippet || item.content || item.description || "") as string);
          const excerpt = rawContent
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);

          const author = (item["dc:creator"] as string) || (item.author as string) || null;

          return {
            guid,
            slug: generateArticleSlug(title, publishedAt),
            title: title.trim(),
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
