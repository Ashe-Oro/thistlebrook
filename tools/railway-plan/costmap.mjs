// Cost map and motion rules for the planner, derived from the obstacle grid.
// Flags per 0.5 m cell describe what the rail centre line may do there.
import {segDist} from './grid.mjs';

export const RULES = Object.freeze({
  half: 1.2,            // ballast / sleeper half width (RAIL.half)
  clearance: .8,        // lateral clearance beyond the ballast to anything hard
  Rmin: 22,             // minimum centre-line radius on the running line (m)
  RminTight: 11,        // allowed with a cost where the land allows nothing wider (old line: 6 m at Union)
  tightCorridorRadius: 15,
  tightInside: 2.5,
  roadTol: 7,           // planner tolerance from perpendicular at a road (validator: 10°)
  pathTol: 35,          // footpath / trail crossings may be skewed this much
  tunnelClear: 4.6,     // bore clearance (TUNNEL.clearance)
  tunnelMargin: 1.5,    // extra rock over the bore crown
  boreWall: 2.2,        // half width of the bore at its walls
  boreFlank: 4.5,       // cover beyond the lining, measured on either side
  flankCover: 2,
  portalHeight: 5.5,
  portalWing: 3,
  wingCover: 3,
  maxHood: 8,           // portal hood / wing-wall length at each end (m)
  open: .05,            // terrain above the bed that still counts as open ground
  maxGrade: .02,
  separation: 7,
  alongside: 1.5,       // within this (beyond the corridor) of a carriageway the track may not run parallel to it
  alongTol: 40,         // ... 'parallel' = within this many degrees of the road direction        // closest approach of two different parts of the loop (centre to centre)
  cost: {road: 45, path: 6, portal: 14, bore: .2, tree: 2.6, soft: 1.6, beach: 1.2, coast: .6, near: .7},
});
export const F = Object.freeze({BAN: 1, ROAD: 2, PATH: 4, SLOPE: 16, BORE: 32, NEAR: 64});
export const corridor = () => RULES.half + RULES.clearance;

/** Two-pass chamfer distance (metres) from cells where mask[c] is set. */
export function chamfer(w, h, res, mask) {
  const D = new Float32Array(w * h).fill(1e9), a = res, b = res * Math.SQRT2;
  for (let c = 0; c < w * h; c++) if (mask[c]) D[c] = 0;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const c = j * w + i; let v = D[c];
    if (i > 0) v = Math.min(v, D[c - 1] + a);
    if (j > 0) { v = Math.min(v, D[c - w] + a); if (i > 0) v = Math.min(v, D[c - w - 1] + b); if (i < w - 1) v = Math.min(v, D[c - w + 1] + b); }
    D[c] = v;
  }
  for (let j = h - 1; j >= 0; j--) for (let i = w - 1; i >= 0; i--) {
    const c = j * w + i; let v = D[c];
    if (i < w - 1) v = Math.min(v, D[c + 1] + a);
    if (j < h - 1) { v = Math.min(v, D[c + w] + a); if (i < w - 1) v = Math.min(v, D[c + w + 1] + b); if (i > 0) v = Math.min(v, D[c + w - 1] + b); }
    D[c] = v;
  }
  return D;
}
/** Max (or min) of `src` over a disc of radius r (metres), separable square approximation refined by disc offsets. */
export function discFilter(w, h, res, src, r, op = Math.max) {
  const k = Math.ceil(r / res), offs = [];
  for (let dj = -k; dj <= k; dj++) for (let di = -k; di <= k; di++) if (Math.hypot(di, dj) * res <= r + 1e-9) offs.push([di, dj]);
  const out = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let v = src[j * w + i];
    for (const [di, dj] of offs) { const x = i + di, z = j + dj; if (x < 0 || z < 0 || x >= w || z >= h) continue; v = op(v, src[z * w + x]); }
    out[j * w + i] = v;
  }
  return out;
}

/**
 * Build flags and per-cell step cost. `grid` holds distance fields painted
 * by layers.mjs; `terrain` is {height: Float32Array over the grid (m above
 * the ground plane)}.
 */
