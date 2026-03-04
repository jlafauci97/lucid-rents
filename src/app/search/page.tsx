import { Suspense } from "react";
import { SearchBar } from "@/components/search/SearchBar";
import { SearchFilters } from "@/components/search/SearchFilters";
import { BuildingCard } from "@/components/search/BuildingCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { AdSidebar } from "@/components/ui/AdSidebar";
import { AdBlock } from "@/components/ui/AdBlock";
import { createClient } from "@/lib/supabase/server";
import type { Building } from "@/types";
import type { Metadata } from "next";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; borough?: string; zip?: string; page?: string }>;
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const params = await searchParams;
  return {
    title: params.q ? `Search: ${params.q}` : "Search Buildings",
  };
}

async function SearchResults({
  q,
  borough,
  zip,
  page,
}: {
  q: string;
  borough?: string;
  zip?: string;
  page: number;
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
    .range(offset, offset + limit - 1)
    .order("review_count", { ascending: false });

  if (borough) query = query.eq("borough", borough);
  if (zip) query = query.eq("zip_code", zip);

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
              href={`/search?q=${encodeURIComponent(q)}&page=${page - 1}${borough ? `&borough=${borough}` : ""}${zip ? `&zip=${zip}` : ""}`}
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
              href={`/search?q=${encodeURIComponent(q)}&page=${page + 1}${borough ? `&borough=${borough}` : ""}${zip ? `&zip=${zip}` : ""}`}
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

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = params.q || "";
  const borough = params.borough;
  const zip = params.zip;
  const page = parseInt(params.page || "1", 10);

  return (
    <AdSidebar>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <SearchBar initialQuery={q} />
      </div>
      <div className="mb-6">
        <Suspense fallback={null}>
          <SearchFilters />
        </Suspense>
      </div>
      <AdBlock adSlot="SEARCH_TOP" adFormat="horizontal" />
      <Suspense fallback={<SearchSkeleton />}>
        <SearchResults q={q} borough={borough} zip={zip} page={page} />
      </Suspense>
      <AdBlock adSlot="SEARCH_BOTTOM" adFormat="horizontal" />
    </div>
    </AdSidebar>
  );
}
