import { notFound } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonicalUrl, cityPath, landlordUrl } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import {
  fetchLandlordDirectoryPage,
  LANDLORD_PAGE_SIZE,
} from "@/lib/landlords/query";
import type { Metadata } from "next";

// Deep pages of the landlord directory: /nyc/landlords/page/2. Server-rendered
// and self-canonical so crawlers can walk the ~870K-landlord corpus — the
// interactive directory on the base /landlords URL keeps its client-side
// sort/search/page state, which never reached the HTML. /page/1 301s to the
// base URL in proxy.ts.
export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

interface PageProps {
  params: Promise<{ city: string; n: string }>;
}

function parsePageParam(n: string): number | null {
  if (!/^\d{1,6}$/.test(n)) return null;
  const page = Number(n);
  return page >= 2 ? page : null;
}

function pagePath(city: City, page: number): string {
  const base = cityPath("/landlords", city);
  return page <= 1 ? base : `${base}/page/${page}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { city, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(city)) return { title: "Not Found" };
  const cityName = CITY_META[city as City].name;
  const title = `${cityName} Landlords — Page ${page}`;
  const description = `Directory of ${cityName} landlords ranked by violations, with building counts and tenant review scores.`;
  const url = canonicalUrl(pagePath(city as City, page));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Lucid Rents", type: "website" },
  };
}

export default async function LandlordsDeepPage({ params }: PageProps) {
  const { city: cityParam, n } = await params;
  const page = parsePageParam(n);
  if (!page || !isValidCity(cityParam)) notFound();
  const city = cityParam as City;

  let landlords: Awaited<ReturnType<typeof fetchLandlordDirectoryPage>>["landlords"] = [];
  let total = 0;
  try {
    const res = await fetchLandlordDirectoryPage({ city, page });
    landlords = res.landlords;
    total = res.total;
  } catch (err) {
    console.error("LandlordsDeepPage query error:", err);
  }

  // Past the end of the real list → 404, not an empty self-canonical page.
  if (landlords.length === 0) notFound();

  const offset = (page - 1) * LANDLORD_PAGE_SIZE;
  const totalPages = Math.ceil(total / LANDLORD_PAGE_SIZE);
  const cityName = CITY_META[city].name;
  const prevUrl = canonicalUrl(pagePath(city, page - 1));
  const nextUrl = page < totalPages ? canonicalUrl(pagePath(city, page + 1)) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${cityName} Landlords — Page ${page}`,
    numberOfItems: total,
    itemListElement: landlords
      .filter((l) => l.slug)
      .map((l, i) => ({
        "@type": "ListItem",
        position: offset + i + 1,
        name: l.name ?? l.slug,
        url: canonicalUrl(landlordUrl(l.slug!, city)),
      })),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <link rel="prev" href={prevUrl} />
      {nextUrl && <link rel="next" href={nextUrl} />}
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Landlords", href: cityPath("/landlords", city) },
          { label: `Page ${page}`, href: pagePath(city, page) },
        ]}
      />

      <h1 className="text-3xl font-bold text-[#0F1D2E] mt-6 mb-2">
        {cityName} Landlords — Page {page}
      </h1>
      <p className="text-[#64748b] mb-6">
        {total.toLocaleString()} landlords ranked by total violations
      </p>

      <ol className="space-y-2" start={offset + 1}>
        {landlords.map((l) =>
          l.slug ? (
            <li
              key={l.slug}
              className="flex items-baseline justify-between gap-4 rounded-lg border border-gray-100 px-4 py-3"
            >
              <Link
                href={landlordUrl(l.slug, city)}
                className="font-medium text-[#0F1D2E] hover:underline"
              >
                {l.name ?? l.slug}
              </Link>
              <span className="text-sm text-[#64748b] whitespace-nowrap">
                {(l.buildingCount ?? 0).toLocaleString()} buildings ·{" "}
                {(l.totalViolations ?? 0).toLocaleString()} violations
              </span>
            </li>
          ) : null,
        )}
      </ol>

      <div className="flex justify-center gap-2 mt-8">
        <Link
          href={pagePath(city, page - 1)}
          className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
        >
          Previous
        </Link>
        <span className="px-4 py-2 text-sm text-[#64748b]">
          Page {page} of {totalPages.toLocaleString()}
        </span>
        {nextUrl && (
          <Link
            href={pagePath(city, page + 1)}
            className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[#0F1D2E] hover:bg-gray-200 transition-colors"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}