export function buildCostmap(grid, layers) {
  const {w, h, n, res} = grid, Z = corridor();
  const {terrain: H} = layers;
  const flags = new Uint8Array(n), cost = new Float32Array(n), roadDir = new Float32Array(n * 2), pathDir = new Float32Array(n * 2);
  const hard = new Float32Array(n).fill(grid.cap);
  for (const name of layers.hard) { const f = grid.fields[name]; if (f) for (let c = 0; c < n; c++) if (f[c] < hard[c]) hard[c] = f[c]; }
  grid.fields.hard = hard;
  const road = grid.fields.road, path = grid.fields.path, tree = grid.fields.tree;
  const soft = grid.fields.soft, beach = grid.fields.beach, sea = grid.fields.sea;
  // Terrain classes: open ground, portal slope (hood), covered bore.
  const foot = discFilter(w, h, res, H, Z, Math.max);
  const isOpen = new Uint8Array(n), isBore = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    if (foot[c] <= RULES.open) isOpen[c] = 1;
    else if (H[c] >= RULES.tunnelClear + RULES.tunnelMargin) isBore[c] = 1;
  }
  const dOpen = chamfer(w, h, res, isOpen), dBore = chamfer(w, h, res, isBore);
  grid.fields.terrainFoot = foot;
  const ownerDir = (name, c, out) => {
    const shapes = grid[name + 'Shapes'], k = grid.owner[name][c]; if (k < 0) return false;
    const s = shapes[k], p = [grid.cx(c % w), grid.cz(Math.floor(c / w))];
    let d = null;
    if (s.type === 'seg') d = [s.b[0] - s.a[0], s.b[1] - s.a[1]];
    else if (s.type === 'line') { let best = Infinity; for (let i = 1; i < s.pts.length; i++) { const e = segDist(p, s.pts[i - 1], s.pts[i]); if (e < best) { best = e; d = [s.pts[i][0] - s.pts[i - 1][0], s.pts[i][1] - s.pts[i - 1][1]]; } } }
    else if (s.dir) d = s.dir;
    if (!d) return false;
    const L = Math.hypot(...d); out[c * 2] = d[0] / L; out[c * 2 + 1] = d[1] / L; return true;
  };
  for (let c = 0; c < n; c++) {
    let f = 0;
    if (hard[c] < Z) f |= F.BAN;
    if (road && road[c] < Z + RULES.alongside) { const ok = ownerDir('road', c, roadDir); if (road[c] < Z) { f |= F.ROAD; if (!ok) f |= F.BAN; } else if (ok) f |= F.NEAR; }
    if (path && path[c] < Z) { f |= F.PATH; if (!ownerDir('path', c, pathDir)) f |= F.BAN; }
    if (isBore[c]) f |= F.BORE;
    else if (!isOpen[c]) { f |= F.SLOPE; if (dOpen[c] > RULES.maxHood + 1 || dBore[c] > RULES.maxHood + 1) f |= F.BAN; }
    flags[c] = f;
    let k = 1;
    if (hard[c] < Z + 3) k += RULES.cost.near * (Z + 3 - hard[c]) / 3;
    if (soft && soft[c] < Z) k += RULES.cost.soft;
    if (beach && beach[c] < Z) k += RULES.cost.beach;
    if (sea && sea[c] < Z + 6) k += RULES.cost.coast;
    if (f & F.BORE) k += RULES.cost.bore;
    cost[c] = k * res + (tree && tree[c] < Z + 1.4 ? RULES.cost.tree : 0);
  }
  // Junction mouths: no level crossing where two road directions meet.
  if (road) {
    const shapes = grid.roadShapes, cell = 16, hash = new Map();
    shapes.forEach((s, k) => { const pts = s.type === 'seg' ? [s.a, s.b] : s.pts; const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      for (let x = Math.floor((Math.min(...xs) - 12) / cell); x <= Math.floor((Math.max(...xs) + 12) / cell); x++) for (let z = Math.floor((Math.min(...zs) - 12) / cell); z <= Math.floor((Math.max(...zs) + 12) / cell); z++) { const key = x + ',' + z; if (!hash.has(key)) hash.set(key, []); hash.get(key).push(k); } });
    for (let c = 0; c < n; c++) {
      if (!(flags[c] & F.ROAD) || flags[c] & F.BAN) continue;
      const p = [grid.cx(c % w), grid.cz(Math.floor(c / w))], d0 = [roadDir[c * 2], roadDir[c * 2 + 1]];
      for (const k of hash.get(Math.floor(p[0] / cell) + ',' + Math.floor(p[1] / cell)) ?? []) {
        const s = shapes[k], segs = s.type === 'seg' ? [[s.a, s.b, s.hw]] : s.pts.slice(1).map((b, i) => [s.pts[i], b, s.hw]);
        let hit = false;
        for (const [a, b, hw] of segs) {
          if (segDist(p, a, b) - hw > Z + 2) continue;
          const L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 1e-6) continue;
          const cos = Math.abs((b[0] - a[0]) * d0[0] + (b[1] - a[1]) * d0[1]) / L;
          if (cos < Math.cos(12 * Math.PI / 180)) { hit = true; break; }
        }
        if (hit) { flags[c] |= F.BAN; break; }
      }
    }
  }
  return {flags, cost, roadDir, pathDir, hard, H};
}

