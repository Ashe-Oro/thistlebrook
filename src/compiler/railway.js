// Compile the approved survey into the track, stations and access links used
// by both the simulation and the renderer.
import route from '../../tools/railway-plan/route.json' with {type: 'json'};
import {landscapeHills, terrainSurface} from './terrain.js';

export const RAIL = Object.freeze({
  half: 1.2,          // ballast / sleeper half width: the corridor nobody else may use
  gauge: 1.0,         // rail centres ±0.5 m
  stock: 1.15,        // rolling stock scale against the pack's 0.65x metric authoring
  crossingAngleTolerance: 10,
  sample: 1,
});

// Existing parcel boundaries retained for the planner and map.
const rect = (minX, minZ, maxX, maxZ) => [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
export const RAIL_RESERVED = Object.freeze([
  {id: 'maple-hollow', area: rect(-42, -183, 60, -106)},
  {id: 'pinewood', area: [[-196, -24], [-86, -24], [-86, 10], [-93, 22], [-93, 38], [-80, 48], [-72, 56], [-72, 104], [-90, 120], [-130, 124], [-176, 96], [-200, 60]]},
  {id: 'pinewood-fringe', area: [[-248, -24], [-196, -24], [-200, 60], [-176, 96], [-158, 104], [-217, 69], [-245, 12]]},
  {id: 'funfair-parking', area: rect(211, 1.5, 272, 35.5)},
  {id: 'pinecrest', area: rect(150, -148, 286, 35)},
  {id: 'roadster', area: rect(-228, -193, -170, -151)},
  {id: 'starbase', area: rect(126, 214, 366, 370)},
  {id: 'vice-beach', area: rect(222, 36, 354, 202)},
]);

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]), unit = (v) => mul(v, 1 / (len(v) || 1)), dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const dist = (a, b) => len(sub(a, b));
const nearestOnSegment = (q, a, b) => {
  const d = sub(b, a);
  return Math.min(1, Math.max(0, dot(sub(q, a), d) / (dot(d, d) || 1)));
};
const distanceToSegment = (q, a, b) => dist(q, add(a, mul(sub(b, a), nearestOnSegment(q, a, b))));

/** Point and heading at arc length s (wraps). */
export function railPose(rail, s) {
  const L = rail.length, n = rail.samples.length; s = ((s % L) + L) % L;
  const f = s / L * n, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
  const a = rail.samples[i].p, b = rail.samples[j].p, d = unit(add(mul(rail.samples[i].d, 1 - t), mul(rail.samples[j].d, t)));
  return {p: add(a, mul(sub(b, a), t)), d, s, y: (rail.samples[i].y ?? 0) * (1 - t) + (rail.samples[j].y ?? 0) * t};
}
/** Nearest arc length on the loop to a point. */
export function railProject(rail, q) {
  let best = Infinity, bestS = 0;
  for (const [i, sample] of rail.samples.entries()) {
    const next = rail.samples[(i + 1) % rail.samples.length];
    const t = nearestOnSegment(q, sample.p, next.p);
    const e = dist(q, add(sample.p, mul(sub(next.p, sample.p), t)));
    if (e < best) {
      best = e;
      bestS = sample.s + t * ((next.s || rail.length) - sample.s);
    }
  }
  return {s: bestS % rail.length, distance: best};
}
export const inSpan = (rail, s, [a, b]) => {
  s = ((s % rail.length) + rail.length) % rail.length;
  return a <= b ? s >= a && s <= b : s >= a || s <= b;
};
export const inTunnel = (rail, s) => rail.tunnels.some((t) => inSpan(rail, s, t.s));
export const polygonContains = (poly, p) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
};

export const SERVICE = Object.freeze({...route.service, dwell: 24, cruise: 9, accel: 1});
const {near, far} = route.meta.platform;

const platformBounds = (st) => ({
  min: [0, 1].map((axis) => Math.min(...st.polygon.map((p) => p[axis]))),
  max: [0, 1].map((axis) => Math.max(...st.polygon.map((p) => p[axis]))),
});
/** Reserve each station and its approach before placing seeded scenes. */
export function railwayAccessReservations() {
  return route.stations.flatMap((st) => [
    platformBounds({polygon: st.platformWithRamps}),
    {
      min: st.entry.map((x, i) => Math.min(x, st.access.to[i]) - .8),
      max: st.entry.map((x, i) => Math.max(x, st.access.to[i]) + .8),
    },
  ]);
}

