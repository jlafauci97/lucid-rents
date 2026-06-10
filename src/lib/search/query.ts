import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeAddressQuery } from "@/lib/address-normalization";

/** Sort options the search backend supports (mirrors searchSchema in validators.ts). */
export const SEARCH_SORTS = [
  "relevance",
  "score-desc",
  "score-asc",
  "violations-desc",
  "reviews-desc",
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

/**
 * Column list for direct `buildings` queries — matches what BuildingCard and
 * the typeahead consumers read (see BUILDING_COLUMNS in
 * src/lib/building-list/query.ts).
 */
export const SEARCH_BUILDING_COLUMNS = `id, metro, borough, full_address, name, slug, year_built, total_units,
       residential_units, overall_score, review_count, violation_count,
       complaint_count, is_rent_stabilized, zip_code`;

/** Apply one of the supported sort orders to a buildings query. */
export function applySortOrder<
  T extends {
    order(column: string, options: { ascending: boolean; nullsFirst?: boolean }): T;
  },
>(query: T, sort: string): T {
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

export interface RankedSearchParams {
  q: string;
  city?: string | null;
  borough?: string | null;
  zip?: string | null;
  sort?: string | null;
  offset?: number;
  limit?: number;
}

export interface RankedSearchResult {
  buildings: Record<string, unknown>[];
  total: number;
  error: string | null;
}

/**
 * Ranked full-text building search via the `search_buildings_ranked` RPC.
 * Normalizes street abbreviations both directions so either form matches.
 */
export async function searchBuildingsRanked(
  supabase: SupabaseClient,
  params: RankedSearchParams
): Promise<RankedSearchResult> {
  const { abbreviated, expanded } = normalizeAddressQuery(params.q);
  const { data, error } = await supabase.rpc("search_buildings_ranked", {
    search_query: abbreviated,
    search_query_alt: abbreviated !== expanded ? expanded : null,
    city_filter: params.city || null,
    borough_filter: params.borough || null,
    zip_filter: params.zip || null,
    sort_by: params.sort || "relevance",
    page_offset: params.offset ?? 0,
    page_limit: params.limit ?? 20,
  });

  if (error) {
    return { buildings: [], total: 0, error: error.message };
  }

  const rows = (data || []) as Record<string, unknown>[];
  const buildings = rows.map((row) => {
    const { total_count, ...building } = row;
    void total_count;
    return building;
  });
  const total = (rows[0]?.total_count as number | undefined) ?? 0;

  return { buildings, total, error: null };
}
