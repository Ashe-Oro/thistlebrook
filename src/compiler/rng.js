// Seeded RNG (mulberry32) + a few drawing helpers. Deterministic: the same
// seed always yields the same stream, so a town is reproducible from spec+seed.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A small random API over one mulberry32 stream. */
export function makeRng(seed) {
  const r = mulberry32(seed);
  return {
    next: r,
    float: (a = 0, b = 1) => a + (b - a) * r(),
    // inclusive integer in [a, b]
    int: (a, b) => a + Math.floor(r() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    chance: (p) => r() < p,
    sign: () => (r() < 0.5 ? -1 : 1),
  };
}

/** Derive a distinct sub-seed from a base seed + salt (for town retries). */
export function deriveSeed(seed, salt) {
  let h = ((seed >>> 0) ^ Math.imul((salt | 0) + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
