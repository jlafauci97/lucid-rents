/**
 * Resolve a search term into a real photo URL.
 *
 * Strategy:
 *   1. Pexels API (high-quality editorial photos) when PEXELS_API_KEY is set.
 *   2. Unsplash API (if UNSPLASH_ACCESS_KEY is set) as secondary.
 *   3. LoremFlickr as a free, keyless fallback.
 *
 * To avoid the same photo appearing on multiple posts (the #1 reason news
 * cards "all look the same"), we fetch a page of candidates and pick one
 * that isn't already in use on a recent article for the same metro.
 *
 * All return an https URL usable directly in an <img src>.
 */

import { createClient } from "@supabase/supabase-js";

const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";
const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";
const TIMEOUT_MS = 8000;
const PER_PAGE = 30;
const RECENT_DAYS = 60;

interface PexelsPhoto {
  src?: { landscape?: string; large2x?: string; large?: string; original?: string };
}
interface PexelsResponse {
  photos?: PexelsPhoto[];
}

interface UnsplashPhoto {
  urls?: { regular?: string; full?: string };
}
interface UnsplashResponse {
  results?: UnsplashPhoto[];
}

function pickFirstSrc(p: PexelsPhoto): string | null {
  return (
    p.src?.landscape ?? p.src?.large2x ?? p.src?.large ?? p.src?.original ?? null
  );
}

function pickUnsplashSrc(p: UnsplashPhoto): string | null {
  return p.urls?.regular ?? p.urls?.full ?? null;
}

async function pexelsCandidates(query: string): Promise<string[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query,
    per_page: String(PER_PAGE),
    orientation: "landscape",
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PEXELS_ENDPOINT}?${params}`, {
      headers: { Authorization: key },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as PexelsResponse;
    return (body.photos ?? [])
      .map(pickFirstSrc)
      .filter((u): u is string => !!u);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function unsplashCandidates(query: string): Promise<string[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];

  const params = new URLSearchParams({
    query,
    per_page: String(PER_PAGE),
    orientation: "landscape",
    content_filter: "high",
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${UNSPLASH_ENDPOINT}?${params}`, {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const body = (await res.json()) as UnsplashResponse;
    return (body.results ?? [])
      .map(pickUnsplashSrc)
      .filter((u): u is string => !!u);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function loremFlickr(query: string, salt: string): string {
  const slug = query.trim().replace(/\s+/g, ",");
  // The `lock` param forces a deterministic but distinct image; we vary it per
  // article via the `salt` so two posts with identical queries don't collide.
  const lock = Math.abs(hashString(salt)) % 10000;
  return `https://loremflickr.com/1200/800/${encodeURIComponent(slug)}/all?lock=${lock}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h;
}

async function recentImageUrls(metro: string | null): Promise<Set<string>> {
  if (!metro) return new Set();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Set();

  const since = new Date(
    Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  try {
    const db = createClient(url, key);
    const { data } = await db
      .from("news_articles")
      .select("image_url")
      .eq("metro", metro)
      .gte("created_at", since)
      .not("image_url", "is", null);
    return new Set(
      (data ?? [])
        .map((r) => (r as { image_url: string | null }).image_url)
        .filter((u): u is string => !!u)
    );
  } catch {
    return new Set();
  }
}

function pickFresh(candidates: string[], used: Set<string>): string | null {
  const fresh = candidates.filter((u) => !used.has(u));
  const pool = fresh.length > 0 ? fresh : candidates;
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export async function imageUrlForQuery(
  query: string,
  opts: { metro?: string | null; salt?: string } = {}
): Promise<string> {
  const used = await recentImageUrls(opts.metro ?? null);

  const pexels = await pexelsCandidates(query);
  const fromPexels = pickFresh(pexels, used);
  if (fromPexels) return fromPexels;

  const unsplash = await unsplashCandidates(query);
  const fromUnsplash = pickFresh(unsplash, used);
  if (fromUnsplash) return fromUnsplash;

  return loremFlickr(query, opts.salt ?? query + Date.now());
}
