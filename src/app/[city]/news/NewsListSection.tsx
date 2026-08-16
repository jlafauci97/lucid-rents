import { createCacheClient } from "@/lib/supabase/cache-client";
import { NewsList } from "@/components/news/NewsList";
import type { NewsArticle } from "@/types";

const PER_PAGE = 20;

/**
 * Server-rendered news list — article links and pagination land in the HTML
 * (the previous client-fetch island left ~5K articles sitemap-only).
 * `basePath` must be the city-prefixed listing path (e.g. "/nyc/news" or
 * "/IL/Chicago/news/rental-market"); deep pages live at `${basePath}/page/N`.
 */
export async function NewsListSection({
  city,
  page,
  category,
  basePath,
}: {
  city: string;
  page: number;
  category?: string;
  basePath: string;
}) {
  const offset = (page - 1) * PER_PAGE;
  const supabase = createCacheClient();

  let countQuery = supabase
    .from("news_articles")
    .select("id", { count: "exact", head: true })
    .eq("metro", city);
  let listQuery = supabase
    .from("news_articles")
    .select("*")
    .eq("metro", city)
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);
  if (category) {
    countQuery = countQuery.eq("category", category);
    listQuery = listQuery.eq("category", category);
  }

  const [{ count }, { data: articles }] = await Promise.all([countQuery, listQuery]);

  return (
    <NewsList
      articles={(articles as NewsArticle[]) || []}
      page={page}
      totalCount={count || 0}
      perPage={PER_PAGE}
      basePath={basePath}
    />
  );
}