/** Per-leg motion rules over the cost map. `used` bans other parts of the loop. */
export function legRules(grid, cm, used) {
  const {w, h, minX, minZ, res} = grid, Z = corridor(), C = RULES.cost;
  const cosAlong = Math.cos(RULES.alongTol * Math.PI / 180), cosRoad = Math.sin(RULES.roadTol * Math.PI / 180), cosPath = Math.sin(RULES.pathTol * Math.PI / 180);
  const cellOf = (x, z) => { const i = Math.floor((x - minX) / res), j = Math.floor((z - minZ) / res); return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i; };
  const height = (x, z) => {
    const u = (x - minX) / res - .5, v = (z - minZ) / res - .5;
    const i = Math.floor(u), j = Math.floor(v);
    if (i < 0 || j < 0 || i >= w - 1 || j >= h - 1) return 0;
    const c = j * w + i, a = u - i, b = v - j, H = cm.H;
    return (H[c] * (1 - a) + H[c + 1] * a) * (1 - b) + (H[c + w] * (1 - a) + H[c + w + 1] * a) * b;
  };
  return {
    initial: () => ({road: 0, path: 0, terr: 0, from: 0, slopeRun: 0}),
    walk(samples, st, final) {
      let s = {...st}, cost = 0;
      for (const q of samples) {
        const c = cellOf(q.x, q.z); if (c < 0) return null;
        const f = cm.flags[c]; if (f & F.BAN || used?.[c]) return null;
        const dx = Math.cos(q.th), dz = Math.sin(q.th), straight = Math.abs(q.k) < 1e-9;
        // Level crossings: straight and square to the carriageway, gates on dry kerbs.
        if (f & F.ROAD) {
          if (!straight || Math.abs(dx * cm.roadDir[c * 2] + dz * cm.roadDir[c * 2 + 1]) > cosRoad) return null;
          if (!s.road) {
            cost += C.road;
            for (const side of [-1, 1]) { const g = cellOf(q.x - dz * side * 3, q.z + dx * side * 3); if (g < 0 || cm.hard[g] < .6) return null; }
          }
          s.road = 1;
        } else if (s.road) {
          for (const side of [-1, 1]) { const g = cellOf(q.x - dz * side * 3, q.z + dx * side * 3); if (g < 0 || cm.hard[g] < .6) return null; }
          s.road = 0;
        }
        if (f & F.NEAR && Math.abs(dx * cm.roadDir[c * 2] + dz * cm.roadDir[c * 2 + 1]) > cosAlong) return null; // running along a road
        if (f & F.PATH) {
          if (!straight || Math.abs(dx * cm.pathDir[c * 2] + dz * cm.pathDir[c * 2 + 1]) > cosPath) return null;
          if (!s.path) cost += C.path;
          s.path = 1;
        } else s.path = 0;
        // Terrain: open -> hood (straight) -> bore -> hood -> open; no cuttings.
        let t = 0;
        if (f & (F.BORE | F.SLOPE)) {
          const h = (o) => height(q.x - dz * o, q.z + dx * o);
          const both = (o, min) => h(-o) >= min && h(o) >= min;
          if (h(0) >= RULES.tunnelClear + RULES.tunnelMargin + .12
            && both(RULES.boreWall, RULES.tunnelClear + .12)
            && both(RULES.boreFlank, RULES.flankCover + .12)
            && both(RULES.portalWing, RULES.wingCover + .12)) t = 2;
          else if (Math.max(h(-Z), h(-Z / 2), h(0), h(Z / 2), h(Z)) > RULES.open) t = 1;
        }
        if (t === 1) {
          if (!straight) return null;
          if (s.terr === 0) { s.from = 0; s.slopeRun = 0; cost += C.portal; }
          else if (s.terr === 2) { s.from = 2; s.slopeRun = 0; }
          s.slopeRun += .5; if (s.slopeRun > RULES.maxHood + Z + .5) return null;
        } else if (t === 0 && s.terr === 1 && s.from === 0) return null; // a cutting into a hillside
        else if (t === 2 && s.terr === 1 && s.from === 2) return null;  // bore -> hood -> bore again without daylight
        else if (t === 2 && s.terr === 0) return null;                 // a bore needs a portal hood
        else if (t === 0 && s.terr === 2) return null;
        s.terr = t;
        cost += cm.cost[c];
      }
      if (final && (s.road || s.terr)) return null;
      return {cost, state: s};
    },
  };
}

