import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { MapPin, Users, Search as SearchIcon } from "lucide-react";

import { BuildingCard } from "@/components/search/BuildingCard";
import { TrendingBuildings } from "@/components/search/TrendingBuildings";
import { Skeleton } from "@/components/ui/Skeleton";
import { JsonLd } from "@/components/seo/JsonLd";
import { CityProvider } from "@/lib/city-context";

import { createCacheClient } from "@/lib/supabase/cache-client";
import {
  CITY_META,
  CITY_SHORT_NAME,
  VALID_CITIES,
  isValidCity,
  type City,
} from "@/lib/cities";
import {
  canonicalUrl,
  cityPath,
  landlordUrl,
  neighborhoodUrl,
} from "@/lib/seo";
import { searchNeighborhoodsByCity } from "@/lib/neighborhoods";
import { normalizeAddressQuery } from "@/lib/address-normalization";
import type { Building } from "@/types";

export const revalidate = 300;

interface GlobalSearchPageProps {
  searchParams: Promise<{ q?: string; city?: string }>;
}

export async function generateMetadata({
  searchParams,
}: GlobalSearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const cityParam = params.city && isValidCity(params.city) ? params.city : null;
  const cityName = cityParam ? CITY_META[cityParam].fullName : null;

  if (q) {
    const scope = cityName ? `${cityName}` : "NYC, LA, Chicago, Miami, and Houston";
    const title = `Search: ${q} | Lucid Rents`;
    const description = `Results for "${q}" across ${scope} — buildings, landlords, and neighborhoods with violations, complaints, and tenant reviews.`;
    const path = cityParam ? `/search?q=${encodeURIComponent(q)}&city=${cityParam}` : `/search?q=${encodeURIComponent(q)}`;
    return {
      title,
      description,
      alternates: { canonical: canonicalUrl(path) },
      openGraph: { title, description, url: canonicalUrl(path), siteName: "Lucid Rents", type: "website" },
    };
  }

  const title = "Search Lucid Rents — NYC, LA, Chicago, Miami, Houston";
  const description =
    "Search any apartment building, landlord, or neighborhood across NYC, LA, Chicago, Miami, and Houston. Violations, complaints, tenant reviews, and rent data.";
  return {
    title,
    description,
    alternates: { canonical: canonicalUrl("/search") },
    openGraph: { title, description, url: canonicalUrl("/search"), siteName: "Lucid Rents", type: "website" },
  };
}

interface LandlordRow {
  name: string;
  slug: string | null;
  metro: City;
  building_count: number | null;
  total_violations: number | null;
}

interface NeighborhoodHit {
  zipCode: string;
  name: string;
  region: string;
  city: City;
}

async function fetchCrossCityResults(q: string, cityFilter: City | null) {
  const supabase = createCacheClient();
  const { abbreviated, expanded } = normalizeAddressQuery(q);

  const buildingsPromise = (async () => {
    try {
      const { data, error } = await supabase.rpc("search_buildings_ranked", {
        search_query: abbreviated,
        search_query_alt: abbreviated !== expanded ? expanded : null,
        city_filter: cityFilter,
        borough_filter: null,
        zip_filter: null,
        sort_by: "relevance",
        page_offset: 0,
        page_limit: 10,
      });
      if (error || !data) return [] as Building[];
      return (data as Record<string, unknown>[]).map((row) => {
        const { total_count: _ignored, ...building } = row;
        return building as unknown as Building;
      });
    } catch {
      return [] as Building[];
    }
  })();

  const landlordsPromise = (async () => {
    try {
      let q1 = supabase
        .from("landlord_stats")
        .select("name, slug, metro, building_count, total_violations")
        .ilike("name", `%${q}%`)
        .order("total_violations", { ascending: false, nullsFirst: false })
        .limit(5);
      if (cityFilter) {
        q1 = q1.eq("metro", cityFilter);
      }
      const { data, error } = await q1;
      if (error || !data) return [] as LandlordRow[];
      return data.filter((row): row is LandlordRow => isValidCity(row.metro as string));
    } catch {
      return [] as LandlordRow[];
    }
  })();

  const [buildings, landlords] = await Promise.all([buildingsPromise, landlordsPromise]);

  const neighborhoods: NeighborhoodHit[] = [];
  const cities: readonly City[] = cityFilter ? [cityFilter] : VALID_CITIES;
  for (const c of cities) {
    for (const n of searchNeighborhoodsByCity(q, c, 3)) {
      neighborhoods.push({ ...n, city: c });
      if (neighborhoods.length >= 5) break;
    }
    if (neighborhoods.length >= 5) break;
  }

  return { buildings, landlords, neighborhoods };
}

