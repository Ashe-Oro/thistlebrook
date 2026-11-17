// OWNER: grok-roads lane. Regional road planner (pure; no THREE, no DOM).
//
// World links arrive as straight authored polylines, one record per leg. They
// are merged into chains that run between junctions (any point where a link
// meets another road, path or link) and termini. Each chain becomes ONE road
// record with ONE centerline: corners get a circular fillet, straight legs stay
// straight, and the carriageway is centred on the walk graph instead of being
// pushed sideways. That removes the old per-leg bends and side offsets that
// produced lens-shaped loops, stacked asphalt at every join and jagged spurs.
import {distanceToSegment} from '../compiler/astra.js';
import {insideLandscape} from '../compiler/landscape.js';

export const REGIONAL = Object.freeze({width: 5.6, verge: 8, kerb: 3.35, fence: 4.05, maxRadius: 14, step: 4, arcStep: Math.PI / 14, turnRadius: 4.6});
const key = (p) => p.map((v) => Math.round(v * 100)).join(',');
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const round = (p) => p.map((v) => +v.toFixed(5));

function samplesOf(points) {
  // Fillet every interior corner of a chain, then sample the result.
  const out = [points[0]], apexes = [];
  const fillets = points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return null;
    const din = unit(sub(p, points[i - 1])), dout = unit(sub(points[i + 1], p));
    const turn = Math.acos(Math.max(-1, Math.min(1, din[0] * dout[0] + din[1] * dout[1])));
    if (turn < 1e-3) return null;
    const share = (j, k) => len(sub(points[k], points[j])) * ((j === 0 || k === points.length - 1) ? 1 : .5);
    const tanHalf = Math.tan(turn / 2), avail = Math.min(share(i - 1, i), share(i, i + 1));
    const radius = Math.min(REGIONAL.maxRadius, avail / tanHalf), t = radius * tanHalf;
    const side = Math.sign(cross(din, dout)), normal = [-din[1] * side, din[0] * side];
    const t1 = [p[0] - din[0] * t, p[1] - din[1] * t], center = [t1[0] + normal[0] * radius, t1[1] + normal[1] * radius];
    return {t1, t2: [p[0] + dout[0] * t, p[1] + dout[1] * t], center, radius, turn, side, corner: p};
  });
  const straight = (a, b) => { const n = Math.max(1, Math.ceil(len(sub(b, a)) / REGIONAL.step)); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); };
  let cursor = points[0];
  for (let i = 1; i < points.length; i++) {
    const f = fillets[i];
    if (!f) { if (len(sub(points[i], cursor)) > 1e-6) straight(cursor, points[i]); cursor = points[i]; continue; }
    if (len(sub(f.t1, cursor)) > 1e-6) straight(cursor, f.t1);
    const a0 = Math.atan2(f.t1[1] - f.center[1], f.t1[0] - f.center[0]);
    const n = Math.max(2, Math.ceil(f.turn / REGIONAL.arcStep)) * 2; // even, so the apex is a sample
    for (let k = 1; k <= n; k++) {
      const a = a0 + f.side * f.turn * k / n, q = [f.center[0] + Math.cos(a) * f.radius, f.center[1] + Math.sin(a) * f.radius];
      out.push(q); if (k === n / 2) apexes.push({corner: f.corner, apex: q});
    }
    cursor = f.t2;
  }
  if (out.length === 2) out.splice(1, 0, [(out[0][0] + out[1][0]) / 2, (out[0][1] + out[1][1]) / 2]); // every centerline has an interior sample
  return {samples: out.map(round), apexes: apexes.map((a) => ({corner: a.corner, apex: round(a.apex)}))};
}

/** Replace world-link legs with one filleted road record per chain. */
export function planRegionalRoads(town) {
  const links = town.roads.filter((r) => r.kind === 'world-link');
  const others = town.roads.filter((r) => r.kind !== 'world-link');
  // 1) Split legs at every graph node lying on them.
  const pieces = [];
  for (const r of links) {
    const anchors = [r.a, ...town.nodes.filter((p) => distanceToSegment(p, r.a, r.b) < .01), r.b]
      .sort((a, b) => len(sub(a, r.a)) - len(sub(b, r.a)))
      .filter((p, i, all) => !i || len(sub(p, all[i - 1])) > .02);
    for (let i = 1; i < anchors.length; i++) pieces.push({a: anchors[i - 1], b: anchors[i], group: r.routeGroup});
  }
  // 2) Points: a point is pinned (a chain boundary) unless exactly two legs
  // meet there and nothing else touches it.
  const points = new Map();
  const at = (p) => { const k = key(p); if (!points.has(k)) points.set(k, {p, pieces: []}); return points.get(k); };
  pieces.forEach((piece, i) => { at(piece.a).pieces.push(i); at(piece.b).pieces.push(i); });
  for (const pt of points.values()) {
    pt.touches = others.some((r) => distanceToSegment(pt.p, r.a, r.b) < .02);
    pt.pinned = pt.pieces.length !== 2 || pt.touches;
    pt.terminus = pt.pieces.length === 1;
  }
  // 3) Chains between pinned points.
  const used = new Set(), chains = [];
  const walk = (startKey, pieceIndex) => {
    const pts = [points.get(startKey).p], groups = new Set();
    let k = startKey, i = pieceIndex;
    for (;;) {
      used.add(i); const piece = pieces[i]; groups.add(piece.group);
      const next = key(piece.a) === k ? piece.b : piece.a; k = key(next); pts.push(next);
      const pt = points.get(k); if (pt.pinned) break;
      i = pt.pieces.find((j) => j !== i); if (used.has(i)) break;
    }
    return {points: pts, groups: [...groups]};
  };
  const ordered = [...points.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, pt] of ordered) if (pt.pinned) for (const i of pt.pieces) if (!used.has(i)) chains.push(walk(k, i));
  for (const [k, pt] of ordered) for (const i of pt.pieces) if (!used.has(i)) chains.push(walk(k, i)); // closed loops
  // 4) One record per chain. Corner nodes move onto their fillet apex, so the
  // walk graph never keeps an orphaned point outside the road.
  town.roads.length = 0; town.roads.push(...others);
  const records = chains.map((chain) => {
    const {samples, apexes} = samplesOf(chain.points);
    for (const {corner, apex} of apexes) { const n = town.nodes.findIndex((q) => len(sub(q, corner)) < .015); if (n >= 0) town.nodes[n] = apex; }
    const ends = [chain.points[0], chain.points.at(-1)].map((p) => { const pt = points.get(key(p)); return {pos: [...p], terminus: pt.terminus, touches: pt.touches}; });
    let length = 0; for (let i = 1; i < samples.length; i++) length += len(sub(samples[i], samples[i - 1]));
    const r = {a: [...chain.points[0]], b: [...chain.points.at(-1)], width: REGIONAL.width, kind: 'world-link', owner: 'world-link', routeGroup: chain.groups[0], routeGroups: chain.groups, authored: chain.points.map((p) => [...p]), walkline: samples, centerline: samples, ends, length};
    r.bridges = bridgeSpans(samples);
    town.roads.push(r); r.regionalId = town.roads.length - 1; return r;
  });
  town.regionalLines = planRegionalLines(records);
  clearVerges(town, records);
  return records;
}

