import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, breadcrumbJsonLd } from "@/lib/seo";
import { newsCollectionJsonLd } from "@/lib/seo";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-sources";
import { NewsList } from "@/components/news/NewsList";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import type { NewsArticle } from "@/types";

export const revalidate = 1800; // 30 minutes

const PER_PAGE = 20;

export const metadata: Metadata = {
  title: "NYC Housing News | Lucid Rents",
  description:
    "Stay informed with the latest NYC rental market news, tenant rights updates, housing policy changes, and guides for New York City renters.",
  alternates: { canonical: canonicalUrl("/news") },
  openGraph: {
    title: "NYC Housing News — Lucid Rents",
    description:
      "Latest NYC rental market news, tenant rights updates, and housing guides for New York City renters.",
    url: canonicalUrl("/news"),
    siteName: "Lucid Rents",
    type: "website",
    locale: "en_US",
  },
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * PER_PAGE;

  const supabase = await createClient();

  const { count } = await supabase
    .from("news_articles")
    .select("id", { count: "exact", head: true });

  const { data: articles } = await supabase
    .from("news_articles")
    .select("*")
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  const categories = Object.entries(NEWS_CATEGORIES) as [
    NewsCategory,
    { label: string; description: string },
  ][];

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(newsCollectionJsonLd()),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd([
                { name: "Home", url: "/" },
                { name: "News", url: "/news" },
              ])
            ),
          }}
        />

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            NYC Housing News
          </h1>
          <p className="text-sm text-[#64748b] mt-1">
            Latest news on NYC rentals, tenant rights, and housing policy
          </p>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href="/news"
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-[#0F1D2E] text-white"
          >
            All
          </Link>
          {categories.map(([slug, meta]) => (
            <Link
              key={slug}
              href={`/news/${slug}`}
              className="px-3 py-1.5 text-sm font-medium rounded-full bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] transition-colors"
            >
              {meta.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Main content */}
          <div className="min-w-0">
            <NewsList
              articles={(articles as NewsArticle[]) || []}
              page={page}
              totalCount={count || 0}
              perPage={PER_PAGE}
              basePath="/news"
            />
          </div>

          {/* Sidebar */}
          <aside className="hidden lg:block space-y-6">
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0]">
                <h3 className="text-sm font-bold text-[#0F1D2E]">
                  Categories
                </h3>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {categories.map(([slug, meta]) => (
                  <Link
                    key={slug}
                    href={`/news/${slug}`}
                    className="block px-4 py-3 hover:bg-[#f8fafc] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#0F1D2E]">
                      {meta.label}
                    </p>
                    <p className="text-xs text-[#94a3b8] mt-0.5">
                      {meta.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
            <AdBlock adSlot="NEWS_SIDEBAR" adFormat="rectangle" />
          </aside>
        </div>
      </div>
    </AdSidebar>
  );
}
