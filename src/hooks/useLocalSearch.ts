"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Tuple format: [address, slug, borough, score, reviews, violations, name?]
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

// In-memory chunk cache: metro:prefix → sorted tuples
const chunkCache = new Map<string, SearchTuple[]>();
const loadingChunks = new Set<string>();

async function loadChunk(metro: string, prefix: string): Promise<SearchTuple[]> {
  const key = `${metro}:${prefix}`;
  if (chunkCache.has(key)) return chunkCache.get(key)!;
  if (loadingChunks.has(key)) {
    // Wait for in-flight load
    await new Promise(r => setTimeout(r, 50));
    return chunkCache.get(key) || [];
  }

  loadingChunks.add(key);
  try {
    const safePrefix = prefix.replace(/[^a-zA-Z0-9]/g, "_");
    const res = await fetch(`/search/${metro}/${safePrefix}.json`);
    if (!res.ok) return [];
    const data: SearchTuple[] = await res.json();
    chunkCache.set(key, data);
    return data;
  } catch {
    return [];
  } finally {
    loadingChunks.delete(key);
  }
}

function lowerBound(arr: SearchTuple[], prefix: string): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid][0] < prefix) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function searchChunk(chunk: SearchTuple[], query: string, limit: number): LocalSearchResult[] {
  const prefix = query.toUpperCase();
  const start = lowerBound(chunk, prefix);

  const matches: SearchTuple[] = [];
  for (let i = start; i < chunk.length && matches.length < 200; i++) {
    if (!chunk[i][0].startsWith(prefix)) break;
    matches.push(chunk[i]);
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
 * Hook for instant client-side search using chunked prefix index.
 * Loads only the ~500KB-4MB chunk matching the user's input prefix.
 */
export function useLocalSearch(metro: string) {
  const [, setTick] = useState(0); // force re-render on chunk load
  const lastPrefix = useRef("");

  const search = useCallback(
    async (query: string, limit = 5): Promise<LocalSearchResult[]> => {
      if (query.length < 2) return [];

      const upper = query.toUpperCase();
      const prefix = upper.substring(0, 2).replace(/[^a-zA-Z0-9]/g, "_");

      // Load chunk if not cached
      if (!chunkCache.has(`${metro}:${prefix}`)) {
        if (prefix !== lastPrefix.current) {
          lastPrefix.current = prefix;
          loadChunk(metro, prefix).then(() => setTick(t => t + 1));
        }
        return [];
      }

      const chunk = chunkCache.get(`${metro}:${prefix}`)!;
      return searchChunk(chunk, query, limit);
    },
    [metro]
  );

  // Preload common prefixes (10-19, 20-29 etc.) on mount
  useEffect(() => {
    // Preload the most common first-digit prefix after a short delay
    const timer = setTimeout(() => {
      // Don't preload — let it load on first keystroke for instant chunk fetch
    }, 2000);
    return () => clearTimeout(timer);
  }, [metro]);

  return { search, ready: true };
}
