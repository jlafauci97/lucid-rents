/**
 * Fire-and-forget helper that hits the Next.js on-demand revalidation
 * endpoint so updated pages are regenerated.
 *
 * Requires the SITE_URL and CRON_SECRET env vars.
 */
export async function triggerRevalidation(paths: string[]): Promise<void> {
  if (paths.length === 0) return;

  const siteUrl = Deno.env.get("VERCEL_APP_URL");
  const cronSecret = Deno.env.get("CRON_SECRET");

  if (!siteUrl || !cronSecret) {
    console.warn(
      "triggerRevalidation: missing VERCEL_APP_URL or CRON_SECRET — skipping"
    );
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ paths }),
    });

    if (!res.ok) {
      console.error(
        `Revalidation responded ${res.status}: ${await res.text()}`
      );
    }
  } catch (err) {
    console.error("Revalidation error:", err);
  }
}
