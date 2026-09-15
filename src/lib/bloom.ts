/**
 * Minimal Bloom filter over string keys — the proxy's tier signal for the
 * hot/long-tail route split (see src/lib/hot-slugs.ts). Pure 32-bit JS so the
 * generator script (Node) and the proxy produce identical bit positions.
 *
 * Direction of error matters: the filter holds the HOT slugs, so a false
 * positive routes a long-tail page to the ISR route (today's behavior,
 * harmless), and false negatives are impossible — every hot slug always
 * routes to ISR.
 */

/** FNV-1a 32-bit. */
function fnv1a(key: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    // h *= 16777619 (mod 2^32), split to stay in 32-bit int math
    h = (h + ((h << 1) >>> 0) + ((h << 4) >>> 0) + ((h << 7) >>> 0) + ((h << 8) >>> 0) + ((h << 24) >>> 0)) >>> 0;
  }
  return h >>> 0;
}

/** Double hashing: index_i = (h1 + i*h2) mod m. Sums stay < 2^53, so plain
 *  number arithmetic is exact. */
function indexes(key: string, m: number, k: number): number[] {
  const h1 = fnv1a(key, 0);
  // Odd so it cycles all of m; the >>> 0 matters — bare `| 1` yields a
  // SIGNED 32-bit value, and a negative h2 produces negative indexes that
  // silently no-op against a Uint8Array.
  const h2 = (fnv1a(key, 0x9e3779b9) | 1) >>> 0;
  const out = new Array<number>(k);
  for (let i = 0; i < k; i++) out[i] = (h1 + i * h2) % m;
  return out;
}

export function bloomAdd(bits: Uint8Array, m: number, k: number, key: string): void {
  for (const idx of indexes(key, m, k)) bits[idx >> 3] |= 1 << (idx & 7);
}

export function bloomHas(bits: Uint8Array, m: number, k: number, key: string): boolean {
  for (const idx of indexes(key, m, k)) {
    if ((bits[idx >> 3] & (1 << (idx & 7))) === 0) return false;
  }
  return true;
}

/** Size a filter: m bits (rounded to bytes) and k hashes for n keys at
 *  false-positive rate p. */
export function bloomParams(n: number, p: number): { m: number; k: number } {
  const m = Math.ceil((-n * Math.log(p)) / (Math.LN2 * Math.LN2));
  const mBytes = Math.ceil(m / 8) * 8;
  const k = Math.max(1, Math.round((mBytes / n) * Math.LN2));
  return { m: mBytes, k };
}
