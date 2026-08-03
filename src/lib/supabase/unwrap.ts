import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Unwrap a Supabase result, throwing when the query itself failed.
 *
 * Any lookup that gates `notFound()` MUST distinguish "this row doesn't exist"
 * from "the database didn't answer". Destructuring only `data` collapses those
 * two cases into one: a transient statement timeout or connection reset yields
 * `undefined`, the page calls `notFound()`, Next 16 coerces that to HTTP 200
 * carrying `<meta name="robots" content="noindex">`, and `revalidate` caches
 * the poisoned render for a full day — served to every crawl in that window.
 *
 * That is how ~65K live NYC/LA/Chicago building and landlord URLs ended up in
 * Search Console's "Excluded by 'noindex' tag" bucket (229 → 90,708 pages,
 * May–Jul 2026) while every one of them was serving a healthy 200. Because a
 * soft-404 is an HTTP 200, Google never gets a removal signal, so the count
 * only ever climbs.
 *
 * Throwing surfaces a 500 instead. Google retries 5xx and never deindexes on
 * one, and Next won't cache a render that threw.
 */
export function unwrap<T>(
  result: { data: T; error: PostgrestError | null },
  context: string
): T {
  if (result.error) {
    throw new Error(
      `Supabase query failed (${context}): ${result.error.message}`,
      { cause: result.error }
    );
  }
  return result.data;
}
