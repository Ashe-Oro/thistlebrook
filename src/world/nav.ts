// Walkable grid (0.5 m cells) + A* with path smoothing. Grows with the town bounds.
export class NavGrid {
  minX: number; minZ: number; w: number; h: number; cell: number; blocked: Uint8Array; cost: Float32Array;
  private g: Float32Array; private came: Int32Array; private seen: Uint32Array; private closed: Uint32Array; private generation = 0;
  constructor(b: { minX: number; maxX: number; minZ: number; maxZ: number }, cell = 0.5) {
    this.cell = cell; this.minX = b.minX; this.minZ = b.minZ;
    this.w = Math.ceil((b.maxX - b.minX) / cell); this.h = Math.ceil((b.maxZ - b.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h); this.cost = new Float32Array(this.w * this.h).fill(1);
    const n = this.w * this.h; this.g = new Float32Array(n); this.came = new Int32Array(n); this.seen = new Uint32Array(n); this.closed = new Uint32Array(n);
  }
  ix(x: number) { return Math.floor((x - this.minX) / this.cell); } iz(z: number) { return Math.floor((z - this.minZ) / this.cell); }
  wx(i: number) { return this.minX + (i + .5) * this.cell; } wz(j: number) { return this.minZ + (j + .5) * this.cell; }
  inside(i: number, j: number) { return i >= 0 && j >= 0 && i < this.w && j < this.h; }
  isFree(x: number, z: number) { const i = this.ix(x), j = this.iz(z); return this.inside(i, j) && !this.blocked[j * this.w + i]; }
  // Mark an oriented rectangle (centre, half sizes, rotation) as blocked (v=1) or free (v=0).
  rect(cx: number, cz: number, hx: number, hz: number, rot: number, v = 1) {
    const c = Math.cos(rot), s = Math.sin(rot), r = Math.hypot(hx, hz);
    for (let j = this.iz(cz - r); j <= this.iz(cz + r); j++) for (let i = this.ix(cx - r); i <= this.ix(cx + r); i++) {
      if (!this.inside(i, j)) continue; const dx = this.wx(i) - cx, dz = this.wz(j) - cz;
      const lx = dx * c - dz * s, lz = dx * s + dz * c; if (Math.abs(lx) <= hx && Math.abs(lz) <= hz) this.blocked[j * this.w + i] = v;
    }
  }
  circle(cx: number, cz: number, r: number, v = 1) { for (let j = this.iz(cz - r); j <= this.iz(cz + r); j++) for (let i = this.ix(cx - r); i <= this.ix(cx + r); i++) if (this.inside(i, j) && Math.hypot(this.wx(i) - cx, this.wz(j) - cz) <= r) this.blocked[j * this.w + i] = v; }
  setCost(cx: number, cz: number, hx: number, hz: number, c: number) { for (let j = this.iz(cz - hz); j <= this.iz(cz + hz); j++) for (let i = this.ix(cx - hx); i <= this.ix(cx + hx); i++) if (this.inside(i, j)) this.cost[j * this.w + i] = c; }
  nearestFree(x: number, z: number, radius = 40): [number, number] {
    if (this.isFree(x, z)) return [x, z];
    for (let r = 1; r < radius; r++) for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, px = x + Math.cos(t) * r * this.cell, pz = z + Math.sin(t) * r * this.cell; if (this.isFree(px, pz)) return [px, pz]; }
    return [x, z];
  }
  // Exact grid traversal (Amanatides-Woo): every cell the segment touches must be free, so a smoothed path
  // segment that passes here can never contain a sub-step that fails (corner grazes included).
  lineFree(x0: number, z0: number, x1: number, z1: number) {
    let i = this.ix(x0), j = this.iz(z0); const ie = this.ix(x1), je = this.iz(z1), c = this.cell;
    const free = (a: number, b: number) => this.inside(a, b) && !this.blocked[b * this.w + a];
    if (!free(i, j) || !free(ie, je)) return false;
    const dx = x1 - x0, dz = z1 - z0, si = Math.sign(dx), sj = Math.sign(dz);
    const tdx = si ? c / Math.abs(dx) : Infinity, tdz = sj ? c / Math.abs(dz) : Infinity;
    let tx = si ? ((si > 0 ? this.minX + (i + 1) * c - x0 : x0 - (this.minX + i * c)) / Math.abs(dx)) : Infinity;
    let tz = sj ? ((sj > 0 ? this.minZ + (j + 1) * c - z0 : z0 - (this.minZ + j * c)) / Math.abs(dz)) : Infinity;
    for (let n = 0; n < 4096 && (i !== ie || j !== je); n++) {
      if (Math.abs(tx - tz) < 1e-9) { if (!free(i + si, j) || !free(i, j + sj)) return false; i += si; j += sj; tx += tdx; tz += tdz; }
      else if (tx < tz) { i += si; tx += tdx; } else { j += sj; tz += tdz; }
      if (tx > 1 + 1e-9 && tz > 1 + 1e-9 && (i !== ie || j !== je)) { i = ie; j = je; }
      if (!free(i, j)) return false;
    }
    return true;
  }
  findPath(sx: number, sz: number, tx: number, tz: number, closest = false): [number, number][] | null {
    [sx, sz] = this.nearestFree(sx, sz); [tx, tz] = this.nearestFree(tx, tz);
    const W = this.w, si = this.ix(sx), sj = this.iz(sz), ti = this.ix(tx), tj = this.iz(tz);
    if (!this.isFree(sx, sz) || !this.isFree(tx, tz)) return null;
    const start = sj * W + si, goal = tj * W + ti, N = W * this.h;
    if (++this.generation >= 0xffffffff) { this.seen.fill(0); this.closed.fill(0); this.generation = 1; }
    const { g, came, closed, seen } = this, stamp = this.generation;
    const heap: number[] = [], f: number[] = [];
    const push = (n: number, fv: number) => { heap.push(n); f.push(fv); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[p] <= f[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [f[p], f[i]] = [f[i], f[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const ln = heap.pop()!, lf = f.pop()!; if (heap.length) { heap[0] = ln; f[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && f[l] < f[m]) m = l; if (r < heap.length && f[r] < f[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [f[m], f[i]] = [f[i], f[m]]; i = m; } } return top; };
    const hfn = (n: number) => { const i = n % W, j = (n - i) / W; const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)); };
    g[start] = 0; came[start] = -1; seen[start] = stamp; push(start, hfn(start)); let iter = 0, best = start, bestH = hfn(start), reached = false;
    while (heap.length && iter < N) {
      const n = pop(); if (closed[n] === stamp) continue; closed[n] = stamp; iter++;
      const hn = hfn(n); if (hn < bestH) { best = n; bestH = hn; }
      if (n === goal) { reached = true; break; }
      const i = n % W, j = (n - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!this.inside(ni, nj)) continue; const m = nj * W + ni;
        if (this.blocked[m] || closed[m] === stamp) continue; if (di && dj && (this.blocked[j * W + ni] || this.blocked[nj * W + i])) continue;
        const ng = g[n] + (di && dj ? 1.4142 : 1) * this.cost[m];
        if (seen[m] !== stamp || ng < g[m]) { seen[m] = stamp; g[m] = ng; came[m] = n; push(m, ng + hfn(m)); }
      }
    }
    if (!reached && (!closest || best === start)) return null;
    const end = reached ? goal : best;
    const raw: [number, number][] = []; for (let n = end; n !== -1; n = came[n]) { const i = n % W; raw.push([this.wx(i), this.wz((n - i) / W)]); if (n === start) break; }
    raw.reverse(); raw[0] = [sx, sz];
    if (reached && this.lineFree(raw[raw.length - 1][0], raw[raw.length - 1][1], tx, tz)) raw.push([tx, tz]);
    // String-pull smoothing
    const out: [number, number][] = [raw[0]]; let k = 0;
    while (k < raw.length - 1) { let far = k + 1; for (let m = raw.length - 1; m > k + 1; m--) if (this.lineFree(raw[k][0], raw[k][1], raw[m][0], raw[m][1])) { far = m; break; } out.push(raw[far]); k = far; }
    return out;
  }
}
