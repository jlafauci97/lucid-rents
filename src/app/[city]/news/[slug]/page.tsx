import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ExternalLink, Clock, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, breadcrumbJsonLd, newsCollectionJsonLd, cityPath } from "@/lib/seo";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-sources";
import { NewsList } from "@/components/news/NewsList";
import { CategoryIcon } from "@/components/news/CategoryIcon";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { NewsCard } from "@/components/news/NewsCard";
import type { NewsArticle } from "@/types";

export const revalidate = 1800;

const PER_PAGE = 20;

function isCategory(slug: string): slug is NewsCategory {
  return slug in NEWS_CATEGORIES;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  // Category page metadata
  if (isCategory(slug)) {
    const meta = NEWS_CATEGORIES[slug];
    const title = `${meta.label} — NYC Housing News | Lucid Rents`;
    return {
      title,
      description: meta.description,
      alternates: { canonical: canonicalUrl(`/news/${slug}`) },
      openGraph: {
        title,
        description: meta.description,
        url: canonicalUrl(`/news/${slug}`),
        siteName: "Lucid Rents",
        type: "website",
        locale: "en_US",
      },
    };
  }

  // Article page metadata
  const supabase = await createClient();
  const { data: article } = await supabase
    .from("news_articles")
    .select("title, excerpt, source_name, published_at, category")
    .eq("slug", slug)
    .single();

  if (!article) return {};

  const title = `${article.title} | Lucid Rents News`;
  const description =
    article.excerpt ||
    `Read this ${article.category} article from ${article.source_name} on Lucid Rents.`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl(`/news/${slug}`) },
    openGraph: {
      title,
      description,
      url: canonicalUrl(`/news/${slug}`),
      siteName: "Lucid Rents",
      type: "article",
      locale: "en_US",
      publishedTime: article.published_at,
    },
  };
}

export const dynamicParams = true;

export default async function NewsSlugPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;

  if (isCategory(slug)) {
    return <CategoryView category={slug} searchParams={searchParams} />;
  }

  return <ArticleView slug={slug} />;
}

// ---- Category View ----

