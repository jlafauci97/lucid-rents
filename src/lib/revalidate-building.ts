import { revalidatePath, revalidateTag } from "next/cache";
import { createCacheClient } from "@/lib/supabase/cache-client";
import { buildingUrl } from "@/lib/seo";
import { CITY_META, type City } from "@/lib/cities";
import { buildingTag } from "@/app/[city]/building/[borough]/[slug]/_data";

/**
 * On-demand ISR revalidation for one building's pages, for event-driven
 * freshness (a review created or moderated, etc.). This is what lets the
 * building /reviews subpage sit at a 7-day TTL instead of the 1h TTL that
 * used to rewrite ~3.5M ISR entries per bot crawl cycle.
 *
 * Best-effort: revalidation failures are logged, never thrown — the write
 * that triggered this has already committed.
 */
export async function revalidateBuildingPages(buildingId: string): Promise<void> {
  try {
    const supabase = createCacheClient();
    const { data } = await supabase
      .from("buildings")
      .select("id, metro, borough, slug")
      .eq("id", buildingId)
      .limit(1);
    const b = data?.[0];
    if (!b?.slug || !b.borough) return;
    const city = (b.metro && CITY_META[b.metro as City] ? b.metro : "nyc") as City;
    const path = buildingUrl({ borough: b.borough, slug: b.slug }, city);
    // Tag first — the page's per-building data caches (loadReviewsData etc.)
    // hold for 7 days and only the tag busts them; revalidatePath alone would
    // re-render from stale data caches.
    revalidateTag(buildingTag(b.id), "max");
    revalidatePath(path);
    revalidatePath(`${path}/reviews`);
  } catch (err) {
    console.error(`revalidateBuildingPages(${buildingId}) failed:`, err);
  }
}
