import { bloomHas } from "@/lib/bloom";
import { HOT_BUILDINGS, HOT_LANDLORDS } from "@/generated/hot-slugs-filter";

/**
 * Tier lookups for the proxy's ISR/dynamic route split. "Hot" slugs (in the
 * Bloom filter) stay on the ISR routes; everything else is rewritten to the
 * force-dynamic *-dyn twins, which produce zero ISR writes. Pure in-memory
 * bit checks — no I/O in the proxy path.
 *
 * Bloom false positives (~2%) send a long-tail slug to the ISR route —
 * today's behavior, harmless. False negatives are impossible, so hot pages
 * never lose ISR. An EMPTY filter (never generated) fails hot for everything,
 * preserving the status quo.
 */

function decode(base64: string): Uint8Array {
  // Node runtime (the proxy's default in Next 16) — Buffer is available.
  return new Uint8Array(Buffer.from(base64, "base64"));
}

const buildingBits = decode(HOT_BUILDINGS.base64);
const landlordBits = decode(HOT_LANDLORDS.base64);

export function isHotBuildingSlug(slug: string): boolean {
  if (HOT_BUILDINGS.count === 0) return true;
  return bloomHas(buildingBits, HOT_BUILDINGS.m, HOT_BUILDINGS.k, slug.toLowerCase());
}

export function isHotLandlordSlug(slug: string): boolean {
  if (HOT_LANDLORDS.count === 0) return true;
  return bloomHas(landlordBits, HOT_LANDLORDS.m, HOT_LANDLORDS.k, slug.toLowerCase());
}
