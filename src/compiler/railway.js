// Thistlebrook Grand Loop geometry, platform access and crossing inventory.
import {REGIONAL} from '../roads/regional.js';
import {groundAt, inWater, planBridges} from './water.js';
import {insideLandscape} from './landscape.js';

export const RAIL = Object.freeze({
  half: 1.2,          // ballast / sleeper half width: the corridor nobody else may use
  gauge: 1.0,         // rail centres ±0.5 m
  stock: 1.15,        // rolling stock scale against the pack's 0.65x metric authoring
  platformEdge: 1.45, // track centre to platform coping
  platformWidth: 2.6,
  platformLength: 30,
  crossingAngleTolerance: 2,
  crossingReach: 4.8, // along-track half length of a level crossing deck (kerb + footway + fence)
  sample: 1,
});

// Reserved ground parcels. Elevated and offshore easements are marked explicitly.
const rect = (minX, minZ, maxX, maxZ) => [[minX, minZ], [maxX, minZ], [maxX, maxZ], [minX, maxZ]];
export const RAIL_RESERVED = Object.freeze([
  {id: 'maple-hollow', area: rect(-42, -183, 60, -106)},
  {id: 'pinewood', area: [[-196, -24], [-86, -24], [-86, 10], [-93, 22], [-93, 38], [-80, 48], [-72, 56], [-72, 104], [-90, 120], [-130, 124], [-176, 96], [-200, 60]]},
  {id: 'pinewood-fringe', area: [[-248, -24], [-196, -24], [-200, 60], [-176, 96], [-158, 104], [-217, 69], [-245, 12]]},
  {id: 'funfair-parking', area: rect(211, 1.5, 272, 35.5), overpass: true},
  {id: 'pinecrest', area: rect(150, -148, 286, 35), overpass: true},
  {id: 'roadster', area: rect(-228, -193, -170, -151)},
  {id: 'starbase', area: rect(126, 214, 366, 370), offshore: true},
  {id: 'vice-beach', area: rect(222, 36, 354, 202), offshore: true},
]);

// Clockwise, in x/z metres. The radius at each vertex fillets its two tangents.
// The Airport Road bend uses a radial approach so the deck crosses squarely.
const BEND = [74.5, -173.5], BEND_DIR = [Math.cos(228 * Math.PI / 180), Math.sin(228 * Math.PI / 180)];
const onBend = (z) => [BEND[0] + (z - BEND[1]) * BEND_DIR[0] / BEND_DIR[1], z];
const EAST_X = 72.4, NORTH_Z = -187, WEST_X = -44.5, UNION_Z = -166;
const eastCorner = () => [EAST_X, BEND[1] + (EAST_X - BEND[0]) * BEND_DIR[1] / BEND_DIR[0]];
export const RAIL_CONTROL = Object.freeze([
  [WEST_X, UNION_Z, 6],
  [WEST_X, NORTH_Z, 6],
  [...onBend(NORTH_Z), 10],
  [...eastCorner(), 16],
  [EAST_X, -43, 17],
  [142, -43, 20],
  [142, 23, 24],
  [303, 23, 24],
  [303, 188, 25],
  [378, 246, 30],
  [378, 376, 25],
  [109, 376, 24],
  [109, 42, 24],
  [-55, 42, 25],
  [-58, 146, 25],
  [-118, 146, 21],
  [-290, 56, 44],
  [-237, -55, 33],
  [-239, -203, 24],
  [-153, -203, 16],
  [-141, UNION_Z, 16],
]);

// The integration lane adds the parcel record after its roads and buildings.
export const hasMapleHollow = (town) => Boolean(town.mapleHollow || town.regions.some((r) => r.id === 'maple-hollow'));

