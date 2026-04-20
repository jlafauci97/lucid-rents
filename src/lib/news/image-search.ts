/**
 * Resolve a search term into a real photo URL.
 *
 * Strategy:
 *   1. Unsplash API (high-quality editorial photos) when UNSPLASH_ACCESS_KEY is set.
 *   2. LoremFlickr (random Flickr tagged images) as a free fallback.
 *
 * Both return an https URL usable directly in an <img src>.
 */

const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";
const UNSPLASH_TIMEOUT_MS = 8000;

interface UnsplashPhoto {
  urls?: { regular?: string; full?: string };
}

interface UnsplashResponse {
  results?: UnsplashPhoto[];
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
  const timer = setTimeout(() => ctrl.abort(), UNSPLASH_TIMEOUT_MS);

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
  const unsplash = await unsplashFirst(query);
  return unsplash ?? loremFlickr(query);
}
