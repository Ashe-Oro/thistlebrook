// Obstacle layers for the railway reroute, read from the compiled world
// (compileWorld, seed 831), the district plan modules the renderer draws from,
// and the rendered-footprint harvest (harvest.mjs) for geometry that only the
// renderer knows about. Every shape carries `src` so the map, the validator
// and the log can say where it came from.
import {readFileSync, existsSync} from 'node:fs';
import {resolveAll} from '../../src/catalog/resolve-all.js';
import {compileWorld} from '../../src/compiler/world-plan.js';
import {MAINLAND} from '../../src/compiler/landscape.js';
import {REGIONAL} from '../../src/roads/regional.js';
import {RAIL_RESERVED} from '../../src/compiler/railway.js';
import {motorRoads} from '../../src/astra/traffic-simulation.js';
import {PARKING_BAYS} from '../../src/astra/traffic-simulation.js';
import * as LOTPLAN from '../../src/astra/fair-lot-plan.js';
import {APPROACH} from '../../src/astra/themepark-plan.js';
import {shoreX} from '../../src/astra/coast-plan.js';
import {WORLD_OFFSETS} from '../../src/compiler/world-plan.js';
import * as THREE from 'three';

const root = new URL('../../', import.meta.url).pathname;
export function loadWorld(seed = 831) {
  const catalog = resolveAll(JSON.parse(readFileSync(root + 'src/catalog/bounds.json')));
  return {town: compileWorld(catalog, seed), catalog};
}

const box = (min, max, src, extra = {}) => ({type: 'box', min, max, src, ...extra});
const seg = (a, b, hw, src, extra = {}) => ({type: 'seg', a, b, hw, src, ...extra});
const circle = (c, r, src, extra = {}) => ({type: 'circle', c, r, src, ...extra});
const obb = (c, hx, hz, yaw, src, extra = {}) => ({type: 'obb', c, hx, hz, yaw, src, ...extra});
// Draw narrow river reaches in a separate color. Both water layers are hard exclusions.
export const STREAM_HW = 2.7;
const TREE = /tree|pine|oak|birch|palm|fir|spruce|willow|maple|cypress/i;
const isTreeAsset = (a = '') => TREE.test(a) && !/planter|topiary|stump|log|bench|lamp/i.test(a);

/** Footprint of a placed model from catalog bounds (x/z), scaled and yawed. */
function modelShape(catalog, asset, pos, rot = 0, scale = 1, src, size) {
  let hx, hz;
  if (size) { hx = size[0] / 2; hz = size[2] / 2; }
  else {
    const b = catalog.get(asset)?.bounds;
    if (b) { hx = (b.max[0] - b.min[0]) / 2 * scale; hz = (b.max[2] - b.min[2]) / 2 * scale; }
    else { hx = hz = .5 * scale; }
  }
  return obb(pos, Math.max(.2, hx), Math.max(.2, hz), rot || 0, src, {asset});
}

