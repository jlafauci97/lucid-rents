import { Metadata } from "next";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { canonicalUrl, cityPath, neighborhoodsUrl, breadcrumbJsonLd } from "@/lib/seo";
import { VALID_CITIES, CITY_META, type City } from "@/lib/cities";
import { JsonLd } from "@/components/seo/JsonLd";
import { NeighborhoodsCompareClient } from "./NeighborhoodsCompareClient";

export const revalidate = 86400; // 24h ISR — page is now a static shell

export function generateStaticParams() {
  return VALID_CITIES.map((city) => ({ city }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const meta = CITY_META[city as City];
  if (!meta) return {};
  return {
    title: `Compare ${meta.name} Neighborhoods | Lucid Rents`,
    description: `Compare ${meta.name} neighborhoods side by side. See which area has better grades, fewer violations, and safer streets.`,
    alternates: { canonical: canonicalUrl(cityPath("/neighborhoods/compare", city as City)) },
  };
}

export default async function CompareNeighborhoodsPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city: cityParam } = await params;
  const city = cityParam as City;
  const meta = CITY_META[city];
  if (!meta) return null;

  const breadcrumbs = [
    { label: "Home", href: "/" },
    { label: meta.name, href: cityPath("", city) },
    { label: "Neighborhoods", href: cityPath("/neighborhoods", city) },
    { label: "Compare", href: cityPath("/neighborhoods/compare", city) },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: meta.name, url: cityPath("", city) },
          { name: "Neighborhoods", url: neighborhoodsUrl(city) },
          { name: "Compare", url: cityPath("/neighborhoods/compare", city) },
        ])}
      />
      <Breadcrumbs items={breadcrumbs} />

      {/* Comparison UI lives in a client island so this page can be
          statically prerendered. The ?a=&b= params are read client-side. */}
      <NeighborhoodsCompareClient city={city} />
    </div>
  );
}
