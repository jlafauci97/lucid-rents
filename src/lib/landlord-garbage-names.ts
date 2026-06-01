/**
 * Placeholder / redacted owner names hidden from the public landlord
 * **directory listing** (the canonical-table-backed list and its count).
 *
 * Single source of truth for the two call sites that page over the same
 * directory and therefore MUST agree, or pagination and the total drift:
 *   - src/app/[city]/landlords/DirectorySection.tsx  (SSR first page)
 *   - src/app/api/landlords/route.ts                 (client sort/filter/page)
 *
 * It must also match the hardcoded list in the directory's count RPC
 * (SQL can't import this — keep the two in sync by hand):
 *   - supabase/migrations/20260507000000_landlord_directory_count_rpc.sql
 *     → get_landlord_directory_count()
 *
 * NOTE: src/app/[city]/landlords/page.tsx intentionally keeps a *separate,
 * longer* list for the ranking strips / hall-of-shame — those query
 * landlord_stats (not the canonical directory) and hide additional
 * government / land-trust owners. That list is deliberately not shared here.
 */
export const GARBAGE_NAMES = [
  "AVAILABLE FROM DATA SOURCE",
  "NAME NOT ON FILE",
  "NOT AVAILABLE",
  "NOT AVAILABLE FROM THE DATA",
  "NOT AVAILABLE FROM THE DATA SOURCE",
  "UNKNOWN",
  "UNKNOWN OWNER",
  "N/A",
  "NA",
  "UNAVAILABLE",
  "UNAVAILABLE OWNER",
  "Taxpayer Unknown",
] as const;

/** PostgREST `in`-list literal for `.not("name", "in", GARBAGE_NOT_IN)`. */
export const GARBAGE_NOT_IN = `(${GARBAGE_NAMES.map((n) => `"${n}"`).join(",")})`;
