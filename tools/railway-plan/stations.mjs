// Site platforms on dry land, with a walk of at most 60 m (TOWN-18) from the
// landmark entrance and a clear link to the sidewalk graph.
import survey from './route.json' with {type: 'json'};
import {buildPedestrianGraph} from '../../src/roads/pedestrian.js';
import {RULES, F, corridor} from './costmap.mjs';
import {segDist, dist} from './grid.mjs';

// Platforms may be shortened where the land is tight, never below the
// passenger section of the consist (29 m, the shortest platform in service).
export const PLATFORM = Object.freeze({near: 1.45, far: 4.05, ramp: 1.5, approach: 1, walkLimit: 60, walkTarget: 57, minLength: 29});

export function stopsFor() {
  return survey.stations.map((st) => ({...st, old: st.was}));
}

/** Sidewalk graph without the current railway's access links, and walk distances from each landmark. */
export function walkGraph(town) {
  const graph = buildPedestrianGraph({...town, roads: town.roads.filter((r) => !r.station || r.surveyApproach)});
  const fromOrigin = (origin) => {
    const n = graph.nodes.length, D = new Float64Array(n).fill(Infinity), heap = [];
    const s = graph.nearest(origin); if (s < 0) return D;
    const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[i], heap[m]] = [heap[m], heap[i]]; i = m; } } return top; };
    D[s] = dist(origin, graph.nodes[s].pos); push(D[s], s);
    while (heap.length) { const [d, u] = pop(); if (d > D[u]) continue; for (const e of graph.edges[u]) { const nd = d + dist(graph.nodes[u].pos, graph.nodes[e.to].pos); if (nd < D[e.to]) { D[e.to] = nd; push(nd, e.to); } } }
    return D;
  };
  return {graph, fromOrigin};
}

/** Geometry of a platform pose: track centre c, unit direction d, side s (+1 = left of d). */
export function platformGeometry(c, d, side, length) {
  const n = [-d[1] * side, d[0] * side], h = length / 2, P = PLATFORM;
  const at = (along, out) => [c[0] + d[0] * along + n[0] * out, c[1] + d[1] * along + n[1] * out];
  return {n, polygon: [at(-h, P.near), at(h, P.near), at(h, P.far), at(-h, P.far)],
    withRamps: [at(-h - P.ramp, P.near), at(h + P.ramp, P.near), at(h + P.ramp, P.far), at(-h - P.ramp, P.far)],
    entry: at(0, P.far - .3), at, half: h + P.ramp + P.approach};
}

