// Build the planner's obstacle grid, terrain heights and cost map for seed 831.
import {Grid, GRID} from './grid.mjs';
import {loadWorld, worldLayers, renderedMasks, HARD} from './layers.mjs';
import {buildCostmap, chamfer, corridor} from './costmap.mjs';
import {terrainSurface} from '../../src/compiler/terrain.js';
import {GROUND_TOP} from '../../src/compiler/woods.js';

const PAD = {sea: 8, water: 8, stream: 8, beach: 3, road: 10, path: 4, lot: 8, building: 8, parcel: 8, prop: 6, tree: 4, scatter: 3, reserved: 6, soft: 3};

/** Terrain height above the ground plane on the grid (raycast where any raised mesh can reach). */
export function terrainGrid(grid, terrain) {
  const H = new Float32Array(grid.n);
  const items = [...terrain.peaks, ...terrain.hills];
  const reach = (it) => Math.max(it.w, ...it.parts.map((p) => Math.hypot(p.position[0] - it.x, p.position[2] - it.z) + Math.max(p.scale[0], p.scale[2])));
  const boxes = items.map((it) => { const r = reach(it); return [it.x - r, it.z - r, it.x + r, it.z + r]; });
  boxes.push([-200, -30, -100, 115]); // Pinewood ridge heightfield (RIDGE_BOX lies inside)
  const done = new Uint8Array(grid.n);
  for (const [x0, z0, x1, z1] of boxes) {
    for (let j = Math.max(0, grid.iz(z0)); j <= Math.min(grid.h - 1, grid.iz(z1)); j++) for (let i = Math.max(0, grid.ix(x0)); i <= Math.min(grid.w - 1, grid.ix(x1)); i++) {
      const c = j * grid.w + i; if (done[c]) continue; done[c] = 1;
      H[c] = Math.max(0, terrain.height(grid.cx(i), grid.cz(j)) - GROUND_TOP);
    }
  }
  return H;
}

export function buildWorld({log = console.log} = {}) {
  const t0 = Date.now(), lap = (m) => log(`  ${m} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  const {town, catalog} = loadWorld(831); lap('compiled world');
  const layers = worldLayers(town, catalog);
  const grid = new Grid(GRID);
  for (const [name, shapes] of Object.entries(layers)) grid.paint(name, shapes, PAD[name] ?? 6);
  lap('painted ' + Object.entries(layers).map(([k, v]) => k + ' ' + v.length).join(', '));
  const terrain = terrainSurface(town), H = terrainGrid(grid, terrain); lap('terrain heights');
  const rendered = renderedMasks(grid, H);
  if (rendered) {
    // Sidewalks and kerbs along carriageways and footpath edges are part of
    // the street, not a lot: the level crossing spans them.
    const road = grid.fields.road, path = grid.fields.path, pav = rendered.paving.slice();
    for (let c = 0; c < grid.n; c++) if (pav[c] && (road[c] < 3.2 || path[c] < .8)) pav[c] = 0;
    grid.fields.rendered = chamfer(grid.w, grid.h, grid.res, rendered.structure).map((d) => Math.min(grid.cap, d));
    grid.fields.renderedPaving = chamfer(grid.w, grid.h, grid.res, pav).map((d) => Math.min(grid.cap, d));
    grid.rendered = rendered; grid.renderedPavingMask = pav;
    lap('rendered footprint');
  } else log('  (no rendered-footprint.json: run tools/railway-plan/harvest.mjs first)');
  const cm = buildCostmap(grid, {hard: HARD, terrain: H}); lap('cost map');
  return {town, catalog, layers, grid, terrain, H, cm, rendered, Z: corridor()};
}