// Stations use the town-facing side of the alignment. Each access polyline
// starts at the platform and joins an existing public path.
export const STATIONS = Object.freeze([
  {id: 'union', name: 'Thistlebrook Union', short: 'THISTLEBROOK UNION', stop: [-91, UNION_Z], side: 1, district: 'works', venue: 'work-station', existing: true, near: 2.2, far: 6, length: 33},
  {id: 'maple', name: 'Maple Hollow', short: 'MAPLE HOLLOW', stop: [24, NORTH_Z], side: 1, district: 'maple-hollow', access: [[24, -177.4571]], length: 30, far: 3.95},
  {id: 'airport', name: 'Municipal Airport', short: 'MUNICIPAL AIRPORT', stop: [EAST_X, -155], side: 1, district: 'airport', access: [[64, -155]], length: 29},
  {id: 'high', name: 'Thistlebrook High · Owls Stadium', short: 'OWLS STADIUM', stop: [EAST_X, -121], side: 1, district: 'common', access: [[64, -117]], length: 33},
  {id: 'quay', name: 'Lantern Quay', short: 'LANTERN QUAY', stop: [96, -43], side: 1, district: 'quay', access: [[63, -24], [56, -17], [55.27225, -4.14074]], length: 30},
  {id: 'pinecrest', name: 'Pinecrest Adventure Park', short: 'PINECREST PARK', stop: [184, 23], side: -1, district: 'themepark', access: [[191, 10], [210, 5], [220, 5]], length: 32},
  {id: 'coast', name: 'Coral Coast Beach', short: 'CORAL COAST BEACH', stop: [303, 83], side: 1, district: 'coral-coast', access: [[294, 68], [274, 68]], length: 46},
  {id: 'starbase', name: 'Starbase Visitor Garden', short: 'STARBASE', stop: [183, 376], side: 1, district: 'starbase', access: [[183, 319]], length: 50},
  {id: 'harbor', name: 'Saltwind Harbor', short: 'SALTWIND HARBOR', stop: [109, 82], side: 1, district: 'harbor', access: [[119, 60], [135, 56]], length: 32},
  {id: 'downtown', name: 'Old Town Centre', short: 'OLD TOWN CENTRE', stop: [-36, 42], side: 1, district: 'downtown', access: [[-53, 25], [-56, 22], [-57, -1]], length: 30},
  {id: 'woods', name: 'Pinewood South Trail', short: 'PINEWOOD SOUTH', stop: [-102, 146], side: 1, district: 'outskirts', access: [[-104, 119], [-75, 115], [-63, 107], [-53, 105], [-43, 82]], length: 29},
  {id: 'fair', name: 'Merrymead Fairground', short: 'MERRYMEAD FAIR', stop: [-237, -89], side: 1, district: 'fair', access: [[-220, -84], [-199, -84]], length: 44},
  {id: 'roadster', name: 'Roadster Proving Ground', short: 'ROADSTER ARENA', stop: [-184, -203], side: 1, district: 'roadster', access: [[-181.5, -185], [-182, -179]], length: 32},
]);
export const RAIL_POIS = Object.freeze([
  {id: 'union', place: 'work-station', station: 'union'},
  {id: 'airport', place: 'airport-terminal', station: 'airport'},
  {id: 'owls', place: 'football', station: 'high', gate: [60, -97]},
  {id: 'quay', registry: 'quay', station: 'quay'},
  {id: 'pinecrest', place: 'pinecrest', station: 'pinecrest'},
  {id: 'coral-beach', place: 'coast-beach', station: 'coast'},
  {id: 'starbase', place: 'starbase-garden', station: 'starbase'},
  {id: 'harbor', place: 'harbor-beach', station: 'harbor'},
  {id: 'downtown', place: 'fountain', station: 'downtown'},
  {id: 'pinewood', registry: 'woods:trailhead-south', station: 'woods', gate: [-104, 119]},
  {id: 'fair', place: 'fair-wheel', station: 'fair'},
  {id: 'roadster', place: 'roadster-arena', station: 'roadster'},
  {id: 'maple-hollow', station: 'maple', parcel: 'maple-hollow', gate: [24, -180.853]}, // north sidewalk on Hollow Crescent
]);
export const RAIL_DISTRICTS = Object.freeze([
  'works', 'downtown', 'civic-green', 'common', 'airport', 'harbor',
  'coral-coast', 'pinewood', 'fair', 'outskirts',
]);
export const SERVICE = Object.freeze({first: 6.5, last: 22, dwell: 24, cruise: 13, tunnelCruise: 9, accel: 1, berth: 'union'});

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, k) => [a[0] * k, a[1] * k];
const len = (v) => Math.hypot(v[0], v[1]), unit = (v) => mul(v, 1 / (len(v) || 1)), dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
export const dist = (a, b) => len(sub(a, b));
const nearestOnSegment = (q, a, b) => {
  const d = sub(b, a);
  return Math.min(1, Math.max(0, dot(sub(q, a), d) / (dot(d, d) || 1)));
};
const distanceToSegment = (q, a, b) => dist(q, add(a, mul(sub(b, a), nearestOnSegment(q, a, b))));

