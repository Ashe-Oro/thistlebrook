import survey from './route.json' with {type: 'json'};
// Turn a planned loop into the reviewable plan record (tools/railway-plan/route.json):
// a closed 1 m centre line with heights, segment types, every crossing,
// tunnel, bridge and station, the trees cleared, and the costs. Measurements
// use exact shapes and the terrain raycaster, not the planning grid.
import {shapeDist, shapeBounds, segDist, dist} from './grid.mjs';
import {RULES, corridor} from './costmap.mjs';
import {PLATFORM} from './stations.mjs';
import {RAIL} from '../../src/compiler/railway.js';
import {groundAt} from '../../src/compiler/water.js';
import {sampleTrack, terrainSection, hasFace, hasBoreCover} from './tunnel.mjs';
import {walkBetween} from '../../src/roads/pedestrian.js';

const r3 = (v) => +v.toFixed(3), r2 = (v) => +v.toFixed(2), P = (p) => p.map(r3);

/** Spatial hash over shapes for exact nearest queries. */
export function shapeIndex(shapes, cell = 16) {
  const map = new Map();
  shapes.forEach((s, k) => {
    const [x0, z0, x1, z1] = shapeBounds(s);
    if (x1 - x0 > 2000) { (map.get('*') ?? map.set('*', []).get('*')).push(k); return; }
    for (let x = Math.floor(x0 / cell); x <= Math.floor(x1 / cell); x++) for (let z = Math.floor(z0 / cell); z <= Math.floor(z1 / cell); z++) {
      const key = x + ',' + z; if (!map.has(key)) map.set(key, []); map.get(key).push(k);
    }
  });
  const near = (p, r = 0) => {
    const out = new Set(map.get('*') ?? []);
    for (let x = Math.floor((p[0] - r) / cell); x <= Math.floor((p[0] + r) / cell); x++) for (let z = Math.floor((p[1] - r) / cell); z <= Math.floor((p[1] + r) / cell); z++) for (const k of map.get(x + ',' + z) ?? []) out.add(k);
    return [...out].map((k) => shapes[k]);
  };
  return {near, nearest(p, r = 12) { let best = {d: Infinity, s: null}; for (const s of near(p, r)) { const d = shapeDist(s, p); if (d < best.d) best = {d, s}; } return best; }};
}

/** Uniform resampling of a closed polyline at `step` metres: [{p, d, s}]. */
export function resampleClosed(points, step = 1) {
  const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 1e-6);
  if (dist(pts[0], pts.at(-1)) < 1e-6) pts.pop();
  const seg = pts.map((p, i) => dist(p, pts[(i + 1) % pts.length])), total = seg.reduce((a, b) => a + b, 0);
  const n = Math.round(total / step), ds = total / n, out = [];
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const s = k * ds;
    while (acc + seg[i] < s && i < pts.length - 1) { acc += seg[i]; i++; }
    const a = pts[i], b = pts[(i + 1) % pts.length], t = seg[i] ? (s - acc) / seg[i] : 0;
    const d = [(b[0] - a[0]) / (seg[i] || 1), (b[1] - a[1]) / (seg[i] || 1)];
    out.push({p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d, s});
  }
  return {samples: out, length: total};
}

/** Circumradius of three points (Infinity when collinear). */
export const radius3 = (a, b, c) => {
  const A = dist(b, c), B = dist(a, c), C = dist(a, b), cross = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  return cross < 1e-9 ? Infinity : A * B * C / (2 * cross);
};

/** Runs of consecutive sample indices (cyclic) where pred(i) holds: [[i0, i1], ...]. */
export function runs(n, pred) {
  const on = Array.from({length: n}, (_, i) => pred(i)), out = [];
  if (on.every(Boolean)) return [[0, n - 1]];
  let start = on.findIndex((v, i) => !v && on[(i + 1) % n]); if (start < 0) return [];
  for (let k = 1; k <= n; k++) {
    const i = (start + k) % n;
    if (on[i] && !on[(i - 1 + n) % n]) out.push([i, i]);
    if (on[i]) out.at(-1)[1] = i;
  }
  return out;
}

