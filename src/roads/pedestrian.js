// OWNER: grok-roads lane. Pedestrian network (pure; no THREE, no DOM).
//
// Root cause this fixes: residents used to route on town.nodes/edges, which is
// built from road CENTERLINES, so every walk went down the middle of the
// asphalt. This module derives a separate walk graph: kerb-side sidewalks on
// both sides of every carriageway, footpaths clipped at the kerb, and crossing
// edges only at junction mouths, road ends and authored crosswalks (or where a
// footpath runs straight across a road). Walkers path-find on this graph.
import {motorRoads, CROSSWALKS} from '../astra/traffic-simulation.js';
import {REGIONAL} from './regional.js';

export const SIDEWALK = Object.freeze({gap: .55, crossingCost: 6, crossingWeight: 1.6, corridor: .9});
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const len = (v) => Math.hypot(v[0], v[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (v) => { const l = len(v) || 1; return [v[0] / l, v[1] / l]; };
const perp = (d) => [-d[1], d[0]];
export function segDistance(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
function lineIntersect(p, d, q, e) {
  const den = d[0] * e[1] - d[1] * e[0]; if (Math.abs(den) < 1e-6) return null;
  const w = sub(q, p), t = (w[0] * e[1] - w[1] * e[0]) / den; return [p[0] + d[0] * t, p[1] + d[1] * t];
}

/** Every visible carriageway as straight pieces with half widths. */
export function roadSurfaces(town) {
  const out = [], seen = new Set();
  const add = (a, b, hw, source) => {
    if (dist(a, b) < .01) return; const k = [a, b].map((p) => p.map((v) => v.toFixed(2)).join(',')).sort().join('|');
    if (seen.has(k)) return; seen.add(k); out.push({a: [...a], b: [...b], hw, source});
  };
  for (const r of town.roads) if (r.kind === 'avenue') add(r.a, r.b, r.width / 2, 'town');
  for (const r of motorRoads(town)) add(r.a, r.b, r.width / 2, 'town');
  for (const r of town.roads) if (r.kind === 'world-link' && r.centerline) for (let i = 1; i < r.centerline.length; i++) add(r.centerline[i - 1], r.centerline[i], REGIONAL.width / 2, 'regional');
  return out;
}

/** Spatial hash for fast nearest-surface queries. */
function grid(items, boxOf, cell = 8) {
  const map = new Map(), keyOf = (x, z) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
  items.forEach((it, i) => { const [x0, z0, x1, z1] = boxOf(it); for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++) for (let z = Math.floor(z0 / cell); z <= Math.floor(z1 / cell); z++) { const k = `${x},${z}`; if (!map.has(k)) map.set(k, []); map.get(k).push(i); } });
  return (p, r = 0) => { const s = new Set(); for (let x = Math.floor((p[0] - r) / cell); x <= Math.floor((p[0] + r) / cell); x++) for (let z = Math.floor((p[1] - r) / cell); z <= Math.floor((p[1] + r) / cell); z++) for (const i of map.get(`${x},${z}`) || []) s.add(i); return [...s].map((i) => items[i]); };
}
export function surfaceIndex(surfaces) {
  const near = grid(surfaces, (s) => [Math.min(s.a[0], s.b[0]) - s.hw - 2, Math.min(s.a[1], s.b[1]) - s.hw - 2, Math.max(s.a[0], s.b[0]) + s.hw + 2, Math.max(s.a[1], s.b[1]) + s.hw + 2]);
  // Depth inside the asphalt (positive = inside), over every surface piece.
  const depth = (p) => { let best = -Infinity; for (const s of near(p)) best = Math.max(best, s.hw - segDistance(p, s.a, s.b)); return best; };
  return {near, depth, inside: (p, tol = 0) => depth(p) > tol};
}

export function buildPedestrianGraph(town) {
  const surfaces = roadSurfaces(town), index = surfaceIndex(surfaces);
  const nodes = [], edges = [], crossings = [], kerbs = [];
  const add = (pos, kind) => { nodes.push({pos: pos.map((v) => +v.toFixed(4)), kind}); edges.push([]); return nodes.length - 1; };
  const link = (a, b, crossing = false) => { if (a === b || a < 0 || b < 0 || edges[a].some((e) => e.to === b)) return; const w = dist(nodes[a].pos, nodes[b].pos); const cost = crossing ? w * SIDEWALK.crossingWeight + SIDEWALK.crossingCost : w; edges[a].push({to: b, cost, crossing}); edges[b].push({to: a, cost, crossing}); if (crossing) crossings.push([a, b]); };

  // 1) Road graph: merge near-coincident ends (authored 1-2 m jogs become one
  // junction) and split pieces at T-touches and crossings.
  const pts = [];
  const pointId = (p, source) => { const r = source === 'town' ? 2.05 : .05; for (let i = 0; i < pts.length; i++) if (dist(pts[i].p, p) < (pts[i].source === 'town' && source === 'town' ? r : .05)) return i; pts.push({p: [...p], arms: [], source}); return pts.length - 1; };
  const raw = surfaces.map((s) => ({...s, cuts: [s.a, s.b]}));
  for (const s of raw) for (const t of raw) if (s !== t) for (const e of [t.a, t.b]) if (segDistance(e, s.a, s.b) < .05 && dist(e, s.a) > .05 && dist(e, s.b) > .05) s.cuts.push(e);
  for (let i = 0; i < raw.length; i++) for (let j = i + 1; j < raw.length; j++) {
    const s = raw[i], t = raw[j], u = sub(s.b, s.a), v = sub(t.b, t.a), den = u[0] * v[1] - u[1] * v[0]; if (Math.abs(den) < 1e-8) continue;
    const w = sub(t.a, s.a), x = (w[0] * v[1] - w[1] * v[0]) / den, y = (w[0] * u[1] - w[1] * u[0]) / den;
    if (x > .001 && x < .999 && y > .001 && y < .999) { const p = [s.a[0] + x * u[0], s.a[1] + x * u[1]]; s.cuts.push(p); t.cuts.push(p); }
  }
  const legs = [];
  for (const s of raw) {
    s.cuts.sort((p, q) => dist(p, s.a) - dist(q, s.a));
    for (let k = 1; k < s.cuts.length; k++) { const a = pointId(s.cuts[k - 1], s.source), b = pointId(s.cuts[k], s.source); if (a !== b && !legs.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) legs.push({a, b, hw: s.hw, source: s.source}); }
  }
  legs.forEach((l, i) => { for (const [from, to] of [[l.a, l.b], [l.b, l.a]]) { const d = unit(sub(pts[to].p, pts[from].p)); pts[from].arms.push({leg: i, to, d, off: l.hw + SIDEWALK.gap, angle: Math.atan2(d[1], d[0])}); } });
  // 2) Corner points between consecutive arms; dead ends get two kerb points.
  const crosswalkAt = (p) => CROSSWALKS.some((c) => dist(c.point, p) < 1.2);
  for (const pt of pts) {
    pt.arms.sort((a, b) => a.angle - b.angle);
    const n = pt.arms.length; pt.corner = [];
    for (let k = 0; k < n; k++) {
      const a = pt.arms[k], b = pt.arms[(k + 1) % n];
      const pa = [pt.p[0] + perp(a.d)[0] * a.off, pt.p[1] + perp(a.d)[1] * a.off], pb = [pt.p[0] - perp(b.d)[0] * b.off, pt.p[1] - perp(b.d)[1] * b.off];
      let gap = b.angle - a.angle; if (n === 1) gap = 2 * Math.PI; else if (gap <= 0) gap += 2 * Math.PI;
      let c;
      if (n === 1) c = null;
      else if (Math.abs(gap - Math.PI) < .35) c = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
      else c = lineIntersect(pa, a.d, pb, b.d); // inner corner, or the outer miter of a bend
      if (c && dist(c, pt.p) > 3 * Math.max(a.off, b.off)) c = null;
      if (c) { const id = add(c, 'kerb'); pt.corner.push({left: id, right: id}); }
      else { const l = add(pa, 'kerb'), r = add(pb, 'kerb'); if (n > 1) link(l, r); pt.corner.push({left: l, right: r}); } // at a dead end the pair is joined by a crossing below
    }
    // Crossing edges across each arm mouth: at junctions, corners, dead ends
    // and painted crosswalks; never mid-block on a straight road.
    const straight = n === 2 && Math.abs(Math.abs(pt.arms[1].angle - pt.arms[0].angle) - Math.PI) < .35;
    if (n === 1) link(pt.corner[0].left, pt.corner[0].right, true);
    else if (!straight || crosswalkAt(pt.p)) for (let k = 0; k < n; k++) link(pt.corner[(k - 1 + n) % n].right, pt.corner[k].left, true);
  }
  // 3) Kerb edges along each leg, both sides.
  for (const l of legs) {
    const A = pts[l.a], B = pts[l.b], ka = A.arms.findIndex((a) => a.leg === legs.indexOf(l) && a.to === l.b), kb = B.arms.findIndex((a) => a.leg === legs.indexOf(l) && a.to === l.a);
    const na = A.arms.length, nb = B.arms.length;
    // Left of A->B (+perp) is corner k at A and corner k-1 at B.
    const aLeft = A.corner[ka].left, aRight = A.corner[(ka - 1 + na) % na].right;
    const bLeft = B.corner[(kb - 1 + nb) % nb].right, bRight = B.corner[kb].left;
    for (const [p, q] of [[aLeft, bLeft], [aRight, bRight]]) kerbs.push([p, q]);
  }
  // Authored crosswalks part-way along a leg.
  const kerbSplits = kerbs.map(() => []);
  for (const c of CROSSWALKS) {
    const leg = legs.find((l) => segDistance(c.point, pts[l.a].p, pts[l.b].p) < .3); if (!leg) continue;
    const d = unit(sub(pts[leg.b].p, pts[leg.a].p)), o = leg.hw + SIDEWALK.gap;
    const l = add([c.point[0] + perp(d)[0] * o, c.point[1] + perp(d)[1] * o], 'kerb'), r = add([c.point[0] - perp(d)[0] * o, c.point[1] - perp(d)[1] * o], 'kerb');
    link(l, r, true); for (const id of [l, r]) attach(id);
  }
  function attach(id) { // split the nearest kerb edge at node id
    let best = -1, bd = 1.2; kerbs.forEach(([p, q], i) => { const d = segDistance(nodes[id].pos, nodes[p].pos, nodes[q].pos); if (d < bd) { bd = d; best = i; } });
    if (best >= 0) { kerbSplits[best].push(id); return true; }
    let near = -1, nd = 5.2; nodes.forEach((n, i) => { if (i !== id && n.kind === 'kerb') { const d = dist(n.pos, nodes[id].pos); if (d < nd) { nd = d; near = i; } } });
    if (near >= 0) { link(id, near); return true; } return false;
  }
  // 4) Footpaths: every town-graph edge that is not a carriageway, clipped at
  // the kerb line. A path that runs straight across a road gets a crossing.
  const kerbZone = (p) => index.depth(p) > -SIDEWALK.gap + .02;
  const onAxis = (p, q) => index.near(p).some((s) => segDistance(p, s.a, s.b) < .06 && segDistance(q, s.a, s.b) < .06 && segDistance([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], s.a, s.b) < .06);
  const pathNode = new Map(), pathKey = (p) => p.map((v) => v.toFixed(3)).join(',');
  const pnode = (p) => { const k = pathKey(p); if (!pathNode.has(k)) pathNode.set(k, add(p, 'path')); return pathNode.get(k); };
  town.edges.forEach((list, u) => { for (const v of list) {
    if (v < u) continue; const A = town.nodes[u], B = town.nodes[v]; if (onAxis(A, B)) continue;
    const L = dist(A, B), steps = Math.max(1, Math.ceil(L / .1));
    let prev = A, prevIn = kerbZone(A), run = prevIn ? null : pnode(A), entered = null;
    for (let k = 1; k <= steps; k++) {
      const p = k === steps ? B : [A[0] + (B[0] - A[0]) * k / steps, A[1] + (B[1] - A[1]) * k / steps], inside = kerbZone(p);
      if (inside && !prevIn) { const id = pnode(prev); link(run, id); attach(id); entered = id; run = null; }
      if (!inside && prevIn) { const id = pnode(p); attach(id); if (entered !== null) link(entered, id, true); entered = null; run = id; }
      if (k === steps && !inside) link(run, pnode(B));
      prev = p; prevIn = inside;
    }
  } });
  // 5) Materialise split kerb edges.
  kerbs.forEach(([p, q], i) => {
    const chain = [p, ...kerbSplits[i].sort((a, b) => dist(nodes[a].pos, nodes[p].pos) - dist(nodes[b].pos, nodes[p].pos)), q];
    for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
  });
  // 5b) Relax: authored 1-2 m jogs and mixed widths can leave a kerb point or
  // edge clipping a neighbouring carriageway. Push such points out to the kerb
  // line, and bend clipping edges around the asphalt with extra points.
  const outward = (p) => {
    for (let k = 0; k < 6; k++) {
      const d0 = index.depth(p); if (d0 <= -SIDEWALK.gap + .03) break;
      const e = .05, g = [index.depth([p[0] + e, p[1]]) - index.depth([p[0] - e, p[1]]), index.depth([p[0], p[1] + e]) - index.depth([p[0], p[1] - e])], u = unit(g);
      if (!len(g)) break; const step = d0 + SIDEWALK.gap + .01; p = [p[0] - u[0] * step, p[1] - u[1] * step];
    }
    return p.map((v) => +v.toFixed(4));
  };
  nodes.forEach((n) => { if (n.kind === 'kerb' && index.depth(n.pos) > -SIDEWALK.gap + .03) n.pos = outward(n.pos); });
  const clips = (a, b) => { for (let k = 1; k < 12; k++) { const p = [a[0] + (b[0] - a[0]) * k / 12, a[1] + (b[1] - a[1]) * k / 12]; if (index.depth(p) > -.05) return p; } return null; };
  // Bounded: each pass only revisits nodes that existed when it started, so
  // overlapping asphalt (e.g. the old stacked regional ribbons) cannot grow it forever.
  for (let pass = 0; pass < 3; pass++) for (let u = 0, n0 = nodes.length; u < n0; u++) for (const e of [...edges[u]]) {
    if (e.to < u || e.crossing) continue; const hit = clips(nodes[u].pos, nodes[e.to].pos); if (!hit) continue;
    const v = e.to, m = add(outward(hit), 'kerb');
    edges[u] = edges[u].filter((x) => x.to !== v); edges[v] = edges[v].filter((x) => x.to !== u); link(u, m); link(m, v);
  }
  // 6) Map town nodes onto the walk graph.
  const nearNode = grid(nodes, (n) => [n.pos[0], n.pos[1], n.pos[0], n.pos[1]], 6);
  const nearest = (p, r = 6) => { let best = -1, bd = Infinity; for (let rr = r; best < 0 && rr < 400; rr *= 2) for (const n of nearNode(p, rr)) { const i = nodes.indexOf(n), d = dist(n.pos, p); if (edges[i].length && d < bd) { bd = d; best = i; } } return best; };
  return {nodes, edges, crossings, surfaces, index, legs, roadPoints: pts, nearest};
}

const cache = new WeakMap();
export function pedestrianGraph(town) { if (!cache.has(town)) cache.set(town, buildPedestrianGraph(town)); return cache.get(town); }

/** Shortest walk between two positions. Returns [{pos, cross}] where cross
 * marks a point reached by stepping across a carriageway. */
export function walkBetween(graph, from, to) {
  const s = graph.nearest(from), t = graph.nearest(to); if (s < 0 || t < 0) return [{pos: [...to]}];
  const n = graph.nodes.length, d = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), via = new Uint8Array(n);
  const heap = [[0, s]]; d[s] = 0;
  const push = (x) => { heap.push(x); let i = heap.length - 1; while (i) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break; [heap[i], heap[j]] = [heap[j], heap[i]]; i = j; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
  while (heap.length) { const [c, u] = pop(); if (c > d[u]) continue; if (u === t) break; for (const e of graph.edges[u]) { const nd = c + e.cost; if (nd < d[e.to]) { d[e.to] = nd; prev[e.to] = u; via[e.to] = e.crossing ? 1 : 0; push([nd, e.to]); } } }
  if (!Number.isFinite(d[t])) return [{pos: [...graph.nodes[s].pos]}, {pos: [...to]}];
  const out = []; for (let i = t; i !== -1; i = prev[i]) out.unshift({pos: [...graph.nodes[i].pos], cross: !!via[i]});
  return out;
}
