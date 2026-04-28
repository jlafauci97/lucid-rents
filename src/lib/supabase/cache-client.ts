import { createClient } from "@supabase/supabase-js";

/**
 * Anon Supabase client without cookies.
 *
 * `unstable_cache()` from next/cache forbids reading dynamic data (cookies,
 * headers) inside its scope, so the cookie-bound server client cannot be used
 * for queries we want to cache cross-request. This client targets public
 * tables/RPCs only and returns the same plain client interface, so any
 * existing query code keeps working.
 */
export function createCacheClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