/** Coarse 1 m Dijkstra from the goal over cells that are not banned (admissible heuristic). */
export function distanceHeuristic(grid, cm, used, goal) {
  const res = 1, W = Math.ceil((grid.maxX - grid.minX) / res), H = Math.ceil((grid.maxZ - grid.minZ) / res), k = Math.round(res / grid.res);
  const free = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let ok = 0;
    for (let b = 0; b < k && !ok; b++) for (let a = 0; a < k && !ok; a++) { const c = (j * k + b) * grid.w + i * k + a; if (c < grid.n && !(cm.flags[c] & 1) && !used?.[c]) ok = 1; }
    free[j * W + i] = ok;
  }
  const D = new Float64Array(W * H).fill(Infinity), gi = Math.floor((goal.x - grid.minX) / res), gj = Math.floor((goal.z - grid.minZ) / res);
  const heapK = [], heapV = [];
  const push = (key, v) => { let i = heapK.length; heapK.push(key); heapV.push(v); while (i) { const p = (i - 1) >> 1; if (heapK[p] <= key) break; heapK[i] = heapK[p]; heapV[i] = heapV[p]; i = p; } heapK[i] = key; heapV[i] = v; };
  const pop = () => { const top = heapV[0], lk = heapK.pop(), lv = heapV.pop(), n = heapK.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && heapK[c + 1] < heapK[c]) c++; if (heapK[c] >= lk) break; heapK[i] = heapK[c]; heapV[i] = heapV[c]; i = c; } heapK[i] = lk; heapV[i] = lv; } return top; };
  const s0 = gj * W + gi; D[s0] = 0; push(0, s0); free[s0] = 1;
  const nb = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  while (heapK.length) {
    const u = pop(), du = D[u], ui = u % W, uj = (u - ui) / W;
    for (const [di, dj, L] of nb) {
      const i = ui + di, j = uj + dj; if (i < 0 || j < 0 || i >= W || j >= H) continue;
      const v = j * W + i; if (!free[v]) continue;
      const nd = du + L * res; if (nd < D[v]) { D[v] = nd; push(nd, v); }
    }
  }
  return (x, z) => { const i = Math.floor((x - grid.minX) / res), j = Math.floor((z - grid.minZ) / res); if (i < 0 || j < 0 || i >= W || j >= H) return Infinity; return D[j * W + i]; };
}