function stationFurniture(st) {
  const h = st.length / 2, out = [];
  const at = (along, k) => add(add(st.centre, mul(st.along, along)), mul(st.out, (k - .5) * (st.far - st.near)));
  const face = Math.atan2(-st.out[0], -st.out[1]); // +z of the model toward the track
  const put = (asset, along, k, extra = {}) => out.push({asset, pos: at(along, k).map((v) => +v.toFixed(3)), yaw: +face.toFixed(4), ...extra});
  const lamps = [-12, -4, 4, 12];
  for (const a of lamps) put('platform_gas_lamp', a, .82, {light: true});
  for (const a of [-(h - 4), h - 4]) put('station_nameboard', a, .8, {sign: st.short});
  put('waiting_shelter', -3, .66);
  put('platform_bench', -8, .75);
  put('ticket_machine', 8, .8);
  put('platform_ramp_end', -(h + .75), .5, {ramp: true});
  put('platform_ramp_end', h + .75, .5, {ramp: true, flip: true});
  return out;
}

/** The compiled plan: geometry, stations, crossings. Pure and deterministic. */
export function planRailway() {
  const {centreline, summary, tunnels, crossings, bridges, segments, stations, service} = structuredClone(route);
  const {length} = summary;
  const rail = {length, tunnels, crossings, bridges, segments, service};
  rail.samples = centreline.map(([x, z, y], i) => {
    const prev = centreline[(i - 1 + centreline.length) % centreline.length];
    const next = centreline[(i + 1) % centreline.length];
    const s = i * length / centreline.length;
    return {p: [x, z], d: unit(sub(next, prev)), y, s, tunnel: inTunnel(rail, s)};
  });
  rail.stations = stations.map((st) => {
    const along = unit(st.dir), out = unit(sub(st.platform[3], st.platform[0]));
    const station = {...st, side: Math.sign(cross(along, out)), trackCentre: st.centre,
      centre: add(st.centre, mul(out, (near + far) / 2)),
      y: railPose(rail, st.s).y, along, out, near, far, polygon: st.platform, venue: 'rail-' + st.id};
    station.furniture = stationFurniture(station);
    return station;
  });
  rail.crossings = crossings.map((c) => {
    const pose = railPose(rail, c.s);
    return {...c, pos: c.at, railDir: pose.d, roadDir: c.roadDir, reach: Math.max(Math.abs(c.s - c.deck.from), Math.abs(c.deck.to - c.s)),
      gated: c.gates?.length === 2};
  });
  return rail;
}

// Every point within `margin` of the visible rails (tunnel excluded).
function sampleIndex(samples) {
  const grid = new Map(), cell = 8;
  for (const q of samples) {
    if (q.tunnel) continue;
    const key = Math.floor(q.p[0] / cell) + ',' + Math.floor(q.p[1] / cell);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(q);
  }
  return {grid, cell};
}
const railIndices = new WeakMap();

export function nearRail(rail, q, margin = 0) {
  if (!railIndices.has(rail)) railIndices.set(rail, sampleIndex(rail.samples));
  const {grid, cell} = railIndices.get(rail), radius = RAIL.half + margin;
  for (let x = Math.floor((q[0] - radius) / cell); x <= Math.floor((q[0] + radius) / cell); x++) {
    for (let z = Math.floor((q[1] - radius) / cell); z <= Math.floor((q[1] + radius) / cell); z++) {
      for (const smp of grid.get(x + ',' + z) ?? []) if (dist(smp.p, q) <= radius) return smp;
    }
  }
  return null;
}
/** Signed offset of q from the rail centre line near arc length s (left +). */
export function railOffset(rail, q) {
  const {s} = railProject(rail, q), {p, d} = railPose(rail, s); return {s, along: dot(sub(q, p), d), across: cross(d, sub(q, p))};
}
export const crossingAt = (rail, q, pad = 0) => rail.crossings.find((c) => {
  const v = sub(q, c.pos);
  return Math.abs(dot(v, c.railDir)) <= c.reach + pad && Math.abs(cross(c.railDir, v)) <= RAIL.half + pad;
});

