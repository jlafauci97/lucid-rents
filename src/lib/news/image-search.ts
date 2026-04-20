/**
 * Resolve a search term into a real photo URL.
 *
 * Strategy:
 *   1. Pexels API (high-quality editorial photos) when PEXELS_API_KEY is set.
 *   2. Unsplash API (if UNSPLASH_ACCESS_KEY is set) as secondary.
 *   3. LoremFlickr as a free, keyless fallback.
 *
 * All return an https URL usable directly in an <img src>.
 */

const PEXELS_ENDPOINT = "https://api.pexels.com/v1/search";
const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";
const TIMEOUT_MS = 8000;

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

async function pexelsFirst(query: string): Promise<string | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    query,
    per_page: "1",
    orientation: "landscape",
  });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${PEXELS_ENDPOINT}?${params}`, {
      headers: { Authorization: key },
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as PexelsResponse;
    const photo = body.photos?.[0];
    return (
      photo?.src?.landscape ??
      photo?.src?.large2x ??
      photo?.src?.large ??
      photo?.src?.original ??
      null
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function unsplashFirst(query: string): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    query,
    per_page: "1",
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
    if (!res.ok) return null;
    const body = (await res.json()) as UnsplashResponse;
    const photo = body.results?.[0];
    return photo?.urls?.regular ?? photo?.urls?.full ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function loremFlickr(query: string): string {
  const slug = query.trim().replace(/\s+/g, ",");
  return `https://loremflickr.com/1200/800/${encodeURIComponent(slug)}/all`;
}

export async function imageUrlForQuery(query: string): Promise<string> {
  const pexels = await pexelsFirst(query);
  if (pexels) return pexels;
  const unsplash = await unsplashFirst(query);
  if (unsplash) return unsplash;
  return loremFlickr(query);
}
