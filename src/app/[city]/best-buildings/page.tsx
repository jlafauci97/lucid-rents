import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { chipsForCity } from "@/lib/best-buildings/chips";
import { getChipSummary } from "@/lib/best-buildings/query";
import { CategoryCard } from "@/components/best-buildings/CategoryCard";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { JsonLd } from "@/components/seo/JsonLd";

export const revalidate = 3600; // 1 hour

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  if (!isValidCity(city)) return {};
  const meta = CITY_META[city];
  return {
    title: `Best Buildings in ${meta.fullName} — Curated Lists | Lucid Rents`,
    description: `Top-rated, rent-stabilized, most-reviewed, and more — curated ${meta.fullName} building lists based on real tenant data.`,
    alternates: { canonical: canonicalUrl(cityPath("/best-buildings", city)) },
    openGraph: {
      title: `Best Buildings in ${meta.fullName}`,
      description: `Curated ${meta.fullName} apartment-building lists based on LucidIQ scores and real tenant reviews.`,
      url: canonicalUrl(cityPath("/best-buildings", city)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  const { VALID_CITIES } = await import("@/lib/cities");
  return VALID_CITIES.map((c) => ({ city: c }));
}

export default async function BestBuildingsIndex({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  if (!isValidCity(cityParam)) notFound();
  const city = cityParam as City;
  const meta = CITY_META[city];
  const chips = chipsForCity(city);

  const supabase = await createClient();
  const summaries = await Promise.all(
    chips.map(async (chip) => ({
      chip,
      ...(await getChipSummary(supabase, city, chip.id)),
    })),
  );

  const visible = summaries.filter((s) => s.count > 0);

  return (
    <AdSidebar>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Best Buildings in ${meta.fullName}`,
          url: `https://lucidrents.com${cityPath("/best-buildings", city)}`,
          description: `Curated ${meta.fullName} apartment-building lists.`,
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: meta.fullName, href: cityPath("/", city) },
            { label: "Best Buildings", href: cityPath("/best-buildings", city) },
          ]}
        />

        <header className="mt-6 mb-10 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.18em] text-[#3B82F6] font-medium">
            Best Buildings · {meta.fullName}
          </p>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#0F1D2E] mt-2 leading-[1.05] tracking-tight">
            Curated lists for renters.
          </h1>
          <p className="text-base sm:text-lg text-[#334155] leading-relaxed mt-4">
            Every category below is filtered from the live {meta.fullName} building
            dataset — no sponsored placements, no paid boosts. Pick one to see
            the full list.
          </p>
        </header>

        {visible.length === 0 ? (
          <div className="border border-dashed border-[#e2e8f0] rounded-lg p-12 text-center">
            <p className="text-[#64748b]">
              No curated lists available yet for {meta.fullName}. Coming soon.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map(({ chip, count, avg_score }) => (
              <CategoryCard
                key={chip.id}
                chip={chip}
                cityUrlPrefix={meta.urlPrefix}
                count={count}
                avgScore={avg_score}
              />
            ))}
          </div>
        )}

        <div className="mt-16 pt-10 border-t border-[#e2e8f0]">
          <h2 className="font-serif text-2xl text-[#0F1D2E]">
            Looking for something else?
          </h2>
          <p className="text-sm text-[#64748b] mt-2 mb-4">
            Search every building in {meta.fullName} or browse by neighborhood.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={cityPath("/search", city)}
              className="px-4 py-2 rounded-full bg-[#0F1D2E] text-white text-sm font-medium hover:bg-[#3B82F6] transition"
            >
              Search buildings →
            </Link>
            <Link
              href={cityPath("/neighborhoods", city)}
              className="px-4 py-2 rounded-full border border-[#e2e8f0] text-[#0F1D2E] text-sm font-medium hover:border-[#0F1D2E] transition"
            >
              Browse by neighborhood
            </Link>
          </div>
        </div>
      </div>
    </AdSidebar>
  );
}
