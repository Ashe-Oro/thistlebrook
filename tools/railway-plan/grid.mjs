// Raster layers for the railway route planner. Each obstacle class keeps a
// distance field (metres from the nearest shape of that class, capped at
// `cap`), filled by exact point-to-shape distances over each shape's padded
// bounding box. Shapes are the ones in layers.mjs; nothing is hand-copied here.

export const GRID = Object.freeze({minX: -262, minZ: -292, maxX: 402, maxZ: 402, res: .5, cap: 12});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function segDist(p, a, b) {
  const d = sub(b, a), L = dot(d, d), t = L ? Math.max(0, Math.min(1, dot(sub(p, a), d) / L)) : 0;
  return Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t);
}
export function polygonContains(poly, p) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
/** Signed-free distance from p to a shape (0 inside). */
export function shapeDist(s, p) {
  switch (s.type) {
    case 'seg': return Math.max(0, segDist(p, s.a, s.b) - s.hw);
    case 'circle': return Math.max(0, dist(p, s.c) - s.r);
    case 'ellipse': { // approximate: scale to unit circle, back to metres along the minor axis
      const dx = (p[0] - s.c[0]), dz = (p[1] - s.c[1]), cs = Math.cos(s.rot ?? 0), sn = Math.sin(s.rot ?? 0);
      const u = (dx * cs + dz * sn) / s.rx, v = (-dx * sn + dz * cs) / s.rz, k = Math.hypot(u, v);
      return k <= 1 ? 0 : (k - 1) * Math.min(s.rx, s.rz);
    }
    case 'box': {
      const dx = Math.max(s.min[0] - p[0], 0, p[0] - s.max[0]), dz = Math.max(s.min[1] - p[1], 0, p[1] - s.max[1]);
      return Math.hypot(dx, dz);
    }
    case 'obb': { // centre, half sizes, yaw (x/z)
      const dx = p[0] - s.c[0], dz = p[1] - s.c[1], cs = Math.cos(s.yaw), sn = Math.sin(s.yaw);
      const u = dx * cs - dz * sn, v = dx * sn + dz * cs;
      return Math.hypot(Math.max(Math.abs(u) - s.hx, 0), Math.max(Math.abs(v) - s.hz, 0));
    }
    case 'poly': {
      if (polygonContains(s.pts, p)) return 0;
      let best = Infinity;
      for (let i = 0; i < s.pts.length; i++) best = Math.min(best, segDist(p, s.pts[i], s.pts[(i + 1) % s.pts.length]));
      return best;
    }
    case 'line': { // open polyline with half width
      let best = Infinity;
      for (let i = 1; i < s.pts.length; i++) best = Math.min(best, segDist(p, s.pts[i - 1], s.pts[i]) - s.hw);
      return Math.max(0, best);
    }
    case 'outside': { // the sea: everything outside a closed polygon
      if (!polygonContains(s.pts, p)) return 0;
      let best = Infinity;
      for (let i = 0; i < s.pts.length; i++) best = Math.min(best, segDist(p, s.pts[i], s.pts[(i + 1) % s.pts.length]));
      return best;
    }
    case 'band': { // a strip of `width` inside a closed polygon's edge (shore sand)
      if (!polygonContains(s.pts, p)) return 0;
      let best = Infinity;
      for (let i = 0; i < s.pts.length; i++) best = Math.min(best, segDist(p, s.pts[i], s.pts[(i + 1) % s.pts.length]));
      return Math.max(0, best - s.width);
    }
    default: throw new Error('shape type ' + s.type);
  }
}
export function shapeBounds(s) {
  switch (s.type) {
    case 'seg': return [Math.min(s.a[0], s.b[0]) - s.hw, Math.min(s.a[1], s.b[1]) - s.hw, Math.max(s.a[0], s.b[0]) + s.hw, Math.max(s.a[1], s.b[1]) + s.hw];
    case 'circle': return [s.c[0] - s.r, s.c[1] - s.r, s.c[0] + s.r, s.c[1] + s.r];
    case 'ellipse': { const r = Math.max(s.rx, s.rz); return [s.c[0] - r, s.c[1] - r, s.c[0] + r, s.c[1] + r]; }
    case 'box': return [s.min[0], s.min[1], s.max[0], s.max[1]];
    case 'obb': { const r = Math.hypot(s.hx, s.hz); return [s.c[0] - r, s.c[1] - r, s.c[0] + r, s.c[1] + r]; }
    case 'outside': case 'band': return [-1e4, -1e4, 1e4, 1e4];
    case 'poly': case 'line': {
      const h = s.hw ?? 0, xs = s.pts.map((p) => p[0]), zs = s.pts.map((p) => p[1]);
      return [Math.min(...xs) - h, Math.min(...zs) - h, Math.max(...xs) + h, Math.max(...zs) + h];
    }
  }
}
/** Direction (unit x/z) of a linear shape nearest p, or null. */
export function shapeDir(s, p) {
  if (s.type === 'seg') { const d = sub(s.b, s.a), L = Math.hypot(...d); return L ? [d[0] / L, d[1] / L] : null; }
  if (s.type === 'line') {
    let best = Infinity, dir = null;
    for (let i = 1; i < s.pts.length; i++) { const e = segDist(p, s.pts[i - 1], s.pts[i]); if (e < best) { best = e; const d = sub(s.pts[i], s.pts[i - 1]), L = Math.hypot(...d); dir = [d[0] / L, d[1] / L]; } }
    return dir;
  }
  return s.dir ?? null;
}

export class Grid {
  constructor(g = GRID) {
    Object.assign(this, g);
    this.w = Math.round((g.maxX - g.minX) / g.res); this.h = Math.round((g.maxZ - g.minZ) / g.res);
    this.n = this.w * this.h; this.fields = {}; this.owner = {};
  }
  ix(x) { return Math.floor((x - this.minX) / this.res); }
  iz(z) { return Math.floor((z - this.minZ) / this.res); }
  cx(i) { return this.minX + (i + .5) * this.res; }
  cz(j) { return this.minZ + (j + .5) * this.res; }
  field(name) {
    if (!this.fields[name]) { this.fields[name] = new Float32Array(this.n).fill(this.cap); this.owner[name] = new Int32Array(this.n).fill(-1); }
    return this.fields[name];
  }
  /** Rasterise shapes into a distance field; owner keeps the nearest shape index. */
  paint(name, shapes, pad = this.cap) {
    const f = this.field(name), own = this.owner[name];
    shapes.forEach((s, k) => {
      const [x0, z0, x1, z1] = shapeBounds(s);
      const i0 = Math.max(0, this.ix(x0 - pad)), i1 = Math.min(this.w - 1, this.ix(x1 + pad));
      const j0 = Math.max(0, this.iz(z0 - pad)), j1 = Math.min(this.h - 1, this.iz(z1 + pad));
      for (let j = j0; j <= j1; j++) {
        const z = this.cz(j);
        for (let i = i0; i <= i1; i++) {
          const c = j * this.w + i, d = shapeDist(s, [this.cx(i), z]);
          if (d < f[c]) { f[c] = d; own[c] = k; }
        }
      }
    });
    this[name + 'Shapes'] = shapes;
    return f;
  }
  /** Bilinear-free lookup (nearest cell). */
  at(name, p) {
    const i = this.ix(p[0]), j = this.iz(p[1]);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return name === 'sea' ? 0 : this.cap;
    return this.fields[name]?.[j * this.w + i] ?? this.cap;
  }
  ownerAt(name, p) {
    const i = this.ix(p[0]), j = this.iz(p[1]);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return -1;
    return this.owner[name]?.[j * this.w + i] ?? -1;
  }
}