/** Closed, filleted loop sampled every `step` metres: [{p, d, s, tunnel}]. */
export function sampleLoop(control = RAIL_CONTROL, step = RAIL.sample) {
  const n = control.length, pieces = [];
  for (let i = 0; i < n; i++) {
    const prev = control[(i + n - 1) % n], c = control[i], next = control[(i + 1) % n];
    const u = unit(sub(c, prev)), v = unit(sub(next, c)), turn = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
    const t = c[2] * Math.tan(turn / 2), a = sub(c, mul(u, t)), b = add(c, mul(v, t)), sign = Math.sign(cross(u, v));
    const centre = add(a, mul([-u[1] * sign, u[0] * sign], c[2]));
    pieces.push({a, b, centre, r: c[2], sign, turn});
  }
  const points = [];
  for (let i = 0; i < n; i++) {
    const arc = pieces[i], nextArc = pieces[(i + 1) % n];
    const a0 = Math.atan2(arc.a[1] - arc.centre[1], arc.a[0] - arc.centre[0]), steps = Math.max(2, Math.ceil(arc.r * arc.turn / (step * .5)));
    for (let k = 0; k < steps; k++) { const ang = a0 + arc.sign * arc.turn * k / steps; points.push([arc.centre[0] + Math.cos(ang) * arc.r, arc.centre[1] + Math.sin(ang) * arc.r]); }
    if (dot(sub(nextArc.a, arc.b), sub(control[(i + 1) % n], control[i])) < 0) {
      throw new Error('Railway fillets overlap at control segment ' + i);
    }
    const L = dist(arc.b, nextArc.a), m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) points.push(add(arc.b, mul(sub(nextArc.a, arc.b), k / m)));
  }
  // Re-sample at a uniform spacing so s is arc length.
  const out = []; let s = 0, carry = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length], L = dist(a, b), d = unit(sub(b, a));
    for (let x = carry; x < L; x += step) { out.push({p: add(a, mul(d, x)), d, s: +(s + x - carry + carry).toFixed(4)}); }
    carry = (carry - L) % step; if (carry < 0) carry += step; s += L;
  }
  const length = s;
  out.forEach((q, i) => { q.s = i * (length / out.length); });
  return {samples: out, length};
}

