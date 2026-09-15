// Force-dynamic twin of /[city]/building/[borough]/[slug], for long-tail
// buildings only. The proxy rewrites long-tail building URLs here (Bloom
// filter of hot slugs — see src/proxy.ts + src/lib/hot-slugs.ts), so their
// crawler-driven renders produce ZERO ISR writes; hot buildings stay on the
// ISR route. Same component, same metadata — generateMetadata computes the
// canonical from the building row, so a direct hit on this internal path
// still consolidates to the public URL. Nothing links here.
export { default, generateMetadata } from "../../../building/[borough]/[slug]/page";

export const dynamic = "force-dynamic";