// Where the carriageway leaves dry land (the inlet mouth on Highway 4) the
// road is a bridge: [from, to] sample ranges, padded by one sample of abutment.
function bridgeSpans(samples) {
  const off = samples.map((p, i) => {
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)], t = unit(sub(b, a)), h = REGIONAL.width / 2;
    return [p, [p[0] + t[1] * h, p[1] - t[0] * h], [p[0] - t[1] * h, p[1] + t[0] * h]].some((q) => !insideLandscape(q));
  });
  const spans = [];
  off.forEach((o, i) => { if (!o) return; const last = spans.at(-1); if (last && i - 1 <= last[1]) last[1] = Math.min(samples.length - 1, i + 1); else spans.push([Math.max(0, i - 1), Math.min(samples.length - 1, i + 1)]); });
  return spans;
}

// Town props and trees were placed against the authored link; any that fall
// inside the final verge step out to the fence line on their own side.
function clearVerges(town, records) {
  const items = [...(town.props || []), ...(town.trees || [])].filter((p) => Array.isArray(p.pos));
  for (const item of items) for (const r of records) {
    const c = r.centerline; let best = null;
    for (let i = 1; i < c.length; i++) { const d = distanceToSegment(item.pos, c[i - 1], c[i]); if (!best || d < best.d) best = {d, a: c[i - 1], b: c[i]}; }
    if (!best || best.d >= REGIONAL.fence) continue;
    const t = unit(sub(best.b, best.a)), rel = sub(item.pos, best.a), along = rel[0] * t[0] + rel[1] * t[1], side = Math.sign(rel[0] * t[1] - rel[1] * t[0]) || 1;
    const foot = [best.a[0] + t[0] * along, best.a[1] + t[1] * along];
    item.pos = round([foot[0] + t[1] * side * REGIONAL.fence, foot[1] - t[0] * side * REGIONAL.fence]);
  }
}

// Vehicle lines run terminus to terminus through junctions, always taking the
// straightest continuation, so cars only turn around where a road really ends.
export function planRegionalLines(records) {
  const byEnd = new Map();
  records.forEach((r, i) => { for (const [end, p] of [[0, r.a], [1, r.b]]) { const k = key(p); if (!byEnd.has(k)) byEnd.set(k, []); byEnd.get(k).push({i, end}); } });
  const oriented = (i, fromEnd) => (fromEnd === 0 ? records[i].centerline : [...records[i].centerline].reverse());
  const lines = [], visited = new Set();
  const starts = records.flatMap((r, i) => r.ends.map((e, end) => ({i, end, e}))).filter(({e}) => e.terminus)
    .sort((a, b) => key(a.e.pos).localeCompare(key(b.e.pos)));
  const trace = (i, end) => {
    let pts = oriented(i, end).map((p) => [...p]); const used = [i]; visited.add(i);
    for (let guard = 0; guard < 40; guard++) {
      const tail = pts.at(-1), dir = unit(sub(tail, pts.at(-2)));
      const options = (byEnd.get(key(tail)) || []).filter((o) => !used.includes(o.i));
      if (!options.length) break;
      const scored = options.map((o) => { const c = oriented(o.i, o.end), d = unit(sub(c[1], c[0])); return {...o, c, score: dir[0] * d[0] + dir[1] * d[1] + (visited.has(o.i) ? 0 : .05)}; })
        .sort((a, b) => b.score - a.score || a.i - b.i);
      const best = scored[0]; if (best.score < -.2) break;
      pts = pts.concat(best.c.slice(1).map((p) => [...p])); used.push(best.i); visited.add(best.i);
    }
    let length = 0; for (let k = 1; k < pts.length; k++) length += len(sub(pts[k], pts[k - 1]));
    lines.push({id: lines.length, points: pts, roads: used, length});
  };
  for (const s of starts) if (!visited.has(s.i)) trace(s.i, s.end);
  records.forEach((r, i) => { if (!visited.has(i)) trace(i, 0); });
  return lines;
}