/** All layers as shape lists, plus the terrain surface handle. */
export function worldLayers(town, catalog) {
  const L = {sea: [], water: [], stream: [], beach: [], road: [], path: [], lot: [], building: [], parcel: [], prop: [], tree: [], scatter: [], reserved: [], soft: []};
  const tree = (p, asset = p.asset, id = p.registryId ?? p.key) => {
    const b = catalog.get(asset)?.bounds, scale = p.scale ?? 1;
    const half = (axis) => Math.max(1.4, p.radius ?? 0, b ? scale * Math.max(Math.abs(b.min[axis]), Math.abs(b.max[axis])) : 0);
    return obb(p.pos, half(0), half(2), p.rot ?? 0, id, {id, asset});
  };
  // --- Water: sea outside the mainland, river reaches, pools, lakes, ponds.
  L.sea.push({type: 'outside', pts: MAINLAND, src: 'MAINLAND (src/compiler/landscape.js)'});
  // Coral Coast surf: the renderer's shore line runs a few metres off MAINLAND.
  const coast = WORLD_OFFSETS['coral-coast'], surf = [];
  for (let z = -112; z <= 9; z += 3) surf.push([coast[0] + shoreX(z), coast[1] + z]);
  L.water.push({type: 'poly', pts: [...surf, [coast[0] + 200, coast[1] + 9], [coast[0] + 200, coast[1] - 112]], src: 'coral-coast surf (coast-plan.js shoreX)'});
  for (const r of town.water.reaches) for (let i = 1; i < r.points.length; i++) {
    const a = r.points[i - 1], b = r.points[i], hw = Math.max(a[3], b[3]);
    (hw <= STREAM_HW ? L.stream : L.water).push(seg([a[0], a[1]], [b[0], b[1]], hw, 'river ' + r.id, {reach: r.id, name: r.name}));
  }
  for (const p of town.water.pools ?? []) L.water.push(circle([p.x, p.z], p.r, 'pool ' + p.id));
  if (town.water.lake) { const k = town.water.lake; L.water.push({type: 'ellipse', c: [k.x, k.z], rx: k.rx, rz: k.rz, src: 'Stillwater lake'}); L.beach.push({type: 'ellipse', c: [k.x, k.z], rx: k.rx + 2.1, rz: k.rz + 2.1, src: 'lake sand ring'}); }
  if (town.woods?.pond) { const k = town.woods.pond; L.water.push({type: 'ellipse', c: k.center, rx: k.rx + 1.1, rz: k.rz + 1.1, src: 'Pinewood pond + rim'}); }
  for (const v of town.venues) if (/pond/.test(v.id) && v.box) L.water.push(box(v.box.min, v.box.max, 'pond venue ' + v.id));
  // Beach: the sand strips the landscape renderer lays along the shore (9 m).
  L.beach.push({type: 'band', pts: MAINLAND, width: 9, src: 'shore sand (landscape.js)'});
  // --- Carriageways (crossable square at level crossings) and footpaths.
  const roadHw = (r) => r.kind === 'world-link' ? REGIONAL.fence + .25 : r.width / 2;
  for (const r of town.roads) {
    if (r.owner === 'railway' || r.external === 'railway') continue;
    const id = r.registryId ?? 'road';
    if (r.kind === 'world-link' && r.centerline) { L.road.push({type: 'line', pts: r.centerline, hw: roadHw(r), src: id, kind: r.kind, name: r.name}); continue; }
    if (r.kind === 'avenue' || (!r.owner && r.kind !== 'pedestrian' && r.width >= 2.4) || (r.kind === 'lane' && r.external === 'coral-coast')) { L.road.push(seg(r.a, r.b, r.width / 2, id, {kind: r.kind})); continue; }
    if (['door', 'venue', 'catalog', 'catalog-slot'].includes(r.kind)) { L.parcel.push(seg(r.a, r.b, r.width / 2, id + ' (' + r.kind + ' path)', {kind: r.kind})); continue; }
    if (r.kind === 'park' && r.owner === 'themepark') continue; // drawn below as the mountain road
    L.path.push(seg(r.a, r.b, (r.width || 1.6) / 2, id, {kind: r.kind}));
  }
  for (const r of motorRoads(town)) L.road.push(seg(r.a, r.b, r.width / 2, r.registryId ?? 'motor road', {kind: 'street'}));
  for (const t of town.woods?.trails ?? []) L.path.push({type: 'line', pts: t.points.map((p) => [p[0], p[2]]), hw: t.width / 2, src: 'woods trail ' + t.id, kind: 'trail'});
  // Pinecrest mountain road: 5.2 m asphalt on a 7 m shoulder (themepark.js).
  const approach = new THREE.CatmullRomCurve3(APPROACH.map(([x, z]) => new THREE.Vector3(x, 0, z))).getPoints(350).map((v) => [v.x, v.z]);
  L.road.push({type: 'line', pts: approach, hw: 3.5, src: 'Pinecrest mountain road (themepark-plan APPROACH)', kind: 'mountain-road'});
  // Funfair Parking: the lot, aisles and apron are a lot (no crossings).
  L.lot.push(box(LOTPLAN.LOT.min, LOTPLAN.LOT.max, 'Funfair Parking LOT'), box(LOTPLAN.APRON.min, LOTPLAN.APRON.max, 'Funfair Parking APRON'));
  for (const [k, a] of Object.entries(LOTPLAN.AISLES)) L.lot.push(box(a.min, a.max, 'Funfair Parking aisle ' + k));
  L.lot.push(box(LOTPLAN.WALKWAY.min, LOTPLAN.WALKWAY.max, 'Funfair Parking walkway'), box(LOTPLAN.SOUTH_STRIP.min, LOTPLAN.SOUTH_STRIP.max, 'Funfair Parking south strip'));
  for (const p of LOTPLAN.PLANTERS) L.prop.push(box(p.min, p.max, 'Funfair Parking planter'));
  for (const [i, pos] of LOTPLAN.TREES.entries()) L.tree.push(tree({pos}, undefined, 'fairlot-tree-' + i));
  for (const p of LOTPLAN.LAMPS) L.prop.push(circle(p, .3, 'Funfair Parking lamp'));
  L.prop.push(obb(LOTPLAN.BOOTH.center, LOTPLAN.BOOTH.size[0] / 2, LOTPLAN.BOOTH.size[1] / 2, 0, 'Funfair Parking booth'));
  // Kerbside parking bays and Maple Hollow driveways.
  for (const b of PARKING_BAYS) L.lot.push(obb(b.center, b.width / 2 + .3, b.length / 2 + .3, b.yaw, 'parking bay ' + b.id));
  for (const b of town.mapleHollow?.bays ?? []) L.lot.push(obb(b.center, b.width / 2 + .3, b.length / 2 + .3, b.yaw, 'Maple Hollow bay ' + b.id));
  for (const a of town.civicAprons ?? []) L.lot.push(box(a.min, a.max, 'civic apron'));
  // --- Buildings, parcels, plazas, fields.
  for (const b of town.buildings) L.building.push(box(b.box.min, b.box.max, b.registryId ?? b.key, {name: b.name}));
  // The West Works yard (work-station, work-depot) is the railway's own parcel: Union's existing track runs through it.
  for (const v of town.venues) if (v.box && !/^rail-/.test(v.id) && !['work-station', 'work-depot'].includes(v.id)) L.parcel.push(box(v.box.min, v.box.max, 'venue ' + v.id, {name: v.name, venue: v.id, district: v.district}));
  for (const g of town.gardens ?? []) L.parcel.push(box([g.x - g.width / 2, g.z - g.depth / 2], [g.x + g.width / 2, g.z + g.depth / 2], g.registryId ?? 'garden'));
  for (const c of town.courtyards ?? []) L.parcel.push(box(c.min, c.max, c.registryId ?? 'courtyard'));
  for (const s of town.catalogScenes ?? []) L.parcel.push(box(s.box.min, s.box.max, 'catalog scene ' + s.id));
  for (const f of town.outskirts?.fields ?? []) L.parcel.push(box([f.x - f.w / 2, f.z - f.d / 2], [f.x + f.w / 2, f.z + f.d / 2], 'outskirts field ' + f.crop));
  for (const lot of town.mapleHollow?.lots ?? []) L.parcel.push(obb(lot.center, lot.width / 2, lot.depth / 2, Math.atan2(lot.right[1], lot.right[0]), 'Maple Hollow ' + lot.key, {name: lot.address}));
  for (const s of town.mapleHollow?.surfaces ?? []) if (s.size) L.parcel.push(obb(s.center, s.size[0] / 2, s.size[1] / 2, -(s.yaw ?? 0), 'Maple Hollow ' + s.kind));
  // --- Props and outdoor furniture.
  for (const p of town.props) L.prop.push(modelShape(catalog, p.id, p.pos, p.rot, p.scale, p.registryId ?? p.id));
  for (const p of town.supplemental ?? []) {
    if (isTreeAsset(p.asset)) L.tree.push(tree(p));
    else L.prop.push(modelShape(catalog, p.asset, p.pos, p.rot, p.scale, p.registryId ?? p.key));
  }
  for (const s of town.catalogScenes ?? []) for (const m of s.members) L.prop.push(box(m.box.min, m.box.max, m.registryId ?? m.key));
  for (const p of town.mapleHollow?.props ?? []) L.prop.push(modelShape(catalog, p.model, p.pos, p.yaw, p.scale, 'Maple Hollow ' + p.model));
  for (const f of town.districtFurniture ?? []) L.prop.push(obb(f.pos, (f.size?.[0] ?? 1) / 2, (f.size?.[2] ?? 1) / 2, 0, f.id));
  for (const m of town.modelPlacements ?? []) {
    if (isTreeAsset(m.asset)) L.tree.push(tree(m, m.asset, m.id));
    else L.prop.push(modelShape(catalog, m.asset, m.pos, m.rot, m.scale, m.id, m.size));
  }
  // --- Trees (hard) and natural scatter (removable; counted separately).
  for (const t of town.trees) L.tree.push(tree(t, t.id));
  for (const t of town.outskirts?.trees ?? []) L.tree.push(tree(t, t.id, 'outskirts:' + t.pos.join(',')));
  for (const m of town.landscape?.models ?? []) {
    if (m.woods === 'tree' || isTreeAsset(m.asset)) L.tree.push(tree(m));
    else if (m.woods && !/understory|reeds/.test(m.woods)) L.prop.push(modelShape(catalog, m.asset, m.pos, m.rot, m.scale, m.registryId));
    else L.scatter.push(circle(m.pos, .5 * (m.scale || 1), m.registryId, {pos: m.pos, id: m.registryId, asset: m.asset}));
  }
  // --- Reserved lanes. Owned parcels of other lanes are hard; the Pinewood
  // woods (trees, trails, ridge) are soft: allowed, priced and counted.
  for (const r of RAIL_RESERVED) {
    if (['pinewood', 'pinewood-fringe'].includes(r.id)) L.soft.push({type: 'poly', pts: r.area, src: 'RAIL_RESERVED ' + r.id});
    else if (['roadster'].includes(r.id)) L.reserved.push({type: 'poly', pts: r.area, src: 'RAIL_RESERVED ' + r.id});
  }
  // Merrymead festival (music-festival lane, TOWN-20): bandshell venue, stalls
  // and gate, fair-local + offset. Source: ../music-festival src/astra/festival-plan.js
  // (FESTIVAL_STALLS, FESTIVAL_GATE) and src/compiler/astra-fair.js (fair-band venue).
  const fo = WORLD_OFFSETS.fair;
  L.reserved.push(box([-76 + fo[0], -53 + fo[1]], [-56.85 + fo[0], -36 + fo[1]], 'festival bandshell (music-festival lane)'));
  return L;
}

