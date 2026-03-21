import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Parser from "rss-parser";
import {
  NEWS_SOURCES,
  categorizeArticle,
  generateArticleSlug,
  isHousingRelevant,
} from "@/lib/news-sources";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "LucidRents/1.0 (https://lucidrents.com)",
  },
});

export async function GET(req: NextRequest) {
  // Auth check — prevent public triggering
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  const results: { source: string; added: number; error?: string }[] = [];

  for (const source of NEWS_SOURCES) {
    try {
      const feed = await parser.parseURL(source.feedUrl);
      const articles = (feed.items || [])
        .filter((item) => {
          if (!item.title || !item.link) return false;
          if (source.alwaysRelevant) return true;
          const excerpt = (item.contentSnippet || item.content || "")
            .replace(/<[^>]+>/g, "")
            .trim();
          return isHousingRelevant(item.title, excerpt);
        })
        .map((item) => {
          const guid = item.guid || item.link!;
          const publishedAt =
            item.isoDate || item.pubDate || new Date().toISOString();
          const excerpt = (item.contentSnippet || item.content || "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);

          return {
            guid,
            slug: generateArticleSlug(item.title!, publishedAt),
            title: item.title!.trim(),
            excerpt: excerpt || null,
            url: item.link!,
            source_name: source.name,
            source_slug: source.slug,
            category: categorizeArticle(
              item.title!,
              excerpt,
              source.defaultCategory
            ),
            image_url: extractImageUrl(item) || null,
            author: item.creator || item["dc:creator"] || null,
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

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    results,
  });
}

/**
 * Try to extract an image URL from RSS item metadata.
 */
function extractImageUrl(item: Record<string, unknown>): string | null {
  // media:content or media:thumbnail
  const media = item["media:content"] as
    | { $?: { url?: string } }
    | undefined;
  if (media?.$?.url) return media.$.url;

  const thumb = item["media:thumbnail"] as
    | { $?: { url?: string } }
    | undefined;
  if (thumb?.$?.url) return thumb.$.url;

  // enclosure
  const enclosure = item.enclosure as
    | { url?: string; type?: string }
    | undefined;
  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    return enclosure.url;
  }

  // Fall back to first <img> in content HTML
  const content = item.content as string | undefined;
  if (content) {
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/);
    if (match?.[1]) return match[1];
  }

  return null;
}
