// Pure sidewalk and footpath network used for pedestrian routing and street rendering.
import {motorRoads, CROSSWALKS} from '../astra/traffic-simulation.js';
import {REGIONAL} from './regional.js';
import {WALK_GAP, ZEBRA_HALF_WIDTH, addScaled, direction, dot, midpoint, minus as sub, normal as perp, crossingRoad, spansCurbs, inJunction} from './crosswalks.js';

export const SIDEWALK = Object.freeze({gap: WALK_GAP, crossingCost: 6, crossingWeight: 1.6, corridor: .9});
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
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
export function surfaceIndex(surfaces, turningCircles = []) {
  const near = grid([...surfaces, ...turningCircles], (s) => [Math.min(s.a[0], s.b[0]) - s.hw - 2, Math.min(s.a[1], s.b[1]) - s.hw - 2, Math.max(s.a[0], s.b[0]) + s.hw + 2, Math.max(s.a[1], s.b[1]) + s.hw + 2]);
  // Depth inside the asphalt (positive = inside), over every surface piece.
  const depth = (p) => { let best = -Infinity; for (const s of near(p)) best = Math.max(best, s.hw - segDistance(p, s.a, s.b)); return best; };
  return {near, depth, inside: (p, tol = 0) => depth(p) > tol};
}

// Trace a short gap around the road profile when an offset corner is too tight
// for a straight sidewalk. Every candidate segment must clear the carriageway.
function sidewalkDetour(a, b, clear) {
  const step = .2, margin = 4;
  const min = a.map((v, i) => Math.min(v, b[i]) - margin);
  const max = a.map((v, i) => Math.max(v, b[i]) + margin);
  const size = max.map((v, i) => Math.ceil((v - min[i]) / step));
  const directions = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const queue = [{p: a, previous: null}], seen = new Set();
  for (let index = 0; index < queue.length; index++) {
    const node = queue[index];
    if (dist(node.p, b) < .5 && clear(node.p, b)) {
      const path = [b];
      for (let next = node; next; next = next.previous) path.unshift(next.p);
      const turns = [];
      for (let i = 0; i < path.length - 1;) {
        let j = path.length - 1;
        while (j > i + 1 && !clear(path[i], path[j])) j--;
        if (j < path.length - 1) turns.push(path[j]);
        i = j;
      }
      return turns;
    }
    const origin = node.p.map((v, i) => Math.round((v - min[i]) / step));
    for (const [dx, dz] of directions) {
      const x = origin[0] + dx, z = origin[1] + dz, key = x + size[0] * z;
      if (x < 0 || z < 0 || x >= size[0] || z >= size[1] || seen.has(key)) continue;
      const p = [min[0] + x * step, min[1] + z * step];
      if (!clear(node.p, p)) continue;
      seen.add(key);
      queue.push({p, previous: node});
    }
  }
  return null;
}

