// Force-dynamic twin of /[city]/landlord/[name], for long-tail landlords
// only. The proxy rewrites long-tail landlord URLs here (Bloom filter of hot
// slugs — see src/proxy.ts + src/lib/hot-slugs.ts), so their crawler-driven
// renders produce ZERO ISR writes; hot landlords stay on the ISR route.
// generateMetadata computes the canonical from the stats row, so a direct
// hit on this internal path still consolidates to the public URL.
export { default, generateMetadata } from "../../landlord/[name]/page";

export const dynamic = "force-dynamic";