function CityChipStrip({ q, active }: { q: string; active: City | null }) {
  const baseClass =
    "inline-flex items-center px-3 py-1.5 rounded-full border text-xs font-medium transition-colors whitespace-nowrap";
  const activeClass = "bg-[#3B82F6] text-white border-[#3B82F6]";
  const idleClass = "bg-white text-[#0F1D2E] border-[#e2e8f0] hover:bg-gray-50";

  const allHref = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={allHref} className={`${baseClass} ${active === null ? activeClass : idleClass}`}>
        All cities
      </Link>
      {VALID_CITIES.map((c) => {
        const isActive = active === c;
        const href = q
          ? `/search?q=${encodeURIComponent(q)}&city=${c}`
          : `/search?city=${c}`;
        return (
          <Link key={c} href={href} className={`${baseClass} ${isActive ? activeClass : idleClass}`}>
            {CITY_META[c].name}
          </Link>
        );
      })}
      {q && (
        <span className="text-xs text-[#94a3b8] ml-1">
          or jump to a city directly:
          {VALID_CITIES.map((c, i) => (
            <span key={c}>
              {" "}
              <Link
                href={`${cityPath("/search", c)}?q=${encodeURIComponent(q)}`}
                className="text-[#3B82F6] hover:underline"
              >
                {CITY_SHORT_NAME[c]} only
              </Link>
              {i < VALID_CITIES.length - 1 ? " ·" : ""}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}

function SearchFormHeader({ q, cityFilter }: { q: string; cityFilter: City | null }) {
  return (
    <form action="/search" method="get" className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94a3b8]" />
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search by address, neighborhood, zip, or landlord…"
          className="w-full bg-white text-[#0F1D2E] placeholder-[#94a3b8] border border-[#e2e8f0] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6] focus:border-transparent shadow-sm"
          aria-label="Search"
        />
      </div>
      {cityFilter && <input type="hidden" name="city" value={cityFilter} />}
      <button
        type="submit"
        className="inline-flex items-center justify-center px-5 py-3 rounded-xl bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold shadow-sm"
      >
        Search
      </button>
    </form>
  );
}

function CityBadge({ city }: { city: City }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-[10px] font-semibold uppercase tracking-wider">
      {CITY_META[city].name}
    </span>
  );
}

function BuildingResultsSection({ buildings }: { buildings: Building[] }) {
  if (buildings.length === 0) return null;
  return (
    <section aria-labelledby="buildings-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="buildings-heading" className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
          Buildings
        </h2>
        <span className="text-xs text-[#94a3b8]">Top {buildings.length} across all cities</span>
      </div>
      <div className="space-y-4">
        {buildings.map((building) => {
          const buildingCity: City = isValidCity(building.metro as string)
            ? (building.metro as City)
            : "nyc";
          return (
            <div key={building.id} className="relative">
              <div className="absolute top-3 right-3 z-10 pointer-events-none">
                <CityBadge city={buildingCity} />
              </div>
              <CityProvider city={buildingCity}>
                <BuildingCard building={building} />
              </CityProvider>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LandlordResultsSection({ landlords }: { landlords: LandlordRow[] }) {
  if (landlords.length === 0) return null;
  return (
    <section aria-labelledby="landlords-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="landlords-heading" className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
          Landlords
        </h2>
      </div>
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm divide-y divide-[#f1f5f9] overflow-hidden">
        {landlords.map((landlord) => {
          const meta = [
            landlord.building_count
              ? `${landlord.building_count.toLocaleString()} building${landlord.building_count !== 1 ? "s" : ""}`
              : null,
            landlord.total_violations
              ? `${landlord.total_violations.toLocaleString()} violation${landlord.total_violations !== 1 ? "s" : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <Link
              key={`${landlord.metro}:${landlord.name}`}
              href={landlordUrl(landlord.name, landlord.metro)}
              className="flex items-start gap-3 px-5 py-3 hover:bg-[#f8fafc] transition-colors"
            >
              <Users className="w-5 h-5 text-[#94a3b8] mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#0F1D2E] truncate">{landlord.name}</p>
                {meta && <p className="text-xs text-[#64748b]">{meta}</p>}
              </div>
              <CityBadge city={landlord.metro} />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function NeighborhoodResultsSection({ neighborhoods }: { neighborhoods: NeighborhoodHit[] }) {
  if (neighborhoods.length === 0) return null;
  return (
    <section aria-labelledby="neighborhoods-heading">
      <div className="flex items-center justify-between mb-3">
        <h2 id="neighborhoods-heading" className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider">
          Neighborhoods
        </h2>
      </div>
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm divide-y divide-[#f1f5f9] overflow-hidden">
        {neighborhoods.map((n) => (
          <Link
            key={`${n.city}:${n.zipCode}`}
            href={neighborhoodUrl(n.zipCode, n.city)}
            className="flex items-start gap-3 px-5 py-3 hover:bg-[#f8fafc] transition-colors"
          >
            <MapPin className="w-5 h-5 text-[#3B82F6] mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0F1D2E]">{n.name}</p>
              <p className="text-xs text-[#64748b]">
                {n.zipCode} &middot; {n.region}
              </p>
            </div>
            <CityBadge city={n.city} />
          </Link>
        ))}
      </div>
    </section>
  );
}

async function CrossCityResults({ q, cityFilter }: { q: string; cityFilter: City | null }) {
  const { buildings, landlords, neighborhoods } = await fetchCrossCityResults(q, cityFilter);

  const total = buildings.length + landlords.length + neighborhoods.length;
  if (total === 0) {
    return (
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-10 text-center">
        <p className="text-[#0F1D2E] text-base font-medium">
          No results for &ldquo;{q}&rdquo;
        </p>
        <p className="text-sm text-[#94a3b8] mt-2">
          Try a full address, a zip code, a landlord name, or a neighborhood. You can also{" "}
          {VALID_CITIES.map((c, i) => (
            <span key={c}>
              <Link
                href={`${cityPath("/search", c)}?q=${encodeURIComponent(q)}`}
                className="text-[#3B82F6] hover:underline"
              >
                search {CITY_SHORT_NAME[c]} directly
              </Link>
              {i < VALID_CITIES.length - 1 ? ", " : "."}
            </span>
          ))}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BuildingResultsSection buildings={buildings} />
      <LandlordResultsSection landlords={landlords} />
      <NeighborhoodResultsSection neighborhoods={neighborhoods} />
    </div>
  );
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-[#e2e8f0] p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-14 h-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-10 text-center">
        <SearchIcon className="w-10 h-10 mx-auto text-[#cbd5e1]" />
        <p className="mt-4 text-[#0F1D2E] text-base font-semibold">
          Search any building in NYC, LA, Chicago, Miami, or Houston
        </p>
        <p className="mt-2 text-sm text-[#64748b] max-w-md mx-auto">
          Look up an address, neighborhood, zip code, or landlord. We&rsquo;ll show violations,
          complaints, tenant reviews, and safety data — all in one place.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {VALID_CITIES.map((c) => (
            <Link
              key={c}
              href={cityPath("/search", c)}
              className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] text-xs font-semibold hover:bg-[#DBEAFE]"
            >
              Browse {CITY_META[c].name}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <Suspense fallback={<ResultsSkeleton />}>
          <TrendingBuildings city="nyc" />
        </Suspense>
      </div>
    </div>
  );
}

export default async function GlobalSearchPage({ searchParams }: GlobalSearchPageProps) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const cityFilter: City | null =
    params.city && isValidCity(params.city) ? params.city : null;

  const canonicalPath = q
    ? cityFilter
      ? `/search?q=${encodeURIComponent(q)}&city=${cityFilter}`
      : `/search?q=${encodeURIComponent(q)}`
    : "/search";

  const jsonLd = q
    ? {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        url: canonicalUrl(canonicalPath),
        name: `Search: ${q}`,
        description: `Cross-city search results for "${q}" across NYC, LA, Chicago, Miami, and Houston.`,
        about: { "@type": "Thing", name: q },
      }
    : {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        url: canonicalUrl("/search"),
        name: "Search Lucid Rents",
        description:
          "Search any apartment building, landlord, or neighborhood across NYC, LA, Chicago, Miami, and Houston.",
      };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 sm:p-5 mb-5">
          <SearchFormHeader q={q} cityFilter={cityFilter} />
          <div className="mt-4">
            <CityChipStrip q={q} active={cityFilter} />
          </div>
        </div>

        {q ? (
          <Suspense fallback={<ResultsSkeleton />}>
            <CrossCityResults q={q} cityFilter={cityFilter} />
          </Suspense>
        ) : (
          <EmptyState />
        )}
      </div>
    </>
  );
}
