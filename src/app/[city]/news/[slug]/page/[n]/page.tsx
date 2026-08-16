import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { NEWS_CATEGORIES, type NewsCategory } from "@/lib/news-sources";
import { NewsListSection } from "../../../NewsListSection";

// Deep pages of a news CATEGORY: /nyc/news/rental-market/page/2. Article
// slugs have no deep pages — anything that isn't a category 404s here.
export const revalidate = 1800;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ city: string; slug: string; n: string }>;
}

function isCategory(slug: string): slug is NewsCategory {
  return slug in NEWS_CATEGORIES;
}

function parsePageParam(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, slug, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(city) || !isCategory(slug)) return { title: "Not Found" };
  const meta = NEWS_CATEGORIES[slug];
  const base = cityPath(`/news/${slug}`, city);
  return {
    title: `${meta.label} — ${CITY_META[city].fullName} Housing News — Page ${page}`,
    description: meta.description,
    alternates: { canonical: canonicalUrl(`${base}/page/${page}`) },
  };
}

export default async function NewsCategoryDeepPage({ params }: PageProps) {
  const { city, slug, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(city) || !isCategory(slug)) notFound();
  const typedCity = city as City;
  const meta = NEWS_CATEGORIES[slug as NewsCategory];
  const base = cityPath(`/news/${slug}`, typedCity);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "News", href: cityPath("/news", typedCity) },
          { label: meta.label, href: base },
          { label: `Page ${page}`, href: `${base}/page/${page}` },
        ]}
      />
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-6 mt-4">
        {meta.label} — Page {page}
      </h1>
      <NewsListSection city={city} page={page} category={slug} basePath={base} />
    </div>
  );
}
