// OWNER: grok-roads lane. Town carriageway hygiene (pure; no THREE, no DOM).
//
// Downtown streets are authored as short pieces. Where exactly two pieces of
// the same street class meet in a straight line, the narrower one used to keep
// its own width, so the kerb stepped in mid-block. A straight run now carries
// one width (the widest piece's); real junctions and class changes keep theirs.
const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
export const isTownCarriageway = (r) => r.kind === 'avenue' || (!r.owner && !r.external && r.kind === 'lane' && r.width >= 2.4);

export function unifyStraightRuns(town) {
  const roads = town.roads.filter(isTownCarriageway), ends = new Map();
  for (const r of roads) for (const p of [r.a, r.b]) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(r); }
  const dir = (r, p) => { const q = key(r.a) === key(p) ? r.b : r.a, d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };
  const changed = [];
  for (let pass = 0, again = true; again && pass < 20; pass++) {
    again = false;
    for (const [k, list] of ends) {
      if (list.length !== 2) continue;
      const [r, s] = list, p = key(r.a) === k ? r.a : r.b;
      if (r.kind !== s.kind || Math.abs(r.width - s.width) < .01) continue;
      const u = dir(r, p), v = dir(s, p); if (u[0] * v[0] + u[1] * v[1] > -.995) continue; // not straight
      const w = Math.max(r.width, s.width); for (const x of [r, s]) if (x.width !== w) { changed.push({a: x.a, b: x.b, from: x.width, to: w}); x.width = w; again = true; }
    }
  }
  return changed;
}
