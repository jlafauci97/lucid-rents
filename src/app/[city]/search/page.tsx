import { Suspense } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilters } from "@/components/search/SearchFilters";
import { SearchSort } from "@/components/search/SearchSort";
import { SearchChips } from "@/components/search/SearchChips";
import { BuildingCard } from "@/components/search/BuildingCard";
import { TrendingBuildings } from "@/components/search/TrendingBuildings";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { createClient } from "@/lib/supabase/server";
import type { Building } from "@/types";
import { cityPath, canonicalUrl } from "@/lib/seo";
import type { Metadata } from "next";

import { CITY_META, type City } from "@/lib/cities";

type SortOption = "relevance" | "score-desc" | "score-asc" | "violations-desc" | "reviews-desc";

interface SearchPageProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<{ q?: string; borough?: string; zip?: string; page?: string; sort?: string }>;
}

export async function generateMetadata({
  params: paramsPromise,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const [{ city: cityParam }, params] = await Promise.all([paramsPromise, searchParams]);
  const cityName = CITY_META[cityParam as City]?.fullName || "NYC";
  const title = params.q ? `Search: ${params.q}` : `Search ${cityName} Buildings`;
  const description = params.q
    ? `Results for "${params.q}" — see violations, complaints, tenant reviews, and building scores before you sign.`
    : `Search any ${cityName} building by address or zip code. Instantly see violations, tenant reviews, and safety data.`;
  const url = canonicalUrl(cityPath("/search", cityParam as City));
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, siteName: "Lucid Rents", type: "website" },
  };
}

const VALID_SORTS: SortOption[] = ["relevance", "score-desc", "score-asc", "violations-desc", "reviews-desc"];

function isValidSort(s: string | undefined): s is SortOption {
  return !!s && (VALID_SORTS as string[]).includes(s);
}

function applySortOrder(
  query: ReturnType<ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>["select"]>,
  sort: SortOption
) {
  switch (sort) {
    case "score-desc":
      return query.order("overall_score", { ascending: false, nullsFirst: false });
    case "score-asc":
      return query.order("overall_score", { ascending: true, nullsFirst: false });
    case "violations-desc":
      return query.order("violation_count", { ascending: false });
    case "reviews-desc":
      return query.order("review_count", { ascending: false });
    case "relevance":
    default:
      return query.order("review_count", { ascending: false });
  }
}

function buildPaginationParams(q: string, sort: SortOption, borough?: string, zip?: string): string {
  const parts = [`q=${encodeURIComponent(q)}`];
  if (sort !== "relevance") parts.push(`sort=${sort}`);
  if (borough) parts.push(`borough=${borough}`);
  if (zip) parts.push(`zip=${zip}`);
  return parts.join("&");
}

async function SearchResults({
  q,
  borough,
  zip,
  sort,
  page,
  city,
}: {
  q: string;
  borough?: string;
  zip?: string;
  sort: SortOption;
  page: number;
  city: string;
}) {
  if (!q) {
    return (
      <div className="text-center py-16">
        <p className="text-[#64748b] text-lg">
          Enter an address, neighborhood, or zip code to search.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const limit = 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("buildings")
    .select("*", { count: "exact" })
    .textSearch("search_vector", q, { type: "websearch", config: "english" })
    .range(offset, offset + limit - 1);

  if (borough) query = query.eq("borough", borough);
  if (zip) query = query.eq("zip_code", zip);

  query = applySortOrder(query, sort);

  const { data: buildings, count } = await query;

  if (!buildings || buildings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-[#64748b] text-lg mb-2">
          No buildings found for &ldquo;{q}&rdquo;
        </p>
        <p className="text-sm text-[#94a3b8]">
          Try a different address, zip code, or borough.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil((count || 0) / limit);
  const paginationBase = buildPaginationParams(q, sort, borough, zip);

  return (
    <div>
      <p className="text-sm text-[#64748b] mb-4">
        {count} building{count !== 1 ? "s" : ""} found
      </p>
      <div className="space-y-4">
        {(buildings as Building[]).map((building) => (
          <BuildingCard key={building.id} building={building} />
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <a
              href={`${cityPath("/search", city as City)}?${paginationBase}&page=${page - 1}`}
              className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm hover:bg-gray-50"
            >
              Previous
            </a>
          )}
          <span className="px-4 py-2 text-sm text-[#64748b]">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <a
              href={`${cityPath("/search", city as City)}?${paginationBase}&page=${page + 1}`}
              className="px-4 py-2 rounded-lg border border-[#e2e8f0] text-sm hover:bg-gray-50"
            >
              Next
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
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

export default async function SearchPage({ params: routeParams, searchParams }: SearchPageProps) {
  const { city: cityParam } = await routeParams;
  const params = await searchParams;
  const q = params.q || "";
  const borough = params.borough;
  const zip = params.zip;
  const sort: SortOption = isValidSort(params.sort) ? params.sort : "relevance";
  const page = parseInt(params.page || "1", 10);

  const hasQuery = q.length > 0;

  return (
    <AdSidebar>
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Search bar + filters */}
      <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-4 sm:p-5 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <SearchBar initialQuery={q} />
          </div>
          <div className="flex gap-2">
            <Suspense fallback={null}>
              <SearchFilters />
            </Suspense>
            <Suspense fallback={null}>
              <SearchSort />
            </Suspense>
          </div>
        </div>
        <div className="mt-3">
          <Suspense fallback={null}>
            <SearchChips />
          </Suspense>
        </div>
      </div>

      {/* Results area */}
      {hasQuery ? (
        <Suspense fallback={<SearchSkeleton />}>
          <SearchResults q={q} borough={borough} zip={zip} sort={sort} page={page} city={cityParam} />
        </Suspense>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <Suspense fallback={<SearchSkeleton />}>
              <TrendingBuildings city={cityParam as City} />
            </Suspense>
          </div>
          <div>
            <div className="bg-white rounded-xl border border-[#e2e8f0] shadow-sm p-5 text-center">
              <p className="text-[#64748b] text-sm">
                Search by address, neighborhood, or zip code to find buildings.
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                Or use the quick filters above to browse.
              </p>
            </div>
          </div>
        </div>
      )}
      <AdBlock adSlot="SEARCH_BOTTOM" adFormat="horizontal" />
    </div>
    </AdSidebar>
  );
}
