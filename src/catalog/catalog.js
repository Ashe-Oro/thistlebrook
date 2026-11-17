import { TOWNSFOLK_CATALOG } from './townsfolk.js';
import { VILLAGER_CATALOG } from './villagers.js';
import { SEASONAL } from './seasonal.js';
import { ADDITIONS } from './additions.js';
// The tagged kit. Authoring form — see schema.js for every field. Anchors are
// in SOURCE units; bounds come from bounds.json (npm run catalog:bounds).
//
// Cozy Village GLBs are 1 unit = 1 m, Y-up, +Z forward (pack README). Our
// builders were authored ~1.6x larger (a builder door is 1.9 tall, a Cozy door
// is ~1.2 m), so imported pieces get KIT_SCALE to sit at the same scale.
export const KIT_SCALE = 1.6;
const CV = 'licensed/cozy-village/';
const cozy = (file) => ({ source: 'mesh', path: CV + file, license: 'tja-commercial', scale: KIT_SCALE });

// Cozy homes share a layout: door centred on x = 0 in the +Z wall, a step in
// front. stepZ / wallZ were read off the geometry (tools/inspect-glb.mjs).
function cozyHome(id, name, file, style, { wallZ, stepZ, eaveY }) {
  return {
    id, name, tags: { category: 'house', style: ['cozy-village', ...style] },
    ...cozy(file),
    groundY: 0.35,
    eaveY,
    door: { pos: [0, 0.3, wallZ], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, stepZ + 0.25], dir: [0, 0, 1] }],
    lotMargin: 0.6,
  };
}

// Builder house anchors follow makeHouse's own layout (porch depth 1.6, steps).
function builderHouse(id, name, params) {
  const d = params.d ?? 4.2, h = params.h ?? 3, porch = params.porch ?? true;
  const front = porch ? d / 2 + 1.6 + 0.35 : d / 2;
  return {
    id, name, tags: { category: 'house', style: ['builder', 'cottage'] },
    source: 'builder', builder: 'makeHouse', params, scale: 1,
    groundY: 0.7,
    eaveY: 0.5 + h,
    door: { pos: [0, 0.5, d / 2 + 0.03], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, front + 0.4], dir: [0, 0, 1] }],
    lotMargin: 1.0,
  };
}

// Cozy Village civic buildings (bakery / tavern / chapel / store). Single-mesh
// GLBs, door on the +Z wall (verified with tools/inspect-door.mjs — all +Z, so
// no yawOffset). wallZ = front wall z, stepZ = doorstep z (source units).
function cozyLandmark(id, name, file, style, { wallZ, stepZ, eaveY, lotMargin = 1.1 }) {
  return {
    id, name, tags: { category: 'landmark', style: ['cozy-village', style] },
    ...cozy(file),
    groundY: 0.4,
    eaveY,
    door: { pos: [0, 0.3, wallZ], facing: [0, 0, 1] },
    pathSnaps: [{ pos: [0, 0, stepZ + 0.3], dir: [0, 0, 1] }],
    lotMargin,
  };
}

const wellSnaps = (r) => [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([x, z]) => ({ pos: [x * r, 0, z * r], dir: [x, 0, z] }));