export function buildPedestrianGraph(town) {
  const surfaces = roadSurfaces(town);
  const turningCircles = (town.roads.flatMap((road) => road.ends ?? []))
    .filter((end) => end.terminus && !end.touches)
    .map(({pos}) => ({a: pos, b: pos, hw: REGIONAL.turnRadius, source: 'regional', turningCircle: true}));
  const index = surfaceIndex(surfaces, turningCircles);
  const nodes = [], edges = [], crossings = [], kerbs = [];
  const add = (pos, kind) => { nodes.push({pos: pos.map((v) => +v.toFixed(4)), kind}); edges.push([]); return nodes.length - 1; };
  const link = (a, b, {road, sidewalk = nodes[a]?.kind === 'kerb' && nodes[b]?.kind === 'kerb'} = {}) => {
    if (a === b || a === null || b === null || edges[a].some((e) => e.to === b)) return;
    const length = dist(nodes[a].pos, nodes[b].pos);
    const crossing = Boolean(road);
    const cost = crossing ? length * SIDEWALK.crossingWeight + SIDEWALK.crossingCost : length;
    const traits = {cost, crossing, sidewalk: sidewalk && !crossing, ...(road && {road})};
    edges[a].push({to: b, ...traits});
    edges[b].push({to: a, ...traits});
    if (crossing) crossings.push([a, b]);
  };

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
    for (let k = 1; k < s.cuts.length; k++) { const a = pointId(s.cuts[k - 1], s.source), b = pointId(s.cuts[k], s.source); if (a !== b && !legs.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) legs.push({a, b, start: s.cuts[k - 1], end: s.cuts[k], hw: s.hw, source: s.source}); }
  }
  legs.forEach((l, i) => { for (const [from, to] of [[l.a, l.b], [l.b, l.a]]) { const d = direction(pts[from].p, pts[to].p); pts[from].arms.push({leg: i, to, d, off: l.hw + SIDEWALK.gap, angle: Math.atan2(d[1], d[0])}); } });
  // 2) Corner points between consecutive arms; dead ends get two kerb points.
  for (const pt of pts) {
    pt.arms.sort((a, b) => a.angle - b.angle);
    const n = pt.arms.length; pt.corner = [];
    const circle = n === 1 && turningCircles.find(({a}) => dist(a, pt.p) < .05);
    if (circle) pt.arms[0].off = circle.hw + WALK_GAP;
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
      else {
        const l = add(pa, 'kerb'), r = add(pb, 'kerb');
        if (n > 1) kerbs.push([l, r]);
        else {
          // Continue both sidewalks around the carriageway's rounded end.
          let previous = l;
          for (let step = 1; step < 6; step++) {
            const angle = a.angle + Math.PI / 2 + Math.PI * step / 6;
            const next = add(addScaled(pt.p, [Math.cos(angle), Math.sin(angle)], a.off), 'kerb');
            kerbs.push([previous, next]);
            previous = next;
          }
          kerbs.push([previous, r]);
        }
        pt.corner.push({left: l, right: r});
      }
    }
  }
  // 3) Kerb edges along each leg, both sides.
  legs.forEach((l, legId) => {
    const A = pts[l.a], B = pts[l.b];
    const ka = A.arms.findIndex((a) => a.leg === legId), kb = B.arms.findIndex((a) => a.leg === legId);
    const na = A.arms.length, nb = B.arms.length;
    // Left of A->B (+perp) is corner k at A and corner k-1 at B.
    const aLeft = A.corner[ka].left, aRight = A.corner[(ka - 1 + na) % na].right;
    const bLeft = B.corner[(kb - 1 + nb) % nb].right, bRight = B.corner[kb].left;
    l.kerbs = [kerbs.length, kerbs.length + 1];
    kerbs.push([aLeft, bLeft], [aRight, bRight]);
  });
  const kerbSplits = kerbs.map(() => []);
  const clear = (a, b, tolerance = .005) => {
    const steps = Math.max(1, Math.ceil(dist(a, b) / .15));
    const d = sub(b, a);
    for (let i = 0; i <= steps; i++) if (index.inside(addScaled(a, d, i / steps), tolerance)) return false;
    return true;
  };
  const kerbStation = (p, id) => {
    const [u, v] = kerbs[id], a = nodes[u].pos, b = nodes[v].pos, d = sub(b, a);
    return dot(sub(p, a), d) / (dot(d, d) || 1);
  };
  const placed = [];
  function placeCrossing(leg, station, spacing = 2.2) {
    const d = direction(leg.start, leg.end), length = dist(leg.start, leg.end);
    if (station < ZEBRA_HALF_WIDTH || station > length - ZEBRA_HALF_WIDTH) return false;
    const center = addScaled(leg.start, d, station), offset = leg.hw + WALK_GAP;
    if (placed.some((p) => dist(p, center) < spacing)) return false;
    const landings = [addScaled(center, perp(d), offset), addScaled(center, perp(d), -offset)];
    const road = crossingRoad(index, ...landings);
    if (!road || !spansCurbs(index, road, ...landings) || inJunction(index, road, ...landings)) return false;
    if (!landings.every((p, side) => {
      const id = leg.kerbs[side], [u, v] = kerbs[id], a = nodes[u].pos, b = nodes[v].pos;
      const t = kerbStation(p, id);
      return t > .001 && t < .999 && segDistance(p, a, b) < 1.2 && clear(a, p) && clear(p, b);
    })) return false;
    const ids = landings.map((p, side) => {
      const id = add(p, 'kerb');
      kerbSplits[leg.kerbs[side]].push(id);
      return id;
    });
    link(...ids, {road});
    placed.push(center);
    return true;
  }
  // A road can contain several short straight pieces near an intersection.
  // Follow the arm past those samples, stopping at the next turn or junction.
  function crossArm(junction, first) {
    const firstLeg = legs[first.leg], end = Number(pts[firstLeg.b] === junction);
    const start = end ? firstLeg.end : firstLeg.start;
    const mouth = Math.max(firstLeg.hw, ...firstLeg.kerbs.map((id) => dot(sub(nodes[kerbs[id][end]].pos, start), first.d)));
    const min = mouth + 1.05, max = mouth + 4;
    let arm = first, travelled = 0;
    while (arm && travelled < max) {
      const leg = legs[arm.leg], length = dist(leg.start, leg.end), forward = leg.b === arm.to;
      const firstStation = Math.max(ZEBRA_HALF_WIDTH + .1, min - travelled);
      const lastStation = Math.min(length - ZEBRA_HALF_WIDTH - .1, max - travelled);
      for (let station = firstStation; station <= lastStation; station += .3) {
        if (placeCrossing(leg, forward ? station : length - station)) return;
      }
      const next = pts[arm.to];
      const continuation = next.arms.length === 2 && next.arms.find((a) => a.leg !== arm.leg && dot(a.d, first.d) > .995);
      travelled += length;
      arm = continuation;
    }
  }
  for (const pt of pts) {
    if (pt.arms.length >= 3) for (const arm of pt.arms) crossArm(pt, arm);
  }
  function crossingNear(p, maxOffset, spacing) {
    for (const leg of legs.filter((l) => segDistance(p, l.start, l.end) < maxOffset)) {
      const station = dot(sub(p, leg.start), direction(leg.start, leg.end));
      if (placeCrossing(leg, station, spacing)) return;
    }
  }
  for (const c of CROSSWALKS) crossingNear(c.point, .3, 3);

  function attach(id) {
    const p = nodes[id].pos;
    let best = null, distance = 4.5;
    kerbs.forEach(([u, v], i) => {
      const a = nodes[u].pos, b = nodes[v].pos;
      const t = Math.max(0, Math.min(1, kerbStation(p, i)));
      const q = addScaled(a, sub(b, a), t);
      const d = dist(p, q);
      if (d >= distance || !clear(p, q)) return;
      best = {i, q, endpoint: t === 0 ? u : t === 1 ? v : null};
      distance = d;
    });
    if (!best) return;
    const kerb = best.endpoint ?? add(best.q, 'kerb');
    if (best.endpoint === null) kerbSplits[best.i].push(kerb);
    link(id, kerb);
  }
  // 4) Clip footpaths at the kerb. A path on both sides can request a
  // perpendicular crossing if the nearby carriageway has room for one.
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
      if (!inside && prevIn) { const id = pnode(p); attach(id); if (entered !== null) crossingNear(midpoint(nodes[entered].pos, nodes[id].pos), .6, 5); entered = null; run = id; }
      if (k === steps && !inside) link(run, pnode(B));
      prev = p; prevIn = inside;
    }
  } });
  // 5) Materialise split kerb edges.
  kerbs.forEach(([p, q], i) => {
    const chain = [p, ...kerbSplits[i].sort((a, b) => kerbStation(nodes[a].pos, i) - kerbStation(nodes[b].pos, i)), q];
    for (let k = 1; k < chain.length; k++) link(chain[k - 1], chain[k]);
  });
  // 5b) Miters near mixed-width or closely spaced roads can clip asphalt.
  // Move those corners to clear ground, then detour the affected links locally.
  nodes.forEach((node, id) => {
    const p = node.pos;
    if (node.kind !== 'kerb' || edges[id].some((e) => e.crossing) || !index.inside(p, -.1)) return;
    for (let r = .1; r <= 5; r += .1) {
      for (let j = 0; j < 24; j++) {
        const angle = j * Math.PI / 12, q = addScaled(p, [Math.cos(angle), Math.sin(angle)], r);
        if (!index.inside(q, -.12)) { node.pos = q.map((v) => +v.toFixed(4)); return; }
      }
    }
  });
  for (let u = 0, count = nodes.length; u < count; u++) for (const edge of [...edges[u]]) {
    const v = edge.to, a = nodes[u].pos, b = nodes[v].pos;
    if (v <= u || edge.crossing || clear(a, b)) continue;
    edges[u] = edges[u].filter((e) => e.to !== v);
    edges[v] = edges[v].filter((e) => e.to !== u);
    const detour = sidewalkDetour(a, b, clear);
    if (!detour) continue;
    const chain = [u, ...detour.map((p) => add(p, edge.sidewalk ? 'kerb' : 'path')), v];
    for (let i = 1; i < chain.length; i++) link(chain[i - 1], chain[i], {sidewalk: edge.sidewalk});
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
