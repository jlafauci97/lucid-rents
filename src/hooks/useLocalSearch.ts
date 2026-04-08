"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Tuple format from the JSON: [address, slug, borough, score, reviews, violations, name?]
type SearchTuple = [string, string, string, number | null, number, number, string?];

export interface LocalSearchResult {
  full_address: string;
  slug: string;
  borough: string;
  overall_score: number | null;
  review_count: number;
  violation_count: number;
  complaint_count: number;
  name?: string;
}

// In-memory cache per metro — persists across component remounts
const indexCache = new Map<string, SearchTuple[]>();
const loadingPromises = new Map<string, Promise<SearchTuple[]>>();

async function loadIndex(metro: string): Promise<SearchTuple[]> {
  if (indexCache.has(metro)) return indexCache.get(metro)!;

  // Dedupe concurrent loads
  if (loadingPromises.has(metro)) return loadingPromises.get(metro)!;

  const promise = (async () => {
    try {
      const res = await fetch(`/search/${metro}.json`);
      if (!res.ok) return [];
      const data: SearchTuple[] = await res.json();
      indexCache.set(metro, data);
      return data;
    } catch {
      return [];
    }
  })();

  loadingPromises.set(metro, promise);
  const result = await promise;
  loadingPromises.delete(metro);
  return result;
}

/**
 * Binary search to find the first index where address >= prefix.
 */
function lowerBound(arr: SearchTuple[], prefix: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Search the local index for buildings matching a prefix.
 * Returns up to `limit` results, sorted by review count (most first).
 */
function searchIndex(index: SearchTuple[], query: string, limit: number): LocalSearchResult[] {
  const prefix = query.toUpperCase();
  const start = lowerBound(index, prefix);

  // Collect all matches (up to 200 to sort from)
  const matches: SearchTuple[] = [];
  for (let i = start; i < index.length && i < start + 200; i++) {
    if (!index[i][0].startsWith(prefix)) break;
    matches.push(index[i]);
  }

  // Sort by reviews DESC, then violations DESC
  matches.sort((a, b) => (b[4] - a[4]) || (b[5] - a[5]));

  return matches.slice(0, limit).map((t) => ({
    full_address: t[0],
    slug: t[1],
    borough: t[2],
    overall_score: t[3],
    review_count: t[4],
    violation_count: t[5],
    complaint_count: 0,
    name: t[6],
  }));
}

/**
 * Hook for instant client-side search.
 * Loads the metro's search index on first use, then searches locally.
 */
export function useLocalSearch(metro: string) {
  const [index, setIndex] = useState<SearchTuple[] | null>(indexCache.get(metro) || null);
  const [loading, setLoading] = useState(!indexCache.has(metro));

  useEffect(() => {
    if (indexCache.has(metro)) {
      setIndex(indexCache.get(metro)!);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadIndex(metro).then((data) => {
      setIndex(data);
      setLoading(false);
    });
  }, [metro]);

  const search = useCallback(
    (query: string, limit = 5): LocalSearchResult[] => {
      if (!index || query.length < 2) return [];
      return searchIndex(index, query, limit);
    },
    [index]
  );

  return { search, loading, ready: !!index };
}