/** Shape coverage for drawing: which classes are hard bans. */
export const HARD = ['sea', 'water', 'stream', 'lot', 'building', 'parcel', 'prop', 'tree', 'reserved', 'rendered', 'renderedPaving'];

/**
 * Rendered-footprint masks (tools/railway-plan/rendered-footprint.json) against the terrain:
 * structure = rendered more than 0.3 m above local ground; paving = flat
 * rendered surface 0.05..0.3 m up. Geometry owned by a road or trail record
 * is covered by the compiled road/path layers and skipped here. Over raised
 * terrain (> 1 m) the rail can only run in a bore, so geometry on the hillside
 * is left to the terrain rules.
 */
export function renderedMasks(grid, terrainH, file = new URL('./rendered-footprint.json', import.meta.url).pathname) {
  if (!existsSync(file)) return null;
  const R = JSON.parse(readFileSync(file)), W = grid.w, n = grid.n;
  // Terrain is compared over a 1 m neighbourhood: rendered hill and boulder
  // faces never quite match the sampled heights at their edges.
  const tH = new Float32Array(n);
  for (let c = 0; c < n; c++) { const i = c % W, j = (c - i) / W; let v = terrainH[c]; for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const x = i + di, z = j + dj; if (x >= 0 && z >= 0 && x < W && z < grid.h) v = Math.max(v, terrainH[z * W + x]); } tH[c] = v; }
  terrainH = tH;
  const road = grid.fields.road; // kerb fences and guardrails inside a road's own footprint belong to the road
  const structure = new Uint8Array(n), paving = new Uint8Array(n), owner = new Int32Array(n).fill(-1);
  const skipId = R.ids.map(([id]) => /^built:road-|^woods:trail|^built:bridge|^built:water-bridge/.test(id));
  for (const [j, i, L, o, t] of R.solid) { if (skipId[o]) continue; for (let k = 0; k < L; k++) { const c = j * W + i + k; if (road[c] <= 0) continue; if (terrainH[c] < 1 && t / 100 - terrainH[c] > .3) { structure[c] = 1; owner[c] = o; } } }
  for (const [j, i, L, o, t] of R.surface) { if (skipId[o]) continue; for (let k = 0; k < L; k++) { const c = j * W + i + k, up = t / 100 - terrainH[c]; if (terrainH[c] >= 1 || road[c] <= 0) continue; if (up > .3) { structure[c] = 1; owner[c] = o; } else if (up > .05 && !structure[c]) { paving[c] = 1; owner[c] = o; } } }
  return {structure, paving, owner, ids: R.ids};
}