/** Point and heading at arc length s (wraps). */
export function railPose(rail, s) {
  const L = rail.length, n = rail.samples.length; s = ((s % L) + L) % L;
  const f = s / L * n, i = Math.floor(f) % n, j = (i + 1) % n, t = f - Math.floor(f);
  const a = rail.samples[i].p, b = rail.samples[j].p, d = unit(sub(b, a));
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
const smoothstep = (t) => {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
};

function sidingPosition(rail, s) {
  const pose = railPose(rail, s), {start, length} = rail.siding;
  const x = (pose.s - start + rail.length) % rail.length;
  const offset = 4.6 * smoothstep(Math.min(x, length - x) / 12);
  return {...pose, p: add(pose.p, mul([pose.d[1], -pose.d[0]], offset))};
}

export function sidingPose(rail, s) {
  const pose = sidingPosition(rail, s);
  return {...pose, d: unit(sub(sidingPosition(rail, s + .2).p, sidingPosition(rail, s - .2).p))};
}

export const inTunnel = (rail, s) => { if (!rail.tunnel) return false; const [a, b] = rail.tunnel, L = rail.length; s = ((s % L) + L) % L; return a < b ? s > a && s < b : s > a || s < b; };
export const polygonContains = (poly, p) => { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; };
const segIntersect = (p1, p2, p3, p4) => { const d1 = sub(p2, p1), d2 = sub(p4, p3), den = cross(d1, d2); if (Math.abs(den) < 1e-9) return null; const w = sub(p3, p1), t = cross(w, d2) / den, u = cross(w, d1) / den; return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(p1, mul(d1, t)) : null; };

/** Platform rectangle beside the stop: corners, centre, along/out unit vectors. */
function platformFor(rail, st) {
  const {s} = railProject(rail, st.stop), {p, d} = railPose(rail, s);
  // side +1 = (-d.z, d.x) in plan coordinates.
  const o = mul([-d[1], d[0]], st.side);
  const near = st.near ?? RAIL.platformEdge, far = st.far ?? near + RAIL.platformWidth, length = st.length ?? RAIL.platformLength, h = length / 2;
  const corner = (along, off) => add(add(p, mul(d, along)), mul(o, off));
  return {s, y: railPose(rail, s).y, centre: corner(0, (near + far) / 2), along: d, out: o, near, far, length, polygon: [corner(-h, near), corner(h, near), corner(h, far), corner(-h, far)]};
}

function stationsFor(town, rail) {
  return STATIONS.filter((st) => st.id !== 'maple' || hasMapleHollow(town))
    .map((st) => ({...st, ...platformFor(rail, st)}));
}

const platformBounds = (st) => ({
  min: [0, 1].map((axis) => Math.min(...st.polygon.map((p) => p[axis]))),
  max: [0, 1].map((axis) => Math.max(...st.polygon.map((p) => p[axis]))),
});
const platformPath = (st) => [
  add(st.centre, mul(st.out, (st.far - st.near) / 2 - .3)).map((v) => +v.toFixed(3)),
  ...st.access,
];

/** Reserve the platform and its approach before placing seeded scenes. */
export function railwayAccessReservations(town) {
  return stationsFor(town, sampleLoop()).filter((st) => !st.existing).flatMap((st) => {
    const path = platformPath(st), width = 1.6;
    return [platformBounds(st), ...path.slice(1).map((b, i) => ({
      min: b.map((x, axis) => Math.min(x, path[i][axis]) - width / 2),
      max: b.map((x, axis) => Math.max(x, path[i][axis]) + width / 2),
    }))];
  });
}

/** Level crossings: where the visible loop meets a carriageway centre line. */
export function findCrossings(town, rail) {
  const found = [];
  const lines = [];
  for (const r of town.roads) if (r.kind === 'world-link' && r.centerline) for (let i = 1; i < r.centerline.length; i++) lines.push({a: r.centerline[i - 1], b: r.centerline[i], hw: REGIONAL.width / 2, reach: REGIONAL.fence, road: r});
  for (const r of town.roads) if (r.kind === 'avenue' || (!r.owner && r.width >= 2.4 && r.kind !== 'world-link')) lines.push({a: r.a, b: r.b, hw: r.width / 2, reach: r.width / 2 + 1.6, road: r});
  const n = rail.samples.length;
  for (let i = 0; i < n; i++) {
    const A = rail.samples[i], B = rail.samples[(i + 1) % n];
    if (A.tunnel || A.clearance >= 3) continue;
    for (const l of lines) {
      const hit = segIntersect(A.p, B.p, l.a, l.b); if (!hit) continue;
      if (found.some((c) => dist(c.pos, hit) < 3)) continue;
      const rd = unit(sub(l.b, l.a)), angle = Math.acos(Math.min(1, Math.abs(dot(rd, A.d)))) * 180 / Math.PI;
      found.push({id: 'crossing-' + found.length, pos: hit.map((v) => +v.toFixed(3)), s: A.s + dist(A.p, hit), roadDir: rd, railDir: A.d, angle: +angle.toFixed(1), hw: l.hw, reach: Math.max(l.reach, RAIL.crossingReach), kind: l.road.kind});
    }
  }
  return found;
}

// Platform dressing in platform-local terms: along the track, and out from the
// coping (0 = edge, 1 = back). Yaw makes faces look at the track.
function stationFurniture(st) {
  const h = st.length / 2, out = [];
  const at = (along, k) => add(add(st.centre, mul(st.along, along)), mul(st.out, (k - .5) * (st.far - st.near)));
  const face = Math.atan2(-st.out[0], -st.out[1]); // +z of the model toward the track
  const put = (asset, along, k, extra = {}) => out.push({asset, pos: at(along, k).map((v) => +v.toFixed(3)), yaw: +face.toFixed(4), ...extra});
  const lamps = st.existing ? [-13, 13] : [-12, -4, 4, 12];
  for (const a of lamps) put('platform_gas_lamp', a, .82, {light: true});
  for (const a of [-(h - 4), h - 4]) put('station_nameboard', a, .8, {sign: st.short});
  if (st.existing) { put('platform_bench', -8, .75); put('platform_bench', 8, .75); put('station_clock', 0, .78); }
  else { put('waiting_shelter', 0, .62); put('platform_bench', -8, .75); put('ticket_machine', 8, .8); put('platform_ramp_end', -(h + 1.25), .5, {ramp: true}); put('platform_ramp_end', h + 1.25, .5, {ramp: true, flip: true}); }
  return out;
}

/** The compiled plan: geometry, stations, crossings. Pure and deterministic. */
export function planRailway(town) {
  const loop = sampleLoop();
  const rail = {samples: loop.samples, length: +loop.length.toFixed(3)};
  // Viaducts keep the Pinecrest shuttle and parking approach on their original
  // grade, and span the footpaths and river in the Stillwater floodplain.
  const viaducts = [
    {from: [141, -34], to: [303, 61], height: 5.5, ramp: 24},
    {from: [109, 57], to: [-57, 133], height: 3.6, ramp: 24},
  ].map(({from, to, height, ramp}) => ({a: railProject(rail, from).s, b: railProject(rail, to).s, height, ramp}));
  for (const q of rail.samples) {
    const plate = town.regions.find(({id, bounds: b}) => id === 'airport' && q.p[0] > b.minX && q.p[0] < b.maxX && q.p[1] > b.minZ && q.p[1] < b.maxZ);
    q.ground = plate ? .03 : +groundAt(town, q.p).toFixed(3);
    q.offshore = !insideLandscape(q.p);
    q.wet = inWater(q.p, RAIL.half) || q.offshore && q.ground < -.2;
    q.clearance = Math.max(...viaducts.map(({a, b, height, ramp}) => height * smoothstep(Math.min(q.s - a, b - q.s) / ramp)));
  }
  // Keep coastal trestles level over the surf and ease down over the banks.
  const wet = new Set(rail.samples.filter((q) => q.wet));
  const n = rail.samples.length;
  for (const [i, q] of rail.samples.entries()) {
    let coastal = 0;
    for (let k = 0; k <= 10; k++) if (wet.has(rail.samples[(i + k) % n]) || wet.has(rail.samples[(i - k + n) % n])) {
      coastal = .85 * smoothstep(1 - k / 11);
      break;
    }
    q.bridge = coastal > .03 || q.clearance > .03;
    q.y = Math.max(q.ground + q.clearance, q.ground + (.85 - q.ground) * coastal / .85);
  }
  const paths = town.roads.flatMap((r) => {
    const line = r.centerline ?? [r.a, r.b];
    const half = r.centerline ? REGIONAL.width / 2 + 1.2 : r.owner === 'themepark' ? 3.3 : r.width / 2;
    return line.slice(1).map((b, i) => ({a: line[i], b, half}));
  });
  const parking = RAIL_RESERVED.find((r) => r.id === 'funfair-parking').area;
  rail.piers = [];
  let nextPier = 0;
  for (const q of rail.samples) {
    if (!q.bridge || q.y < .2 || q.s < nextPier) continue;
    if (polygonContains(parking, q.p) || paths.some(({a, b, half}) => distanceToSegment(q.p, a, b) < half + .85)) continue;
    rail.piers.push(q);
    nextPier = q.s + (q.clearance >= 3 ? 17 : 8);
  }
  rail.stations = stationsFor(town, rail);
  const start = railProject(rail, [-130, UNION_Z]).s, end = railProject(rail, [-50, UNION_Z]).s;
  rail.siding = {id: 'union-siding', start, length: (end - start + rail.length) % rail.length};
  const count = Math.ceil(rail.siding.length / .72);
  rail.siding.samples = Array.from({length: count + 1}, (_, i) => sidingPose(rail, start + i * rail.siding.length / count));
  rail.crossings = findCrossings(town, rail).map((c) => ({...c, gated: true}));
  for (const st of rail.stations) st.furniture = stationFurniture(st);
  return rail;
}

// Every point within `margin` of the visible rails (tunnel excluded).
function sampleIndex(samples) {
  const grid = new Map(), cell = 8;
  for (const q of samples) {
    if (q.tunnel || q.clearance >= 3) continue;
    const key = Math.floor(q.p[0] / cell) + ',' + Math.floor(q.p[1] / cell);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(q);
  }
  return {grid, cell};
}
const railIndices = new WeakMap();

export function nearRail(rail, q, margin = 0) {
  if (!railIndices.has(rail)) railIndices.set(rail, sampleIndex([...rail.samples, ...(rail.siding?.samples ?? [])]));
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
export const crossingAt = (rail, q, pad = 0) => rail.crossings.find((c) => { const v = sub(q, c.pos); return Math.abs(dot(v, c.railDir)) <= c.reach + pad && Math.abs(cross(c.railDir, v)) <= c.hw * 3 + 6; });

/** Compiler hook (compileWorld, after planWater): plan, station venues, walk links, corridor clearing. */
export function addRailway(town) {
  const rail = planRailway(town);
  // Station venues: platforms are destinations on the walk graph.
  for (const st of rail.stations) {
    if (st.existing) { st.node = town.venues.find((v) => v.id === st.venue)?.node; continue; }
    const path = platformPath(st), entry = path[0];
    st.entry = entry; st.venue = 'rail-' + st.id;
    town.venues.push({id: st.venue, name: st.name + ' station', type: 'station', district: st.district, pos: st.centre.map((v) => +v.toFixed(3)), entry, box: platformBounds(st), height: 4.5,
      story: 'A stop on the Thistlebrook Grand Loop. The mixed train calls on every lap and waits ' + SERVICE.dwell + ' seconds for passengers.'});
    for (let i = 1; i < path.length; i++) town.roads.push({a: path[i - 1], b: path[i], width: 1.6, kind: 'walk', owner: 'railway', external: 'railway', station: st.id});
  }
  // The east spectator entrance connects directly to the airport-road kerb.
  town.roads.push({a: [60, -97], b: [64, -97], width: 1.6, kind: 'walk', owner: 'railway', external: 'railway', railFootpath: true});
  // Clear the corridor of trees, meadow models and hills the random landscape
  // put there (the random stream and every other placement are unchanged).
  const onPlatform = (q, r) => rail.stations.some((st) => { const v = sub(q, st.centre), a = dot(v, st.along), o = dot(v, st.out); return Math.abs(a) < st.length / 2 + 3 + r && Math.abs(o) < (st.far - st.near) / 2 + r; });
  const walks = town.roads.filter((r) => r.owner === 'railway');
  const clear = (q, r) => !nearRail(rail, q, r) && !onPlatform(q, r)
    && !walks.some((walk) => distanceToSegment(q, walk.a, walk.b) < walk.width / 2 + Math.max(1.05, r));
  const removed = {trees: 0, models: 0, hills: 0};
  // Tree crowns overhang their trunks: keep them a crown's width off the platforms.
  const keep = (list, radius, key) => list.filter((t) => { const ok = clear(t.pos, radius(t)) && !onPlatform(t.pos, 2.8); if (!ok) removed[key]++; return ok; });
  town.trees = keep(town.trees, () => 1.4, 'trees');
  if (town.landscape) {
    town.landscape.models = keep(town.landscape.models, (m) => (m.asset.includes('tree') ? 1.6 : .8) * (m.scale || 1), 'models');
    town.landscape.hills = town.landscape.hills.filter((h) => { const ok = !rail.samples.some((q) => !q.tunnel && dist(q.p, h.pos) < h.radius + RAIL.half + 1.5); if (!ok) removed.hills++; return ok; });
  }
  rail.cleared = removed;
  for (const bridge of planBridges(town).filter((b) => town.roads[b.road]?.owner === 'railway')) {
    const id = 'water-bridge-' + town.water.bridges.filter((b) => !b.existing).length;
    town.water.bridges.push({...bridge, id});
  }
  town.railway = rail;
  return rail;
}

/** True when a plan footprint (world box, metres) overlaps the visible rail band. */
export function boxOnRail(rail, min, max, pad = .3) {
  for (const q of rail.samples) { if (q.tunnel || q.clearance >= 3) continue; const h = RAIL.half + pad; if (q.p[0] + h > min[0] && q.p[0] - h < max[0] && q.p[1] + h > min[1] && q.p[1] - h < max[1]) return true; }
  return false;
}
