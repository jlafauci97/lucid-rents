import { createCacheClient } from "@/lib/supabase/cache-client";
import { NewsList } from "@/components/news/NewsList";
import type { NewsArticle } from "@/types";

const PER_PAGE = 20;

export async function NewsListSection({
  city,
  page,
}: {
  city: string;
  page: number;
}) {
  const offset = (page - 1) * PER_PAGE;
  const supabase = createCacheClient();

  const { count } = await supabase
    .from("news_articles")
    .select("id", { count: "exact", head: true })
    .eq("metro", city);

  const { data: articles } = await supabase
    .from("news_articles")
    .select("*")
    .eq("metro", city)
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  return (
    <NewsList
      articles={(articles as NewsArticle[]) || []}
      page={page}
      totalCount={count || 0}
      perPage={PER_PAGE}
      basePath="/news"
    />
  );
}