export function describePlan(W, {stops, stations, loop, walk}) {
  const {town, layers, terrain} = W, Z = corridor(), half = RAIL.half;
  // 1) Closed centre line: station straight, leg, next station straight ...
  const raw = [];
  stations.forEach((st, i) => {
    const pose = loop.poses[i];
    raw.push([pose.start.x, pose.start.z], [pose.end.x, pose.end.z]);
    for (const q of loop.legs[i].samples.slice(1)) raw.push([q.x, q.z]);
  });
  const {samples, length} = resampleClosed(raw, 1), n = samples.length, step = length / n;
  const idx = {road: shapeIndex(layers.road), scatter: shapeIndex(layers.scatter),
    lot: shapeIndex(layers.lot), building: shapeIndex(layers.building), parcel: shapeIndex(layers.parcel), prop: shapeIndex(layers.prop)};
  const left = (q) => [-q.d[1], q.d[0]], off = (q, o) => [q.p[0] + left(q)[0] * o, q.p[1] + left(q)[1] * o];
  const footprint = [-half, -half / 2, 0, half / 2, half];
  for (const q of samples) {
    q.ground = groundAt(town, q.p);
    q.road = Math.min(...footprint.map((o) => idx.road.nearest(off(q, o), 8).d));
  }
  // Ease changes in ground datum without lowering the rail head below ground.
  const profileGrade = .75 * RULES.maxGrade;
  samples.forEach((q, i) => {
    q.y = q.ground;
    for (let j = -8; j <= 8; j++) {
      const near = samples[(i + j + n) % n];
      q.y = Math.max(q.y, near.ground - Math.abs(j) * step * profileGrade);
    }
  });
  // Stations claim their straights.
  const stationRec = stations.map((st, i) => {
    const pose = loop.poses[i], a = [pose.start.x, pose.start.z], b = [pose.end.x, pose.end.z];
    const on = samples.map((q, k) => segDist(q.p, a, b) < .05 && dist(q.p, a) > .01 ? k : -1).filter((k) => k >= 0);
    on.forEach((k) => { samples[k].station = st.id; });
    return {st, pose, a, b, on};
  });
  // Tunnels include the covered approaches from daylight to the rocky portal faces.
  const track = sampleTrack(samples.map((q) => ({p: P(q.p), y: r3(q.y)})), r2(length));
  const sections = track.map((q) => terrainSection(terrain, q));
  const wrap = (s) => (s + length) % length;
  const spans = runs(track.length, (i) => sections[i].bed > RULES.open);
  const tunnels = spans.map(([i0, i1], t) => {
    const span = [];
    for (let i = i0; ; i = (i + 1) % track.length) {
      span.push(i);
      if (i === i1) break;
    }
    const portalFits = (i) => hasFace(sections[i]) && hasBoreCover(sections[i]);
    const faceA = span.findIndex(portalFits), faceB = span.findLastIndex(portalFits);
    const bore = faceA < 0 ? [] : span.slice(faceA, faceB + 1);
    const hoodA = (faceA + 1) * step / 4, hoodB = (span.length - faceB) * step / 4;
    const at = track[i0].p.map(r2);
    const gap = bore.find((i) => !hasBoreCover(sections[i]));
    if (bore.length < 2 || hoodA > RULES.maxHood || hoodB > RULES.maxHood || gap != null) {
      const detail = gap == null ? `hoods ${r2(hoodA)}/${r2(hoodB)} m` : `cover gap at [${track[gap].p.map(r2)}]`;
      throw Error(`No valid tunnel cross section near [${at}] (${detail})`);
    }
    const id = 'tunnel-' + t;
    const from = wrap(track[i0].s - step / 4), to = wrap(track[i1].s + step / 4);
    for (const q of samples) if (wrap(q.s - from + .01) < wrap(to - from)) q.tunnel = id;
    const mountains = [...new Set(bore.map((i) => terrain.hit(...track[i].p).id))];
    const mountain = terrain.hit(...track[bore[Math.floor(bore.length / 2)]].p).id;
    const portal = (index, end) => {
      const i = span[index], q = track[i], section = sections[i];
      return {end, pos: P(q.p), s: r2(q.s), y: r3(q.y), outward: q.d.map((v) => r3(end === 'a' ? -v : v)),
        faceHeight: r2(section.crown), wingHeight: r2(section.wings)};
    };
    const portals = [portal(faceA, 'a'), portal(faceB, 'b')];
    const min = (key) => r2(Math.min(...bore.map((i) => sections[i][key])));
    return {id, mountain, mountains, name: null, portals, length: r2(wrap(portals[1].s - portals[0].s)),
      boreLength: r2((faceB - faceA) * step / 4),
      hoods: [r2(hoodA), r2(hoodB)], hoodTreatment: 'earth-berm',
      minCover: min('crown'), minWallCover: min('walls'), minFlankCover: min('flank'),
      required: {cover: RULES.tunnelClear + RULES.tunnelMargin, walls: RULES.tunnelClear, flank: RULES.flankCover, maxHood: RULES.maxHood},
      s: portals.map((p) => p.s), approach: [r2(from), r2(to)]};
  });
  // 5) Level crossings.
  const crossings = runs(n, (i) => samples[i].road < .01).map(([i0, i1], k) => {
    const span = []; for (let i = i0; ; i = (i + 1) % n) { span.push(i); if (i === i1) break; }
    let best = span[0], bestD = Infinity, road = null;
    for (const i of span) { const nr = idx.road.nearest(samples[i].p, 8); const cl = nr.s && (nr.s.type === 'seg' ? segDist(samples[i].p, nr.s.a, nr.s.b) : Math.min(...nr.s.pts.slice(1).map((b, j) => segDist(samples[i].p, nr.s.pts[j], b)))); if (cl < bestD) { bestD = cl; best = i; road = nr.s; } }
    const q = samples[best];
    let rd;
    if (road.type === 'seg') rd = [road.b[0] - road.a[0], road.b[1] - road.a[1]];
    else { let bb = Infinity; for (let j = 1; j < road.pts.length; j++) { const e = segDist(q.p, road.pts[j - 1], road.pts[j]); if (e < bb) { bb = e; rd = [road.pts[j][0] - road.pts[j - 1][0], road.pts[j][1] - road.pts[j - 1][1]]; } } }
    const L = Math.hypot(...rd); rd = [rd[0] / L, rd[1] / L];
    const angle = Math.acos(Math.min(1, Math.abs(rd[0] * q.d[0] + rd[1] * q.d[1]))) * 180 / Math.PI;
    span.forEach((i) => { samples[i].crossing = 'crossing-' + k; });
    // Deck: road footprint plus a kerb/verge margin each side. Gates stand on the kerb, right of each approach.
    const a = samples[(i0 - 2 + n) % n], b = samples[(i1 + 2) % n];
    const gates = [[a, 1], [b, -1]].map(([g, sgn]) => { const l = left(g); return [g.p[0] - l[0] * 2.3 * sgn, g.p[1] - l[1] * 2.3 * sgn]; });
    const deckPts = [a, ...span.map((i) => samples[i]), b];
    const clear = Math.min(...deckPts.flatMap((g) => footprint.map((o) => off(g, o))).flatMap((p) => ['lot', 'building', 'parcel'].map((c) => idx[c].nearest(p, 12).d)));
    const curvature = Math.max(...deckPts.slice(1, -1).map((g, j) => { const r = radius3(deckPts[j].p, g.p, deckPts[j + 2].p); return r === Infinity ? 0 : 1 / r; }));
    return {id: 'crossing-' + k, road: road.src, kind: road.kind ?? null, name: road.name ?? null, at: P(q.p), s: r2(q.s), angle: r2(angle), deviation: r2(90 - angle),
      railDir: q.d.map(r3), roadDir: rd.map(r3), deck: {from: r2(a.s), to: r2(b.s), length: deckPts.length - 1, y: r3(q.ground), flush: true, continuousRails: true},
      gates: gates.map(P), gateRoadClear: gates.map((g) => r2(idx.road.nearest(g).d)), gateLot: gates.map((g) => r2(Math.min(idx.lot.nearest(g).d, idx.parcel.nearest(g).d, idx.building.nearest(g).d))),
      clearanceToLotOrBuilding: r2(clear), maxCurvatureOnDeck: +curvature.toFixed(5)};
  });
  // 6) Stations: platform, walk, access link.
  const graph = walk.graph;
  const stationsOut = stationRec.map(({st, pose, a, b, on}) => {
    const g = st, entry = g.entry, s0 = on.length ? samples[on[Math.floor(on.length / 2)]].s : 0;
    const nodePos = g.link.nodePos;
    const path = g.link.node >= 0 ? walkBetween(graph, st.stop.origin, nodePos) : [];
    let walkLen = g.link.node >= 0 ? dist(st.stop.origin, path[0].pos) + path.slice(1).reduce((acc, p, i) => acc + dist(path[i].pos, p.pos), 0) + dist(path.at(-1).pos, nodePos) + g.link.link : g.link.link;
    return {id: st.stop.id, name: st.stop.name, short: st.stop.short, district: st.stop.district, landmark: st.stop.landmark, origin: P(st.stop.origin), centre: P(g.c), s: r2(s0), dir: pose.d.map(r3),
      side: g.side, length: g.length, lengthBefore: st.stop.length, shortened: Boolean(g.shortened), platform: g.polygon.map(P), platformWithRamps: g.withRamps.map(P), entry: P(entry),
      access: {to: P(nodePos), length: r2(g.link.link), newCrosswalks: g.link.newCrosswalks ?? 0, proposed: g.link.proposed ?? null, approach: st.stop.access.approach},
      walk: r2(walkLen), walkLimit: PLATFORM.walkLimit, walkPath: [...path.map((p) => P(p.pos)), P(nodePos), P(entry)], walkOver: walkLen > PLATFORM.walkLimit,
      throughParkWalk: g.link.proposed ? r2(g.link.proposed.throughPark + g.link.link) : undefined, mainEntrance: st.stop.mainEntrance ? P(st.stop.mainEntrance) : undefined, was: st.stop.old, wasExisting: st.stop.wasExisting};
  });
  // 7) Trees and scatter cleared (crowns over the ballast, open track and platforms).
  const scatter = new Map();
  for (const q of samples) {
    if (q.tunnel && terrain.height(...q.p) - q.y > 2) continue;
    for (const t of idx.scatter.near(q.p, 3)) if (dist(t.c, q.p) < half + .5) scatter.set(t.id ?? t.src, {id: t.id ?? t.src, pos: P(t.c), asset: t.asset ?? null});
  }
  // 8) Segment types along the loop.
  const typeOf = (q) => q.station ? 'station' : q.tunnel ? 'tunnel' : q.crossing ? 'crossing' : 'surface';
  const segments = [];
  samples.forEach((q, i) => { const t = typeOf(q), ref = q.station ?? q.tunnel ?? q.crossing ?? null; if (segments.at(-1)?.type === t && segments.at(-1).ref === ref) segments.at(-1).to = r2(q.s + length / n); else segments.push({type: t, ref, from: r2(q.s), to: r2(q.s + length / n)}); });
  for (const [i, seg] of segments.entries()) {
    if (seg.type !== 'tunnel') continue;
    const [from, to] = tunnels.find((t) => t.id === seg.ref).approach;
    segments[(i - 1 + segments.length) % segments.length].to = seg.from = from;
    segments[(i + 1) % segments.length].from = seg.to = to;
  }
  if (segments.length > 1 && segments[0].type === segments.at(-1).type && segments[0].ref === segments.at(-1).ref) { segments[0].from = segments.at(-1).from; segments.pop(); }
  let minR = Infinity, minRAt = samples[0], maxGrade = 0, maxGradeAt = samples[0];
  for (let i = 0; i < n; i++) {
    const a = samples[(i - 4 + n) % n], b = samples[i], c = samples[(i + 4) % n], r = radius3(a.p, b.p, c.p);
    if (r < minR) { minR = r; minRAt = b; }
    const next = samples[(i + 1) % n], g = Math.abs(r3(next.y) - r3(b.y)) / dist(b.p, next.p);
    if (g > maxGrade) { maxGrade = g; maxGradeAt = b; }
  }
  const legR = loop.legs.map((l, i) => ({from: stations[i].id, to: stations[(i + 1) % stations.length].id, R: l.R, cost: r2(l.cost),
    length: r2(l.samples.slice(1).reduce((acc, q, k) => acc + Math.hypot(q.x - l.samples[k].x, q.z - l.samples[k].z), 0))}));
  const stationCost = stationRec.reduce((acc, r) => acc + r.on.length, 0);
  const totalCost = loop.legs.reduce((acc, l) => acc + l.cost, 0) + stationCost;
  return {
    meta: {spec: 'docs/specs/overnight/RAILWAY-REROUTE.md', stage: 'A (plan only)', seed: 831, generator: 'tools/railway-plan.mjs', grid: {res: W.grid.res, minX: W.grid.minX, minZ: W.grid.minZ, maxX: W.grid.maxX, maxZ: W.grid.maxZ},
      rules: RULES, footprint: {ballastHalf: half, corridorHalf: Z, tightInside: RULES.tightInside}, platform: PLATFORM, centrelineClosure: 'last-to-first', loopOrder: stops.map((s) => s.id),
      layers: Object.fromEntries(Object.entries(layers).map(([k, v]) => [k, v.length])), renderedFootprint: Boolean(W.rendered)},
    summary: {length: r2(length), samples: n, closed: dist(samples[0].p, samples.at(-1).p) < 1.5, minRadius: r2(minR), minRadiusAt: P(minRAt.p), minRadiusMainline: r2(minR),
      tightLegs: legR.filter((l) => l.R !== RULES.Rmin), maxGrade: +(maxGrade * 100).toFixed(3) + '%', maxGradeAt: P(maxGradeAt.p),
      crossings: crossings.length, tunnels: tunnels.length, tunnelLength: r2(tunnels.reduce((a, t) => a + t.length, 0)), bridges: 0, stations: stationsOut.length,
      treesCleared: 0, scatterCleared: scatter.size, overWater: 0, totalCost: r2(totalCost), oldLength: survey.summary.oldLength},
    service: survey.service,
    terrain: survey.terrain,
    legs: legR,
    centreline: samples.map((q) => [r3(q.p[0]), r3(q.p[1]), r3(q.y)]),
    segments, crossings, tunnels, bridges: [], stations: stationsOut,
    treesCleared: [], scatterCleared: [...scatter.values()],
    proposals: stationsOut.filter((s) => s.access.proposed).map((s) => ({...s.access.proposed, station: s.id, path: s.access.proposed.path.map(P)})),
    oldLine: survey.oldLine,
  };
}
