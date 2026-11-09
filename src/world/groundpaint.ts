// Procedurally painted town ground: grass with tufts, organic dirt lanes, small-cobble streets and a plaza.
// (The pack's 4 m road tiles read as giant stones next to villagers, so streets are painted instead.)
import * as THREE from 'three';
import { RNG } from '../core/util';
export const GROUND_RECT = { x0: -64, x1: 64, z0: -44, z1: 38 };
export function paintGround(paths: { pts: [number, number][]; w: number; kind: 'dirt' | 'cobble' }[], plazas: { x0: number; z0: number; x1: number; z1: number; r: number }[], PPM = 16) {
  const R = GROUND_RECT, W = (R.x1 - R.x0) * PPM, H = (R.z1 - R.z0) * PPM, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')!, rng = new RNG(7);
  const X = (x: number) => (x - R.x0) * PPM, Z = (z: number) => (z - R.z0) * PPM;
  g.fillStyle = '#78b04c'; g.fillRect(0, 0, W, H);
  // grass variation: big soft blotches + small tufts
  for (let i = 0; i < 900; i++) { const x = rng.range(0, W), y = rng.range(0, H), r = rng.range(20, 90); const gr = g.createRadialGradient(x, y, 0, x, y, r); const l = rng.chance(.5); gr.addColorStop(0, l ? 'rgba(160,200,90,.22)' : 'rgba(70,120,50,.18)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  for (let i = 0; i < 26000; i++) { const x = rng.range(0, W), y = rng.range(0, H); g.fillStyle = rng.chance(.5) ? 'rgba(150,200,90,.35)' : 'rgba(80,130,50,.3)'; g.fillRect(x, y, rng.range(1, 3), rng.range(2, 5)); }
  for (let i = 0; i < 260; i++) { const x = rng.range(0, W), y = rng.range(0, H); g.fillStyle = rng.pick(['#f7f2e0', '#f5d24a', '#e98bb5', '#c9a3f0']); for (let k = 0; k < 4; k++) g.fillRect(x + rng.range(-6, 6), y + rng.range(-6, 6), 2.5, 2.5); }
  const stroke = (pts: [number, number][], w: number, fill: string, jitter = .25) => {
    for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len * 3);
      for (let k = 0; k <= n; k++) { const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, r = (w / 2) * (1 + rng.range(-jitter, jitter)); g.fillStyle = fill; g.beginPath(); g.arc(X(x), Z(z), r * PPM, 0, 6.283); g.fill(); } }
  };
  const cobbles = (clip: () => void, bx0: number, bz0: number, bx1: number, bz1: number) => {
    g.save(); clip(); g.clip(); g.fillStyle = '#8f8676'; g.fillRect(X(bx0), Z(bz0), (bx1 - bx0) * PPM, (bz1 - bz0) * PPM);
    const s = .42; for (let z = bz0; z < bz1; z += s * .86) for (let x = bx0 + ((Math.round(z / s) % 2) * s / 2); x < bx1; x += s) {
      const cx = X(x + rng.range(-.04, .04)), cz = Z(z + rng.range(-.04, .04)), r = s * PPM * rng.range(.36, .46), v = rng.range(-14, 14);
      g.fillStyle = `rgb(${178 + v},${168 + v},${148 + v})`; g.beginPath(); for (let a = 0; a < 6; a++) { const aa = a / 6 * 6.283 + rng.range(-.2, .2), rr = r * rng.range(.85, 1.1); g.lineTo(cx + Math.cos(aa) * rr, cz + Math.sin(aa) * rr * .9); } g.fill();
      g.fillStyle = 'rgba(255,255,240,.18)'; g.beginPath(); g.arc(cx - r * .25, cz - r * .25, r * .45, 0, 6.283); g.fill(); }
    g.restore();
  };
  for (const p of paths.filter(p => p.kind === 'dirt')) { stroke(p.pts, p.w + .5, '#9c8a5e', .3); stroke(p.pts, p.w, '#c2a874', .18); }
  // light wheel ruts / speckle on dirt
  for (const p of paths.filter(p => p.kind === 'cobble')) {
    stroke(p.pts, p.w + .7, '#7f8f55', .15);
    const xs = p.pts.map(q => q[0]), zs = p.pts.map(q => q[1]); const bx0 = Math.min(...xs) - p.w, bx1 = Math.max(...xs) + p.w, bz0 = Math.min(...zs) - p.w, bz1 = Math.max(...zs) + p.w;
    cobbles(() => { g.beginPath(); for (let i = 0; i < p.pts.length - 1; i++) { const [ax, az] = p.pts[i], [bx, bz] = p.pts[i + 1]; const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), nx = -dz / l * p.w / 2, nz = dx / l * p.w / 2; g.moveTo(X(ax + nx), Z(az + nz)); g.lineTo(X(bx + nx), Z(bz + nz)); g.lineTo(X(bx - nx), Z(bz - nz)); g.lineTo(X(ax - nx), Z(az - nz)); g.closePath(); } }, bx0, bz0, bx1, bz1);
  }
  for (const q of plazas) {
    const rr = (x0: number, z0: number, x1: number, z1: number, r: number) => { g.beginPath(); (g as any).roundRect(X(x0), Z(z0), (x1 - x0) * PPM, (z1 - z0) * PPM, r * PPM); };
    g.fillStyle = '#7f8f55'; rr(q.x0 - .4, q.z0 - .4, q.x1 + .4, q.z1 + .4, q.r + .4); g.fill();
    cobbles(() => rr(q.x0, q.z0, q.x1, q.z1, q.r), q.x0, q.z0, q.x1, q.z1);
    g.strokeStyle = 'rgba(90,80,64,.55)'; g.lineWidth = .25 * PPM; rr(q.x0 + .15, q.z0 + .15, q.x1 - .15, q.z1 - .15, q.r); g.stroke();
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const geo = new THREE.PlaneGeometry(R.x1 - R.x0, R.z1 - R.z0); geo.rotateX(-Math.PI / 2);
  // fade edges into the surrounding vertex-coloured grass
  const m = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  m.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\n float ed = min(min(vMapUv.x, 1.0 - vMapUv.x) * ${((R.x1 - R.x0) / 6).toFixed(1)}, min(vMapUv.y, 1.0 - vMapUv.y) * ${((R.z1 - R.z0) / 6).toFixed(1)}); diffuseColor.a *= clamp(ed, 0.0, 1.0);`); };
  const mesh = new THREE.Mesh(geo, m); mesh.position.set((R.x0 + R.x1) / 2, .01, (R.z0 + R.z1) / 2); mesh.receiveShadow = true; mesh.renderOrder = -1; mesh.name = 'groundpaint';
  return mesh;
}