const LEGACY_CATALOG = [
  // --- Imported: Cozy Village (licensed, public/licensed/ is gitignored) ----
  cozyHome('cv-home-cottage', 'Home Cottage 01', 'home_cottage_01.glb', ['cottage'], { wallZ: 1.32, stepZ: 1.6, eaveY: 1.82 }),
  cozyHome('cv-home-thatched', 'Home Thatched House 01', 'home_thatched_house_01.glb', ['thatch'], { wallZ: 1.42, stepZ: 1.73, eaveY: 1.68 }),
  cozyHome('cv-home-timber', 'Home Timber 2-storey 01', 'home_timber_2storey_01.glb', ['timber', 'two-storey'], { wallZ: 1.42, stepZ: 1.7, eaveY: 2.86 }),
  cozyHome('cv-home-townhouse', 'Home Townhouse 01', 'home_townhouse_01.glb', ['townhouse', 'narrow'], { wallZ: 1.3, stepZ: 1.66, eaveY: 2.58 }),
  // --- Imported: Cozy Village landmarks (civic buildings) ------------------
  cozyLandmark('cv-bakery', 'Bakery 01', 'bld_bakery_01.glb', 'bakery', { wallZ: 1.7, stepZ: 2.06, eaveY: 1.9 }),
  cozyLandmark('cv-tavern', 'Tavern Inn 01', 'bld_tavern_inn_01.glb', 'tavern', { wallZ: 1.77, stepZ: 2.24, eaveY: 3.0 }),
  cozyLandmark('cv-chapel', 'Chapel 01', 'bld_chapel_01.glb', 'chapel', { wallZ: 2.15, stepZ: 2.57, eaveY: 2.4 }),
  cozyLandmark('cv-store', 'General Store 01', 'bld_general_store_01.glb', 'store', { wallZ: 2.35, stepZ: 2.5, eaveY: 1.9 }),
  {
    id: 'cv-well', name: 'Well 01', tags: { category: 'well', style: ['cozy-village'] }, ...cozy('well_01.glb'),
    groundY: 0.4, eaveY: 1.29, door: null, pathSnaps: wellSnaps(1.1),
  },
  {
    id: 'cv-picket-fence', name: 'Picket Fence 01', tags: { category: 'fence', style: ['cozy-village', 'picket'] }, ...cozy('picket_fence_01.glb'),
    groundY: 10, eaveY: null, door: null,
    fenceSnaps: [{ pos: [-1.0, 0, 0], dir: [-1, 0, 0] }, { pos: [1.0, 0, 0], dir: [1, 0, 0] }],
  },
  {
    id: 'cv-dirt-path', name: 'Terrain Dirt Path 01', tags: { category: 'path', style: ['cozy-village', 'dirt', 'tile-4m'] }, ...cozy('terrain_dirt_path_01.glb'),
    yOffset: -0.47, groundY: 10, eaveY: null, door: null,
    pathSnaps: [{ pos: [0, 0.47, 2], dir: [0, 0, 1] }, { pos: [0, 0.47, -2], dir: [0, 0, -1] }],
  },
  {
    id: 'cv-cobble-straight', name: 'Road Cobble Straight 01', tags: { category: 'path', style: ['cozy-village', 'cobble', 'tile-4m'] }, ...cozy('road_cobble_straight_01.glb'),
    yOffset: -0.17, groundY: 10, eaveY: null, door: null,
    pathSnaps: [{ pos: [0, 0.17, 2], dir: [0, 0, 1] }, { pos: [0, 0.17, -2], dir: [0, 0, -1] }],
  },
  { id: 'cv-tree-oak', name: 'Tree Oak 01', tags: { category: 'tree', style: ['cozy-village', 'oak'] }, ...cozy('tree_oak_01.glb'), groundY: 0.6, eaveY: null, door: null },
  { id: 'cv-bush-round', name: 'Bush Round 01', tags: { category: 'bush', style: ['cozy-village'] }, ...cozy('bush_round_01.glb'), groundY: 0.3, eaveY: null, door: null },
  { id: 'cv-barrel', name: 'Barrel 01', tags: { category: 'prop', style: ['cozy-village'] }, ...cozy('barrel_01.glb'), groundY: 0.3, eaveY: null, door: null },

  // --- Code builders (src/builders.js) -------------------------------------
  builderHouse('b-house-a', 'Builder House A (chimney left)', { w: 5.0, h: 3.0, d: 4.2, peak: 2.0, chimney: 'left', wall: '#f0e6c8', windows: [-1.4, 1.4] }),
  builderHouse('b-house-b', 'Builder House B (tall, 3 windows)', { w: 5.2, h: 3.4, d: 4.6, peak: 2.1, chimney: 'right', wall: '#f1e6c6', windows: [-1.6, 0, 1.6] }),
  builderHouse('b-house-c', 'Builder House C (small, no porch)', { w: 4.6, h: 2.8, d: 4.0, peak: 1.8, chimney: 'none', porch: false, wall: '#ece0bc', windows: [-1.3, 1.3] }),
  {
    id: 'b-well', name: 'Builder Well', tags: { category: 'well', style: ['builder'] },
    source: 'builder', builder: 'makeWell', params: {}, scale: 1, groundY: 0.6, eaveY: 3.2, door: null, pathSnaps: wellSnaps(1.9),
  },
  {
    id: 'b-fence-4', name: 'Builder Fence run (4)', tags: { category: 'fence', style: ['builder', 'post-rail'] },
    source: 'builder', builder: 'makeFence', params: { length: 4, spacing: 2 }, scale: 1, groundY: 10, eaveY: null, door: null,
    fenceSnaps: [{ pos: [-2, 0, 0], dir: [-1, 0, 0] }, { pos: [2, 0, 0], dir: [1, 0, 0] }],
  },
  {
    id: 'b-path-6', name: 'Builder Dirt path (6)', tags: { category: 'path', style: ['builder', 'dirt'] },
    source: 'builder', builder: 'makePath', params: { length: 6, width: 2.3 }, scale: 1, groundY: 10, eaveY: null, door: null,
    pathSnaps: [{ pos: [0, 0, 3], dir: [0, 0, 1] }, { pos: [0, 0, -3], dir: [0, 0, -1] }],
  },
  {
    id: 'b-plaza-ring', name: 'Plaza Ring', tags: { category: 'path', style: ['builder', 'plaza-ring'] },
    source: 'builder', builder: 'makePlazaRing', params: { inner: 5.1, outer: 6.9, segments: 48 }, scale: 1,
    groundY: 10, eaveY: null, door: null,
  },
  {
    // Gate for the front gap of a fenced lot (2.9 = paths.width + 0.6). The
    // compiler passes the instance's width/open as params; hinge line z = 0.
    id: 'b-gate', name: 'Builder Picket Gate', tags: { category: 'gate', style: ['builder', 'picket'] },
    source: 'builder', builder: 'makeGate', params: { width: 2.9, open: 0.55 }, scale: 1,
    groundY: 10, eaveY: null, door: null,
    fenceSnaps: [{ pos: [-1.45, 0, 0], dir: [-1, 0, 0] }, { pos: [1.45, 0, 0], dir: [1, 0, 0] }],
  },
  {
    id: 'b-tree', name: 'Builder Tree', tags: { category: 'tree', style: ['builder', 'puffy'] },
    source: 'builder', builder: 'makeTree', params: { scale: 1.1, seed: 3 }, scale: 1, groundY: 0.6, eaveY: null, door: null,
  },
  {
    id: 'b-bush', name: 'Builder Bush', tags: { category: 'bush', style: ['builder'] },
    source: 'builder', builder: 'makeBush', params: { scale: 1 }, scale: 1, groundY: 0.3, eaveY: null, door: null,
  },
];

export const byId = (id) => CATALOG.find((e) => e.id === id);

// Stable pools protect seeded v3 hamlets as the library grows.
export const CATALOG = [...LEGACY_CATALOG.map(e => ({ ...e, tags: { ...e.tags, style: [...e.tags.style, 'v3-kit'] } })), ...ADDITIONS, ...SEASONAL, ...VILLAGER_CATALOG, ...TOWNSFOLK_CATALOG];

// Functional queries for large-town authoring; legacy v3 selection is intact.
CATALOG.find(e => e.id === 'cv-barrel').tags.style.push('street-dressing');

import { installBuildingVariety } from './buildings-extra.js'; installBuildingVariety(); // WORKTREE-HOOK building-variety (opt-in runtime only)
