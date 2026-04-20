import { Suspense } from "react";
import { ArrowLeftRight, MapPin } from "lucide-react";
import Link from "next/link";
import { canonicalUrl, cityPath } from "@/lib/seo";
import { isValidCity, CITY_META, type City } from "@/lib/cities";
import { getNeighborhoodNameByCity } from "@/lib/neighborhoods";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Card, CardContent } from "@/components/ui/Card";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { NeighborhoodCompareSearch } from "@/components/neighborhood/NeighborhoodCompareSearch";
import {
  NeighborhoodCompareGrid,
  type NeighborhoodCompareData,
} from "@/components/neighborhood/NeighborhoodCompareGrid";
import type { Metadata } from "next";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ zips?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { city: cityParam } = await params;
  const city = isValidCity(cityParam) ? cityParam : "nyc";
  const cityName = CITY_META[city].fullName;
  return {
    title: `Compare ${cityName} Neighborhoods Side by Side | Lucid Rents`,
    description: `Compare ${cityName} neighborhoods on building quality, violations, crime, rents, and more. Pick the best area for your next apartment.`,
    alternates: {
      canonical: canonicalUrl(cityPath("/neighborhood/compare", city)),
    },
    openGraph: {
      title: `Compare ${cityName} Neighborhoods`,
      description: `Compare ${cityName} neighborhoods side by side — safety, building quality, violations, rents, and more.`,
      url: canonicalUrl(cityPath("/neighborhood/compare", city)),
      siteName: "Lucid Rents",
      type: "website",
    },
  };
}

async function fetchNeighborhoodStats(zipCode: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/neighborhood_stats`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_zip: zipCode }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] : data;
}

async function fetchCrimeData(zipCode: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/crime_by_zip_single`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ target_zip: zipCode }),
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Array.isArray(data) ? data[0] || null : data;
}

async function fetchMedianRents(zipCode: string) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/neighborhood_median_rents?zip_code=eq.${zipCode}&select=zip_code,bedrooms,median_rent`;
  const res = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return [];
  return res.json();
}

async function CompareContent({ params: paramsPromise, searchParams }: PageProps) {
  const { city: cityParam } = await paramsPromise;
  const city = (isValidCity(cityParam) ? cityParam : "nyc") as City;
  const cityName = CITY_META[city].name;
  const sp = await searchParams;
  const zipsParam = sp.zips || "";
  const zips = zipsParam
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean)
    .slice(0, 3);

  const selectedNames = zips.map((zip) => ({
    zip,
    name: getNeighborhoodNameByCity(zip, city) || zip,
    region: "",
  }));

  let neighborhoods: NeighborhoodCompareData[] = [];
  if (zips.length > 0) {
    const results = await Promise.all(
      zips.map(async (zip) => {
        const [stats, crime, medianRents] = await Promise.all([
          fetchNeighborhoodStats(zip),
          fetchCrimeData(zip),
          fetchMedianRents(zip),
        ]);
        if (!stats || stats.building_count === 0) return null;
        const name = getNeighborhoodNameByCity(zip, city) || zip;
        return {
          zipCode: zip,
          name,
          region: crime?.borough || "",
          stats,
          crime,
          medianRents,
        } satisfies NeighborhoodCompareData;
      })
    );
    neighborhoods = results.filter(
      (n): n is NeighborhoodCompareData => n !== null
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: cityName, href: cityPath("", city) },
          { label: "Neighborhoods", href: cityPath("/crime", city) },
          {
            label: "Compare",
            href: cityPath("/neighborhood/compare", city),
          },
        ]}
      />

      <div className="mb-8 mt-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ArrowLeftRight className="w-6 h-6 text-[#3B82F6]" />
          </div>
          <h1 className="text-2xl font-bold text-[#0F1D2E]">
            Compare {cityName} Neighborhoods
          </h1>
        </div>
        <p className="text-[#64748b] text-sm ml-[52px]">
          Compare up to 3 neighborhoods side by side on building quality,
          violations, crime, median rents, and more.
        </p>
      </div>

      <Card className="mb-8">
        <CardContent>
          <NeighborhoodCompareSearch
            selectedZips={zips}
            selectedNames={selectedNames}
          />
        </CardContent>
      </Card>

      {neighborhoods.length >= 2 ? (
        <Card>
          <CardContent className="p-0 sm:p-0">
            <NeighborhoodCompareGrid
              neighborhoods={neighborhoods}
              city={city}
            />
          </CardContent>
        </Card>
      ) : zips.length >= 1 && neighborhoods.length < zips.length ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <MapPin className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                No Data Found
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                We don&apos;t have data for one or more of the selected
                neighborhoods. Try a different zip code.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : neighborhoods.length === 1 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Add Another Neighborhood
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                You have 1 neighborhood selected. Add at least one more to
                start comparing.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <ArrowLeftRight className="w-12 h-12 text-[#e2e8f0] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#0F1D2E] mb-2">
                Start Comparing
              </h3>
              <p className="text-sm text-[#64748b] max-w-md mx-auto">
                Use the search above to find and add neighborhoods. Compare up
                to 3 neighborhoods at a time.
              </p>
              <Link
                href={cityPath("/crime", city)}
                className="inline-flex items-center gap-1.5 text-sm text-[#3B82F6] font-medium mt-4"
              >
                <MapPin className="w-4 h-4" />
                Browse all neighborhoods
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default async function NeighborhoodComparePage(props: PageProps) {
  return (
    <AdSidebar>
      <Suspense
        fallback={
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 w-64 bg-gray-200 rounded" />
              <div className="h-4 w-96 bg-gray-200 rounded" />
              <div className="h-48 bg-gray-200 rounded-xl" />
            </div>
          </div>
        }
      >
        <CompareContent {...props} />
      </Suspense>
    </AdSidebar>
  );
}
