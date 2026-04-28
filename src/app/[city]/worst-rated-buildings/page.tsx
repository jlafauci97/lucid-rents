import { permanentRedirect } from "next/navigation";

// The /worst-rated-buildings route was renamed to /building-rankings on
// 2026-04-28. The proxy.ts rule handles single-segment city URLs (e.g.
// /nyc/worst-rated-buildings), but multi-segment forms like
// /CA/Los-Angeles/worst-rated-buildings reach this server component before
// the proxy rule fires. We do a permanent server-side redirect here so
// every URL form converges on the new path.

interface Props {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function WorstRatedBuildingsRedirect({ params, searchParams }: Props) {
  const { city } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
    else if (Array.isArray(v)) v.forEach((vv) => qs.append(k, vv));
  }
  const target = `/${city}/building-rankings${qs.size ? `?${qs.toString()}` : ""}`;
  permanentRedirect(target);
}
