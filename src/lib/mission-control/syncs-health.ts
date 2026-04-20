/**
 * Fetches a boolean summary of the syncs health for the Mission Control hub card.
 *
 * Returns `true` only when `/api/health` reports `status === "healthy"` —
 * warnings and errors are treated as "not ok". Any network or parse failure
 * falls back to `false` so the hub card surfaces the problem instead of
 * silently pretending everything is fine.
 */
export async function fetchSyncsOk(): Promise<boolean> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const res = await fetch(`${base}/api/health`, {
      cache: "no-store",
    });
    if (!res.ok) return false;
    const body = (await res.json()) as { status?: string };
    return body.status === "healthy";
  } catch {
    return false;
  }
}
