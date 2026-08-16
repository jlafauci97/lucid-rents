import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { NewsListSection } from "../../NewsListSection";

// Deep pages of the news index: /nyc/news/page/2. Path segments so each page
// is ISR-cacheable and self-canonical; page 1 is the bare /news URL.
export const revalidate = 1800;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ city: string; n: string }>;
}

function parsePageParam(n: string): number | null {
  if (!/^\d{1,4}$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 ? page : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(city)) return { title: "Not Found" };
  const meta = CITY_META[city];
  const base = cityPath("/news", city);
  return {
    title: `${meta.fullName} Housing News — Page ${page}`,
    description: `The latest ${meta.fullName} housing news that actually affects renters — policy changes, tenant rights updates, and market shifts.`,
    alternates: { canonical: canonicalUrl(`${base}/page/${page}`) },
  };
}

export default async function NewsDeepPage({ params }: PageProps) {
  const { city, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(city)) notFound();
  const base = cityPath("/news", city as City);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "News", href: base },
          { label: `Page ${page}`, href: `${base}/page/${page}` },
        ]}
      />
      <h1 className="text-2xl font-bold text-[#0F1D2E] mb-6 mt-4">
        {CITY_META[city as City].fullName} Housing News — Page {page}
      </h1>
      <NewsListSection city={city} page={page} basePath={base} />
    </div>
  );
}
