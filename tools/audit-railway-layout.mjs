import {RAIL, railPose, inSpan} from '../src/compiler/railway.js';
import {terrainSurface} from '../src/compiler/terrain.js';
import {GROUND_TOP} from '../src/compiler/woods.js';
import {worldLayers} from './railway-plan/layers.mjs';
import {shapeIndex} from './railway-plan/describe.mjs';
import {shapeBounds, shapeDist, dist} from './railway-plan/grid.mjs';

const offset = (q, x) => [q.p[0] - q.d[1] * x, q.p[1] + q.d[0] * x];
const crossed = (rail, s, c) => c.deck && inSpan(rail, s, [c.deck.from, c.deck.to]);
const WATER = ['sea', 'water', 'stream'];
const OBSTACLES = ['lot', 'building', 'parcel', 'prop', 'tree', 'reserved'];

export function auditRailwayLayout(town, catalog, graph, add) {
  const rail = town.railway;
  const layers = worldLayers(town, catalog);
  const index = Object.fromEntries([...WATER, ...OBSTACLES, 'road'].map((k) => [k, shapeIndex(layers[k])]));
  if (rail) auditAlignment(town, rail, index, add);
  auditPlacedObjects(town, layers, graph.index, add);
}

function auditAlignment(town, rail, index, add) {
  const terrain = terrainSurface(town);
  const crossingIds = new Set();
  for (const c of rail.crossings) {
    const p = c.pos;
    const checks = c.gates?.map((gate) => ({
      road: index.road.nearest(gate).d,
      obstructions: [...OBSTACLES, ...WATER].some((k) => index[k].nearest(gate).d < .1),
      side: (gate[0] - p[0]) * c.railDir[0] + (gate[1] - p[1]) * c.railDir[1],
    }));
    const road = index.road.near(p).find((shape) => shape.src === c.road && shapeDist(shape, p) <= 0);
    if (!road || !c.gated || Math.abs(90 - c.angle) > RAIL.crossingAngleTolerance ||
        Math.abs(c.railDir[0] * c.roadDir[0] + c.railDir[1] * c.roadDir[1]) > Math.sin(Math.PI / 18) ||
        !c.deck?.flush || !c.deck.continuousRails || Math.abs(c.deck.y - GROUND_TOP) > .22 ||
        checks?.length !== 2 || checks[0].side * checks[1].side >= 0 ||
        checks.some((g) => g.obstructions || g.road < .05 || g.road > 3.5)) {
      add('rail-crossing', p, 'Crossing needs square track, a flush deck with continuous rails and two clear kerb gates');
    } else crossingIds.add(c.id);
  }
  for (const t of rail.tunnels) {
    const portals = t.portals ?? [];
    if (portals.length !== 2 || t.hoodTreatment !== 'earth-berm') add('rail-portal', railPose(rail, t.s[0]).p, 'Each bore needs two stone portals and earth approaches');
    for (const [i, p] of portals.slice(0, 2).entries()) {
      const q = railPose(rail, t.s[i]);
      if (dist(q.p, p.pos) > .12 || Math.abs(q.y - p.y) > .05 || terrain.height(...p.pos) - q.y < 5 ||
          [-3, 3].some((x) => terrain.height(...offset(q, x)) - q.y < 3)) {
        add('rail-portal', p.pos, 'Stone portal lacks a continuous hill face and wings');
      }
    }
  }

  // Half-metre arc samples so a short contact between survey points is checked.
  for (let s = 0; s < rail.length; s += .5) {
    const q = railPose(rail, s);
    const t = rail.tunnels.find((t) => inSpan(rail, s, t.approach));
    if (!t) {
      if ([-2, -1.2, 0, 1.2, 2].some((x) => terrain.height(...offset(q, x)) > Math.max(q.y, GROUND_TOP) + .055)) {
        add('rail-terrain', q.p, 'Open track cuts into the hillside');
      }
    } else if (s > t.s[0] + .6 && s < t.s[1] - .6) {
      if (terrain.height(...q.p) - q.y < t.required.cover - .045 ||
          [-2.2, 2.2].some((x) => terrain.height(...offset(q, x)) - q.y < t.required.walls - .045) ||
          [-4.5, 4.5].some((x) => terrain.height(...offset(q, x)) - q.y < t.required.flank - .045)) {
        add('rail-terrain', q.p, 'Tunnel bore loses roof or lateral cover');
      }
    }
    const crossing = rail.crossings.find((c) => crossingIds.has(c.id) && crossed(rail, s, c));
    const bridge = rail.bridges.find((b) => inSpan(rail, s, [b.from, b.to]));
    for (const x of [-2, -1.2, -.6, 0, .6, 1.2, 2]) {
      const p = offset(q, x);
      for (const k of WATER) if (index[k].nearest(p, 1).d <= .015) {
        if (k !== 'stream' || !bridge || !bridge.piers?.length ||
            bridge.piers.some((p) => WATER.some((k) => index[k].nearest(p).d <= .8)) ||
            q.y - .45 <= GROUND_TOP) add('rail-water', p, 'Rail corridor enters water without a supported inland span');
      }
      for (const k of OBSTACLES) {
        const hit = index[k].nearest(p, 1);
        if (hit.d <= .015) add(k === 'tree' ? 'rail-tree' : 'rail-on-parcel', p, `Rail corridor overlaps ${hit.s.src}`);
      }
      const road = index.road.nearest(p, 1);
      if (road.d <= .015 && (!crossing || !crossed(rail, s, crossing) || road.s.src !== crossing.road)) {
        add('rail-on-road', p, `Rail corridor overlaps ${road.s.src} outside a registered crossing`);
      }
    }
  }
  for (const st of rail.stations) {
    const [a, b, c] = st.platformWithRamps;
    const length = Math.ceil(dist(a, b) / .3), width = Math.ceil(dist(b, c) / .3);
    for (let i = 0; i <= length; i++) for (let j = 0; j <= width; j++) {
      const p = a.map((v, k) => v + (b[k] - v) * i / length + (c[k] - b[k]) * j / width);
      if (WATER.some((k) => index[k].nearest(p, 1).d <= 0)) add('station-water', p, `${st.name} platform or ramp touches water`);
      const hit = [...OBSTACLES, 'road'].map((k) => index[k].nearest(p, 1)).find(({d}) => d <= .015);
      if (hit) add('station-overlap', p, `${st.name} platform or ramp overlaps ${hit.s.src}`);
    }
  }
}

function auditPlacedObjects(town, layers, roads, add) {
  // Survey inventory covers authored and catalog props, parcels, trees,
  // planters, parking and separate district placements. Uses ground-contact
  // footprints for trees, whose crowns may extend above a road.
  const fixtures = [...layers.prop,
    ...layers.tree.map((s) => ({type: 'circle', c: s.c, r: .36, src: s.src})),
    ...layers.building,
    ...town.courtyards.map((s) => ({...s, type: 'box', src: s.registryId})),
  ];
  for (const shape of fixtures) {
    const [x0, z0, x1, z1] = shapeBounds(shape);
    const nx = Math.max(1, Math.ceil((x1 - x0) / .22)), nz = Math.max(1, Math.ceil((z1 - z0) / .22));
    let hit;
    for (let i = 0; i <= nx && !hit; i++) for (let j = 0; j <= nz && !hit; j++) {
      const p = [x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz];
      if (shapeDist(shape, p) <= .015 && roads.inside(p, .06)) hit = p;
    }
    if (hit) add('placed-overlap', hit, `${shape.src} footprint intrudes on a carriageway`);
  }
}
