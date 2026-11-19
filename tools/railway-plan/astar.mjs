// Hybrid A* over a lattice of (x, z, heading) bins with a curvature-limited
// motion model: every expansion drives a 2 m arc at one of a few curvatures
// no tighter than 1/Rmin. A Dubins shot closes onto the exact goal pose.
// `rules.walk(samples, state)` judges each sampled stretch (see costmap.mjs).
import {dubins, samplePieces} from './dubins.mjs';

const TAU = Math.PI * 2;
const HEADINGS = 72, BIN = 1; // 5° heading bins, 1 m position bins

class Heap {
  constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) {
    const k = this.k, v = this.v; let i = k.length; k.push(key); v.push(val);
    while (i) { const p = (i - 1) >> 1; if (k[p] <= key) break; k[i] = k[p]; v[i] = v[p]; i = p; }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v, top = v[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && k[c + 1] < k[c]) c++; if (k[c] >= lk) break; k[i] = k[c]; v[i] = v[c]; i = c; }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
}

/**
 * plan({start, goal, R, rules, heuristic, maxExpand, weight})
 * start/goal: {x, z, th}. Returns {samples: [{x,z,th,k}], cost, expanded} or null.
 */
export function hybridAStar({start, goal, R, Rt = null, tightCost = 3, rules, heuristic, maxExpand = 4e6, weight = 1.25, step = 2, shotRange = 60, bounds}) {
  // Gentle curvatures always; the tight radius (Rt) only with a per-metre penalty.
  const curv = [0, 1 / R, -1 / R, .5 / R, -.5 / R, .25 / R, -.25 / R, ...(Rt ? [1 / Rt, -1 / Rt] : [])];
  const wb = Math.ceil((bounds.maxX - bounds.minX) / BIN), hb = Math.ceil((bounds.maxZ - bounds.minZ) / BIN);
  const keyOf = (x, z, th) => {
    const i = Math.floor((x - bounds.minX) / BIN), j = Math.floor((z - bounds.minZ) / BIN);
    if (i < 0 || j < 0 || i >= wb || j >= hb) return -1;
    const h = Math.floor((((th % TAU) + TAU) % TAU) / TAU * HEADINGS) % HEADINGS;
    return (j * wb + i) * HEADINGS + h;
  };
  const best = new Map(); // key -> best g
  const nodes = []; // {x, z, th, g, parent, samples, state, k}
  const heap = new Heap();
  const h0 = heuristic(start.x, start.z);
  if (!Number.isFinite(h0)) return null;
  nodes.push({x: start.x, z: start.z, th: start.th, g: 0, parent: -1, samples: [], state: rules.initial(start), k: 0});
  heap.push(weight * h0, 0);
  let expanded = 0, found = null;
  const tryShot = (ni) => {
    const n = nodes[ni];
    for (const RR of Rt ? [R * 2, R, Rt] : [R * 2, R]) for (const path of dubins(n, goal, RR).slice(0, 4)) {
      if (path.length > shotRange * 2.2) continue;
      const samples = samplePieces(n, path.pieces, RR, .5);
      const r = rules.walk(samples, n.state, true);
      if (r) return {samples, cost: r.cost + (RR < R ? tightCost * path.length : 0), state: r.state};
    }
    return null;
  };
  while (heap.size && expanded < maxExpand) {
    const ni = heap.pop(), n = nodes[ni];
    const key = keyOf(n.x, n.z, n.th);
    if (best.get(key) < n.g - 1e-9) continue;
    expanded++;
    const dg = Math.hypot(n.x - goal.x, n.z - goal.z);
    if (dg < shotRange && (dg < 18 || expanded % 8 === 0)) {
      const shot = tryShot(ni);
      if (shot) { found = {ni, shot}; break; }
    }
    for (const k of curv) {
      const samples = []; // arbitrary curvature, 4 samples per 2 m step
      let x = n.x, z = n.z, th = n.th;
      for (let s = 0; s < 4; s++) {
        const ds = step / 4;
        if (k === 0) { x += Math.cos(th) * ds; z += Math.sin(th) * ds; }
        else { const th2 = th + k * ds; x += (Math.sin(th2) - Math.sin(th)) / k; z += (Math.cos(th) - Math.cos(th2)) / k; th = th2; }
        samples.push({x, z, th, k});
      }
      const r = rules.walk(samples, n.state, false);
      if (!r) continue;
      const turn = (k === n.k ? 0 : Math.abs(k - n.k) * R * .6) + (Math.abs(k) > 1.01 / R ? tightCost * step : 0); // discourage flips and tight curves
      const g = n.g + r.cost + turn;
      const ck = keyOf(x, z, th); if (ck < 0) continue;
      if ((best.get(ck) ?? Infinity) <= g) continue;
      const h = heuristic(x, z); if (!Number.isFinite(h)) continue;
      best.set(ck, g);
      nodes.push({x, z, th, g, parent: ni, samples, state: r.state, k});
      heap.push(g + weight * h, nodes.length - 1);
    }
  }
  if (!found) return {failed: true, expanded};
  const chain = [];
  for (let i = found.ni; i > 0; i = nodes[i].parent) chain.push(nodes[i].samples);
  const samples = [{x: start.x, z: start.z, th: start.th, k: 0}, ...chain.reverse().flat(), ...found.shot.samples];
  return {samples, cost: nodes[found.ni].g + found.shot.cost, expanded};
}

/**
 * Shortcut smoothing: replace stretches with single Dubins curves when the
 * rules accept them and they cost less. Keeps endpoints and headings fixed.
 */
export function smooth(samples, {R, rules, passes = 3}) {
  let pts = samples;
  const costOf = (list, state) => rules.walk(list, state, true);
  for (let pass = 0; pass < passes; pass++) {
    const out = [pts[0]];
    let i = 0, state = rules.initial(pts[0]);
    while (i < pts.length - 1) {
      let done = false;
      for (let span = Math.min(pts.length - 1 - i, 400); span >= 8; span = Math.floor(span * .7)) {
        const j = i + span, a = pts[i], b = pts[j];
        const old = costOf(pts.slice(i + 1, j + 1), state);
        for (const [RR, path] of [R * 3, R * 2, R].flatMap((RR) => dubins(a, b, RR).slice(0, 2).map((p) => [RR, p]))) {
          const cand = samplePieces(a, path.pieces, RR, .5);
          const r = costOf(cand, state);
          if (r && old && r.cost < old.cost - .05) { out.push(...cand); state = r.state; i = j; done = true; break; }
        }
        if (done) break;
      }
      if (!done) { const r = costOf([pts[i + 1]], state); state = r?.state ?? state; out.push(pts[i + 1]); i++; }
    }
    pts = out;
  }
  return pts;
}