export function searchStation(W, stop, walk, rules, opts = {}) {
  for (const length of [...new Set([stop.length, 36, 32, PLATFORM.minLength].filter((L) => L <= stop.length))]) {
    const found = searchAt(W, {...stop, length}, walk, rules, opts);
    if (found.length) return found.map((o) => ({...o, length, shortened: length < stop.length}));
  }
  return [];
}
function searchAt(W, stop, walk, rules, {radius = 62, step = 2, headings = 24, keep = 40, walkTarget = PLATFORM.walkTarget, relaxed = false, extraNodes = [], site = null} = {}) {
  const {grid, cm, H} = W, Z = corridor(), D = walk.fromOrigin(stop.origin), nodes = walk.graph.nodes;
  const cellOf = (p) => { const i = grid.ix(p[0]), j = grid.iz(p[1]); return i < 0 || j < 0 || i >= grid.w || j >= grid.h ? -1 : j * grid.w + i; };
  const near = [...nodes.map((nd, i) => ({i, pos: nd.pos, D: D[i]})), ...extraNodes.map((x) => ({i: -1, ...x}))].filter((x) => Number.isFinite(x.D) && x.D < walkTarget && dist(x.pos, stop.origin) < radius + 40);
  const out = [];
  for (let dz = -radius; dz <= radius; dz += step) for (let dx = -radius; dx <= radius; dx += step) {
    if (Math.hypot(dx, dz) > radius) continue;
    const c = [stop.origin[0] + dx, stop.origin[1] + dz], c0 = cellOf(c);
    if (site && dist(c, site.c) > .01) continue;
    if (c0 < 0 || cm.flags[c0] & (F.BAN | F.ROAD | F.PATH | F.SLOPE | F.BORE)) continue;
    for (let k = 0; k < headings; k++) {
      if (site && site.heading !== k) continue;
      const th = k / headings * Math.PI, d = [Math.cos(th), Math.sin(th)];
      // Straight track through the platform and its approaches.
      const L = stop.length / 2 + PLATFORM.ramp + PLATFORM.approach, samples = [];
      for (let t = -L; t <= L + 1e-9; t += .5) samples.push({x: c[0] + d[0] * t, z: c[1] + d[1] * t, th, k: 0});
      const r = rules.walk(samples, rules.initial(), true);
      if (!r || samples.some((q) => cm.flags[cellOf([q.x, q.z])] & (F.ROAD | F.PATH | F.SLOPE | F.BORE))) continue;
      // A train must be able to leave each end: some 14 m arc (straight, R 11..88 either way) is clear.
      const exits = [1, -1].map((sgn) => {
        const p0 = {x: c[0] + d[0] * L * sgn, z: c[1] + d[1] * L * sgn, th: sgn > 0 ? th : th + Math.PI};
        return [0, 1, -1, .5, -.5, .25, -.25, 2, -2].some((kk) => {
          const k = kk / RULES.Rmin, list = []; let x = p0.x, z = p0.z, a = p0.th;
          for (let s = 0; s < 28; s++) { if (k === 0) { x += Math.cos(a) * .5; z += Math.sin(a) * .5; } else { const a2 = a + k * .5; x += (Math.sin(a2) - Math.sin(a)) / k; z += (Math.cos(a) - Math.cos(a2)) / k; a = a2; } list.push({x, z, th: a, k}); }
          return rules.walk(list, rules.initial(), false);
        });
      });
      if (!exits[0] || !exits[1]) continue;
      for (const side of [1, -1]) {
        if (site && site.side !== side) continue;
        const g = platformGeometry(c, d, side, stop.length);
        // Platform and ramps on dry, open land: no building, lot, plaza, prop, road, path, water or hillside.
        let ok = true;
        for (let a = -g.half + PLATFORM.approach; a <= g.half - PLATFORM.approach + 1e-9 && ok; a += .5) for (let o = PLATFORM.near; o <= PLATFORM.far + 1e-9; o += .5) {
          const q = g.at(a, o), cc = cellOf(q);
          if (cc < 0 || grid.fields.hard[cc] < .35 || grid.fields.road[cc] < .35 || grid.fields.path[cc] < .35 || H[cc] > RULES.open) { ok = false; break; }
        }
        if (!ok) continue;
        // Footpath link from the back of the platform to the sidewalk graph.
        let best = null;
        for (const nd of near) {
          const len = dist(g.entry, nd.pos), walkLen = nd.D + len;
          if (walkLen > walkTarget || (best && walkLen >= best.walk)) continue;
          if (((nd.pos[0] - g.entry[0]) * g.n[0] + (nd.pos[1] - g.entry[1]) * g.n[1]) < -.5) continue; // leaves away from the track
          let clear = true, roads = 0, onRoad = false;
          const m = Math.max(1, Math.ceil(len / .5));
          for (let s = 1; s <= m && clear; s++) {
            const q = [g.entry[0] + (nd.pos[0] - g.entry[0]) * s / m, g.entry[1] + (nd.pos[1] - g.entry[1]) * s / m], cc = cellOf(q), tail = (m - s) * .5;
            if (cc < 0 || grid.fields.sea[cc] < .5 || grid.fields.water[cc] < .5 || grid.fields.stream[cc] < .5 || H[cc] > .3) clear = false;
            else if (tail > 2 && grid.fields.hard[cc] < .4) clear = false;
            else if (tail > 2 && grid.fields.road[cc] < .3) { if (!relaxed) clear = false; else if (!onRoad) { roads++; onRoad = true; } }
            else if (segDist(q, g.at(-g.half, 0), g.at(g.half, 0)) < Z + .4 && s > 2) clear = false;
            else onRoad = false;
          }
          if (clear) best = {node: nd.i, nodePos: nd.pos, link: len, walk: walkLen, newCrosswalks: roads, ...(nd.proposed && {proposed: nd.proposed})};
        }
        if (!best) continue;
        const clearance = Math.min(...samples.map((q) => grid.fields.hard[cellOf([q.x, q.z])]));
        out.push({stop: stop.id, c, th, d, side, ...g, walk: best.walk, link: best, clearance,
          score: best.walk - 2 * Math.min(clearance, 6) + .02 * dist(c, stop.old ?? c)});
      }
    }
  }
  out.sort((a, b) => a.score - b.score);
  // Keep a spread of distinct options (different places or headings).
  const kept = [];
  for (const o of out) { if (kept.some((k) => dist(k.c, o.c) < 6 && Math.abs(Math.sin(k.th - o.th)) < .2)) continue; kept.push(o); if (kept.length >= keep) break; }
  return kept;
}
