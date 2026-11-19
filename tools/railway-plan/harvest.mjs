// Rendered-footprint harvest: open the real site (seed 831, clear, paused),
// walk the three.js scene and rasterise every static triangle top-down into a
// 0.5 m grid. Each cell keeps, with the registry id that put it there, the
// highest top of two kinds of rendered triangle above y = 0.05:
//   solid:   sloped or vertical faces (walls, props, fences, cars, lamps, piers)
//   surface: near-horizontal faces (roads, lots, aprons, plazas, decks, roofs)
// layers.mjs classifies them against the terrain height: anything more than
// 0.3 m above the local ground is a structure, flat surfaces 0.05..0.3 m up
// are paving.
// Vegetation, terrain (hills, peaks, ridge), water and the current railway
// are left out: the planner reads those from the compiled world. People,
// traffic, boats and aircraft are excluded by their registry exemption and
// by the dynamic groups the renderer marks.
// Usage: node tools/railway-plan/harvest.mjs http://127.0.0.1:5291 [out.json]
import {writeFileSync} from 'node:fs';
import {chromium} from 'playwright-core';
import {GRID} from './grid.mjs';

const [base, out = new URL('./rendered-footprint.json', import.meta.url).pathname] = process.argv.slice(2);
if (!base) throw Error('Pass the local Vite URL.');
const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
try {
  const page = await browser.newPage({viewport: {width: 800, height: 600}});
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/favicon.ico', (route) => route.fulfill({status: 204}));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto(base + '/?capture=1&seed=831&weather=clear', {timeout: 600000});
  await page.waitForFunction(() => window.__ready || window.__astraError, null, {timeout: 600000, polling: 1000});
  const err = await page.evaluate(() => window.__astraError);
  if (err) throw Error(err);
  const result = await page.evaluate(async (G) => {
    const A = window.__astra, scene = A.scene, town = A.town;
    A.setPaused?.(true);
    const places = new Map(town.registry.places.map((p) => [p.id, p]));
    const W = Math.round((G.maxX - G.minX) / G.res), H = Math.round((G.maxZ - G.minZ) / G.res);
    const top = new Float32Array(W * H).fill(-9), owner = new Int32Array(W * H).fill(-1), surf = new Float32Array(W * H).fill(-9), surfOwner = new Int32Array(W * H).fill(-1);
    const ids = [], idIndex = new Map();
    const idOf = (id) => { if (!idIndex.has(id)) { idIndex.set(id, ids.length); ids.push(id); } return idIndex.get(id); };
    // What the planner reads from the compiled world instead.
    const skip = (id) => {
      if (!id) return 'untagged';
      const p = places.get(id);
      if (p?.type === 'vegetation' || p?.kind === 'vegetation') return 'vegetation';
      if (/^landscape:(meadow-)?hill|^woods(:ridge)?$|^pinecrest$|^built:river|^built:island|^built:water|^landscape$/.test(id)) return 'terrain-water';
      if (/^rail-|grand-loop/i.test(id)) return 'railway';
      if (p?.type === 'person' || p?.type === 'vehicle' || p?.type === 'animal') return 'dynamic';
      return null;
    };
    const dynamicRoots = new Set();
    scene.traverse((o) => { if (o.userData?.registryExempt || o.userData?.dynamic) dynamicRoots.add(o); });
    const railRoot = A.world?.railway?.root;
    const underDynamic = (o) => { for (let p = o; p; p = p.parent) { if (p === railRoot) return 'railway'; if (dynamicRoots.has(p)) return true; if (/dynamic|moving|traffic|resident|people|boats?|aircraft|train|consist/i.test(p.name || '')) return true; } return false; };
    const v = [0, 0, 0].map(() => ({x: 0, y: 0, z: 0}));
    const stats = {}, M = new A.camera.matrixWorld.constructor(), tmp = new A.camera.matrixWorld.constructor();
    const P = new A.camera.position.constructor();
    let triangles = 0;
    const raster = (a, b, c, k) => { // eslint-disable-line no-shadow
      const yMax = Math.max(a.y, b.y, c.y), yMin = Math.min(a.y, b.y, c.y);
      if (yMax < .05 || yMin > 60) return;
      const minX = Math.min(a.x, b.x, c.x), maxX = Math.max(a.x, b.x, c.x), minZ = Math.min(a.z, b.z, c.z), maxZ = Math.max(a.z, b.z, c.z);
      if (maxX < G.minX || minX > G.maxX || maxZ < G.minZ || minZ > G.maxZ) return;
      const flat = yMax - yMin < .15; // near-horizontal surface vs solid (sloped or vertical) face
      const i0 = Math.max(0, Math.floor((minX - G.minX) / G.res)), i1 = Math.min(W - 1, Math.floor((maxX - G.minX) / G.res));
      const j0 = Math.max(0, Math.floor((minZ - G.minZ) / G.res)), j1 = Math.min(H - 1, Math.floor((maxZ - G.minZ) / G.res));
      const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
      const edgeOnly = Math.abs(area) < 1e-6; // vertical faces: mark their segment
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = G.minX + (i + .5) * G.res, z = G.minZ + (j + .5) * G.res;
        let inside;
        if (edgeOnly || (i1 - i0 < 1 && j1 - j0 < 1)) inside = true;
        else {
          // point-in-triangle with half-cell tolerance
          const s = (q, r) => ((r.x - q.x) * (z - q.z) - (x - q.x) * (r.z - q.z));
          const e = G.res * .71, sa = s(a, b) / Math.hypot(b.x - a.x, b.z - a.z || 1e-9), sb = s(b, c) / Math.hypot(c.x - b.x, c.z - b.z || 1e-9), sc = s(c, a) / Math.hypot(a.x - c.x, a.z - c.z || 1e-9);
          inside = area > 0 ? sa >= -e && sb >= -e && sc >= -e : sa <= e && sb <= e && sc <= e;
        }
        if (!inside) continue;
        const cell = j * W + i;
        // Height of the triangle's plane at the cell centre (clamped); vertical faces use their top.
        let y = yMax;
        if (!edgeOnly && Math.abs(area) > 1e-3) {
          const l1 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / ((b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z));
          const l2 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / ((b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z));
          y = Math.min(yMax, Math.max(yMin, l1 * a.y + l2 * b.y + (1 - l1 - l2) * c.y));
        }
        if (!flat) { if (y > top[cell]) { top[cell] = y; owner[cell] = k; } }
        else if (y > surf[cell]) { surf[cell] = y; surfOwner[cell] = k; }
      }
    };
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position || !o.visible) return;
      const dyn = underDynamic(o); if (dyn) { stats[dyn === true ? 'dynamic' : dyn] = (stats[dyn === true ? 'dynamic' : dyn] || 0) + 1; return; }
      const geo = o.geometry, pos = geo.attributes.position, index = geo.index;
      const count = o.isInstancedMesh ? o.count : 1;
      for (let n = 0; n < count; n++) {
        const id = o.isInstancedMesh ? o.userData.registryIds?.[n] ?? o.userData.registryId : o.userData.registryId;
        const why = skip(id); if (why) { stats[why] = (stats[why] || 0) + 1; continue; }
        if (o.isInstancedMesh) { o.getMatrixAt(n, tmp); M.multiplyMatrices(o.matrixWorld, tmp); } else M.copy(o.matrixWorld);
        const k = idOf(id), e = M.elements;
        const T = (vi, out) => { const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi); out.x = e[0] * x + e[4] * y + e[8] * z + e[12]; out.y = e[1] * x + e[5] * y + e[9] * z + e[13]; out.z = e[2] * x + e[6] * y + e[10] * z + e[14]; };
        const triCount = index ? index.count / 3 : pos.count / 3;
        for (let t = 0; t < triCount; t++) {
          const i0 = index ? index.getX(t * 3) : t * 3, i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1, i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2;
          T(i0, v[0]); T(i1, v[1]); T(i2, v[2]);
          raster(v[0], v[1], v[2], k); triangles++;
        }
        stats.kept = (stats.kept || 0) + 1;
      }
    });
    // Run-length rows: [row, startCol, length, ownerIndex, top(cm)] for structure; paving likewise without top.
    const runs = (has, own, val) => {
      const list = [];
      for (let j = 0; j < H; j++) for (let i = 0; i < W;) {
        const c = j * W + i; if (!has(c)) { i++; continue; }
        let L = 1; while (i + L < W && has(c + L) && own[c + L] === own[c] && (!val || Math.abs(val(c + L) - val(c)) < 30)) L++;
        list.push(val ? [j, i, L, own[c], val(c)] : [j, i, L, own[c]]); i += L;
      }
      return list;
    };
    return {grid: G, triangles, stats, ids: ids.map((id) => [id, places.get(id)?.type ?? null, places.get(id)?.name ?? null]),
      solid: runs((c) => top[c] > .05, owner, (c) => Math.round(top[c] * 100)), surface: runs((c) => surf[c] > .05, surfOwner, (c) => Math.round(surf[c] * 100))};
  }, GRID);
  result.errors = errors.slice(0, 20);
  writeFileSync(out, JSON.stringify(result));
  console.log(out, 'triangles', result.triangles, 'ids', result.ids.length, 'solid runs', result.solid.length, 'surface runs', result.surface.length, JSON.stringify(result.stats));
} finally { await browser.close(); }