async function CategoryView({
  category,
  searchParams,
}: {
  category: NewsCategory;
  searchParams: Promise<{ page?: string }>;
}) {
  const meta = NEWS_CATEGORIES[category];
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page || "1", 10));
  const offset = (page - 1) * PER_PAGE;

  const supabase = await createClient();

  const { count } = await supabase
    .from("news_articles")
    .select("id", { count: "exact", head: true })
    .eq("category", category);

  const { data: articles } = await supabase
    .from("news_articles")
    .select("*")
    .eq("category", category)
    .order("published_at", { ascending: false })
    .range(offset, offset + PER_PAGE - 1);

  const categories = Object.entries(NEWS_CATEGORIES) as [
    NewsCategory,
    { label: string; description: string; icon: string; color: string },
  ][];

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
                { name: meta.label, url: `/news/${category}` },
              ])
            ),
          }}
        />

        <nav className="text-sm text-[#94a3b8] mb-4">
          <Link href="/" className="hover:text-[#3B82F6]">Home</Link>
          {" / "}
          <Link href={cityPath("/news")} className="hover:text-[#3B82F6]">News</Link>
          {" / "}
          <span className="text-[#0F1D2E] font-medium">{meta.label}</span>
        </nav>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#0F1D2E]">{meta.label}</h1>
          <p className="text-sm text-[#64748b] mt-1">{meta.description}</p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={cityPath("/news")}
            className="px-3 py-1.5 text-sm font-medium rounded-full bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0] transition-colors"
          >
            All
          </Link>
          {categories.map(([slug, catMeta]) => (
            <Link
              key={slug}
              href={`/news/${slug}`}
              className={`px-3 py-1.5 text-sm font-medium rounded-full transition-colors ${
                slug === category
                  ? "bg-[#0F1D2E] text-white"
                  : "bg-[#f1f5f9] text-[#475569] hover:bg-[#e2e8f0]"
              }`}
            >
              {catMeta.label}
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <div className="min-w-0">
            <NewsList
              articles={(articles as NewsArticle[]) || []}
              page={page}
              totalCount={count || 0}
              perPage={PER_PAGE}
              basePath={`/news/${category}`}
            />
          </div>

          <aside className="hidden lg:block space-y-6">
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-[#e2e8f0]">
                <h3 className="text-sm font-bold text-[#0F1D2E]">Categories</h3>
              </div>
              <div className="divide-y divide-[#f1f5f9]">
                {categories.map(([slug, catMeta]) => (
                  <Link
                    key={slug}
                    href={`/news/${slug}`}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                      slug === category ? "bg-[#EFF6FF]" : "hover:bg-[#f8fafc]"
                    }`}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: `${catMeta.color}15` }}
                    >
                      <CategoryIcon icon={catMeta.icon} color={catMeta.color} />
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${slug === category ? "text-[#3B82F6]" : "text-[#0F1D2E]"}`}>
                        {catMeta.label}
                      </p>
                      <p className="text-xs text-[#94a3b8] mt-0.5">{catMeta.description}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </AdSidebar>
  );
}

// ---- Article View ----

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function ArticleView({ slug }: { slug: string }) {
  const supabase = await createClient();

  const { data: article } = await supabase
    .from("news_articles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!article) notFound();

  const typedArticle = article as NewsArticle;
  const categoryMeta = NEWS_CATEGORIES[typedArticle.category as NewsCategory];

  const { data: related } = await supabase
    .from("news_articles")
    .select("*")
    .eq("category", typedArticle.category)
    .neq("id", typedArticle.id)
    .order("published_at", { ascending: false })
    .limit(4);

  return (
    <AdSidebar>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "NewsArticle",
              headline: typedArticle.title,
              description: typedArticle.excerpt,
              url: canonicalUrl(`/news/${slug}`),
              datePublished: typedArticle.published_at,
              publisher: {
                "@type": "Organization",
                name: typedArticle.source_name,
              },
              ...(typedArticle.author
                ? { author: { "@type": "Person", name: typedArticle.author } }
                : {}),
              ...(typedArticle.image_url
                ? { image: typedArticle.image_url }
                : {}),
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              breadcrumbJsonLd([
                { name: "Home", url: "/" },
                { name: "News", url: "/news" },
                ...(categoryMeta
                  ? [{ name: categoryMeta.label, url: `/news/${typedArticle.category}` }]
                  : []),
                { name: typedArticle.title, url: `/news/${slug}` },
              ])
            ),
          }}
        />

        <div className="flex items-center gap-4 mb-4">
          <Link
            href={cityPath("/news")}
            className="flex items-center gap-1 text-sm text-[#3B82F6] hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to News
          </Link>
        </div>

        <div className="mb-6">
          {categoryMeta && (
            <Link
              href={`/news/${typedArticle.category}`}
              className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#EFF6FF] text-[#3B82F6] mb-3 hover:bg-[#DBEAFE] transition-colors"
            >
              {categoryMeta.label}
            </Link>
          )}
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F1D2E] leading-tight mb-3">
            {typedArticle.title}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#64748b]">
            <span className="font-medium text-[#0F1D2E]">{typedArticle.source_name}</span>
            {typedArticle.author && <span>by {typedArticle.author}</span>}
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formatDate(typedArticle.published_at)}
            </span>
          </div>
        </div>

        {typedArticle.excerpt && (
          <div className="bg-[#f8fafc] rounded-xl border border-[#e2e8f0] p-4 mb-4">
            <p className="text-sm text-[#475569] leading-relaxed">{typedArticle.excerpt}</p>
          </div>
        )}

        <div className="rounded-xl border border-[#e2e8f0] overflow-hidden bg-white mb-6">
          <div className="flex items-center justify-between px-4 py-2 bg-[#f8fafc] border-b border-[#e2e8f0]">
            <span className="text-xs text-[#94a3b8]">Source: {typedArticle.source_name}</span>
            <a
              href={typedArticle.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-[#3B82F6] hover:underline"
            >
              Open original
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <iframe
            src={typedArticle.url}
            title={typedArticle.title}
            className="w-full border-0"
            style={{ height: "70vh", minHeight: "500px" }}
            sandbox="allow-scripts allow-same-origin allow-popups"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

        <div className="text-center mb-8">
          <p className="text-sm text-[#94a3b8] mb-2">
            Article not loading? Some sites restrict embedding.
          </p>
          <a
            href={typedArticle.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#3B82F6] border border-[#3B82F6] rounded-lg hover:bg-[#EFF6FF] transition-colors"
          >
            Read on {typedArticle.source_name}
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        <AdBlock adSlot="NEWS_ARTICLE_BOTTOM" adFormat="horizontal" />

        {related && related.length > 0 && (
          <div className="mt-8 pt-8 border-t border-[#e2e8f0]">
            <h2 className="text-lg font-bold text-[#0F1D2E] mb-4">Related Articles</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(related as NewsArticle[]).map((r) => (
                <NewsCard key={r.id} article={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </AdSidebar>
  );
}