/** Attach the two platform walks to their surveyed sidewalk nodes. */
export function addRailway(town, catalog) {
  const rail = planRailway();
  for (const st of rail.stations) {
    town.venues.push({id: st.venue, name: st.name + ' station', type: 'station', district: st.district,
      pos: st.centre, entry: st.entry, box: platformBounds(st), height: 4.5,
      story: 'The Northern Loop calls here on every lap, day and night.'});
    const link = (a, b, hidden = false) => {
      if (dist(a, b) > .005) town.roads.push({a, b, width: 1.6, kind: 'walk', owner: 'railway',
        external: 'railway', station: st.id, hidden, sidewalkJoin: hidden});
    };
    link(st.entry, st.access.to);
    const approach = st.access.approach;
    if (approach) {
      for (let i = 1; i < approach.length; i++) {
        link(approach[i - 1], approach[i]);
        town.roads.at(-1).surveyApproach = true;
      }
    } else {
      // Join the surveyed sidewalk node to the underlying world-road graph.
      const nearest = town.roads.filter((r) => !r.station).reduce((best, road) => {
        const line = road.centerline ?? [road.a, road.b];
        const distance = Math.min(...line.slice(1).map((b, i) => distanceToSegment(st.access.to, line[i], b)));
        return distance < best.distance ? {road, distance} : best;
      }, {distance: Infinity});
      const {a, b} = nearest.road;
      const anchor = dist(a, st.access.to) < dist(b, st.access.to) ? a : b;
      link(st.access.to, anchor, true);
    }
  }
  fitLandscape(town, rail, catalog);
  town.railway = rail;
  return rail;
}

// The bore geology is part of the survey. Other seeds can vary vegetation and
// hills away from the railway while retaining the same engineered alignment.
function fitLandscape(town, rail, catalog) {
  if (!town.landscape) return;
  const surveyed = route.terrain;
  const open = rail.samples.filter((q) => !rail.tunnels.some((t) => inSpan(rail, q.s, t.approach)));
  const hills = landscapeHills(town);
  town.landscape.hills = town.landscape.hills.filter((h, i) => {
    if (surveyed.some((fixed) => dist(h.pos, fixed.pos) < 1 ||
        town.seed !== route.meta.seed && dist(h.pos, fixed.pos) < h.radius + fixed.radius)) return false;
    const nearby = open.filter((q) => dist(q.p, h.pos) < h.radius + 2);
    if (!nearby.length) return true;
    const terrain = terrainSurface(town, {hills: [hills[i]], peaks: [], ridge: false});
    return !nearby.some((q) => [-2, -1, 0, 1, 2].some((offset) =>
      terrain.height(q.p[0] - q.d[1] * offset, q.p[1] + q.d[0] * offset) > q.y + .05));
  });
  town.landscape.hills.push(...structuredClone(surveyed));
  const cleared = route.scatterCleared;
  const spare = (p) => {
    const asset = p.asset ?? p.id;
    const isTree = /tree|pine|oak/i.test(asset);
    const bounds = catalog.get(asset)?.bounds;
    const extent = bounds ? Math.hypot(...[0, 2].map((axis) => Math.max(Math.abs(bounds.min[axis]), Math.abs(bounds.max[axis])))) : 1.6;
    const radius = (isTree ? extent + .3 : .5) * (p.scale ?? 1);
    const onApproach = rail.tunnels.some((t) => t.portals.some((mouth) => dist(mouth.pos, p.pos) < 4 + radius));
    return !cleared.some((c) => dist(p.pos, c.pos) < .005) && !nearRail(rail, p.pos, radius)
      && !onApproach && !rail.stations.some((st) => polygonContains(st.platformWithRamps, p.pos) ||
        st.platformWithRamps.some((a, i, corners) => distanceToSegment(p.pos, a, corners[(i + 1) % corners.length]) < radius))
      && !town.roads.some((r) => r.owner === 'railway' && distanceToSegment(p.pos, r.a, r.b) < r.width / 2 + radius);
  };
  town.landscape.models = town.landscape.models.filter(spare);
  town.trees = town.trees.filter(spare);
}
