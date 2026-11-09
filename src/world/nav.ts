// Walkable grid (0.5 m cells) + A* with path smoothing. Grows with the town bounds.
export class NavGrid {
  minX: number; minZ: number; w: number; h: number; cell: number; blocked: Uint8Array; cost: Float32Array;
  constructor(b: { minX: number; maxX: number; minZ: number; maxZ: number }, cell = 0.5) {
    this.cell = cell; this.minX = b.minX; this.minZ = b.minZ;
    this.w = Math.ceil((b.maxX - b.minX) / cell); this.h = Math.ceil((b.maxZ - b.minZ) / cell);
    this.blocked = new Uint8Array(this.w * this.h); this.cost = new Float32Array(this.w * this.h).fill(1);
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
  nearestFree(x: number, z: number): [number, number] {
    if (this.isFree(x, z)) return [x, z];
    for (let r = 1; r < 40; r++) for (let a = 0; a < 16; a++) { const t = a / 16 * Math.PI * 2, px = x + Math.cos(t) * r * this.cell, pz = z + Math.sin(t) * r * this.cell; if (this.isFree(px, pz)) return [px, pz]; }
    return [x, z];
  }
  lineFree(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(d / (this.cell * 0.5));
    for (let k = 1; k < n; k++) { const t = k / n; if (!this.isFree(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false; }
    return true;
  }
  findPath(sx: number, sz: number, tx: number, tz: number): [number, number][] | null {
    [sx, sz] = this.nearestFree(sx, sz); [tx, tz] = this.nearestFree(tx, tz);
    const W = this.w, si = this.ix(sx), sj = this.iz(sz), ti = this.ix(tx), tj = this.iz(tz);
    if (!this.inside(si, sj) || !this.inside(ti, tj)) return null;
    const start = sj * W + si, goal = tj * W + ti, N = W * this.h;
    const g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap: number[] = [], f: number[] = [];
    const push = (n: number, fv: number) => { heap.push(n); f.push(fv); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (f[p] <= f[i]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; [f[p], f[i]] = [f[i], f[p]]; i = p; } };
    const pop = () => { const top = heap[0]; const ln = heap.pop()!, lf = f.pop()!; if (heap.length) { heap[0] = ln; f[0] = lf; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && f[l] < f[m]) m = l; if (r < heap.length && f[r] < f[m]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; [f[m], f[i]] = [f[i], f[m]]; i = m; } } return top; };
    const hfn = (n: number) => { const i = n % W, j = (n - i) / W; const dx = Math.abs(i - ti), dz = Math.abs(j - tj); return (dx + dz + (1.4142 - 2) * Math.min(dx, dz)); };
    g[start] = 0; push(start, hfn(start)); let iter = 0;
    while (heap.length && iter++ < 60000) {
      const n = pop(); if (n === goal) break; if (closed[n]) continue; closed[n] = 1;
      const i = n % W, j = (n - i) / W;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue; const ni = i + di, nj = j + dj; if (!this.inside(ni, nj)) continue; const m = nj * W + ni;
        if (this.blocked[m] || closed[m]) continue; if (di && dj && (this.blocked[j * W + ni] || this.blocked[nj * W + i])) continue;
        const ng = g[n] + (di && dj ? 1.4142 : 1) * this.cost[m];
        if (ng < g[m]) { g[m] = ng; came[m] = n; push(m, ng + hfn(m)); }
      }
    }
    if (came[goal] === -1 && goal !== start) return null;
    const raw: [number, number][] = []; for (let n = goal; n !== -1; n = came[n]) { const i = n % W; raw.push([this.wx(i), this.wz((n - i) / W)]); if (n === start) break; }
    raw.reverse(); raw[raw.length - 1] = [tx, tz];
    // String-pull smoothing
    const out: [number, number][] = [raw[0]]; let k = 0;
    while (k < raw.length - 1) { let far = k + 1; for (let m = raw.length - 1; m > k + 1; m--) if (this.lineFree(raw[k][0], raw[k][1], raw[m][0], raw[m][1])) { far = m; break; } out.push(raw[far]); k = far; }
    return out;
  }
}
