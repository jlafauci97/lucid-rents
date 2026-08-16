import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

const ALLOWED_PATH_PATTERNS = [
  /^\/\[city\]($|\/)/,
  /^\/$/,
  // Concrete building pages (and their /violations subpage), sent by the sync
  // edge function for targeted per-building revalidation. The route-pattern
  // form "/[city]/building/[borough]/[slug]" is deliberately NOT special-cased
  // here beyond the generic /[city] prefix — callers should revalidate the
  // specific buildings they touched, not every building page on the site.
  // City prefix is either "nyc" or the two-segment "CA/Los-Angeles" /
  // "IL/Chicago" form — the old single-segment-lowercase pattern silently
  // dropped every LA and Chicago building path.
  /^\/(?:[a-z0-9-]+|[A-Z]{2}\/[A-Za-z-]+)\/building\/[a-z0-9-]+\/[a-z0-9-]+(\/violations)?$/,
];
const ALLOWED_TAG_PATTERNS = [
  /^landlords:[a-z-]+$/,
  /^landlord-data$/,
  // Per-building data-cache tag (see _data.ts buildingTag) — busts the 7-day
  // loader caches for a specific building when a sync touches it.
  /^building-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
];
// High enough for a capped per-building batch from a sync run (2 paths per
// building × 200-building cap), low enough to bound a single request's work.
const MAX_ITEMS = 400;

export async function POST(req: NextRequest) {
  const { paths, tags, secret } = await req.json();

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let revalidatedPaths = 0;
  let revalidatedTags = 0;

  if (Array.isArray(paths)) {
    if (paths.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many paths" }, { status: 400 });
    }
    const valid = paths.filter(
      (p: unknown) =>
        typeof p === "string" &&
        ALLOWED_PATH_PATTERNS.some((re) => re.test(p))
    );
    for (const path of valid) {
      // Route patterns ("/[city]/...") need the "page" type; concrete URLs
      // ("/nyc/building/manhattan/x") are revalidated individually without it.
      if (path.includes("[")) revalidatePath(path, "page");
      else revalidatePath(path);
    }
    revalidatedPaths = valid.length;
  }

  if (Array.isArray(tags)) {
    if (tags.length > MAX_ITEMS) {
      return NextResponse.json({ error: "Too many tags" }, { status: 400 });
    }
    const valid = tags.filter(
      (t: unknown) =>
        typeof t === "string" &&
        ALLOWED_TAG_PATTERNS.some((re) => re.test(t))
    );
    // Next.js 16: revalidateTag requires a cacheLife profile as the 2nd arg.
    // "max" = stale-while-revalidate (recommended for webhook-style invalidation).
    for (const tag of valid) revalidateTag(tag, "max");
    revalidatedTags = valid.length;
  }

  return NextResponse.json({ revalidatedPaths, revalidatedTags });
}
