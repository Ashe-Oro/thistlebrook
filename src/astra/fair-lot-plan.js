// OWNER: grok-fairlot lane. Funfair Parking: the lot between Pinecrest's gate,
// the end of the mountain road and the Coral Coast blocks. Pure layout (no
// renderer, DOM, timers or global random); fair-lot-sim.js drives it and
// fair-lot.js only mirrors it. World metres, +x east, +z south (toward the coast).
import * as THREE from 'three';
import {APPROACH} from './themepark-plan.js';
import {footprintsOverlap} from '../roads/collisions.js';

// Lot cars: Tesla-sized toys (sedan 1.08 x 2.3, wedge truck 1.14 x 2.5).
export const CAR = {length: 2.6, width: 1.2};
export const LOT = {minX: 223, maxX: 268.4, minZ: 4.6, maxZ: 32.2, min: [223, 4.6], max: [268.4, 32.2]};
// Kept clear of the scattered park pines and anything else that would sit on the lot.
export const LOT_RESERVE = {minX: 211, maxX: 272, minZ: 1.5, maxZ: 35.5};
const BAY_W = 1.83, SLOT0 = 227.4, SLOTS = 20;
export const BAY = {width: BAY_W, depth: 3};
export const slotX = (k) => SLOT0 + BAY_W * (k + .5);
// Aisles. A0 is two-lane (in: north lane, out: south lane, west end only);
// A1, A2, the east aisle (E) and the west aisle (W) are one-way.
export const AISLES = {
  A0: {min: [LOT.minX, 4.6], max: [LOT.maxX, 9]},
  A1: {min: [LOT.minX, 16.2], max: [LOT.maxX, 20.6]},
  A2: {min: [LOT.minX, 27.8], max: [LOT.maxX, 32.2]},
  W: {min: [LOT.minX, 4.6], max: [227.4, 32.2]},
  E: {min: [264, 4.6], max: [LOT.maxX, 32.2]},
};
export const LANES = {A0in: 5.7, A0out: 7.9, A1: 18.4, A2: 30, W: 225.2, E: 266.2};
// Bay rows: z0..z1, the aisle they open onto and the way a parked car faces.
export const ROWS = [
  {id: 'D1a', z0: 9, z1: 12, aisle: 'A0', lane: LANES.A0in, dir: 1, nose: 1},
  {id: 'D1b', z0: 13.2, z1: 16.2, aisle: 'A1', lane: LANES.A1, dir: -1, nose: -1},
  {id: 'D2a', z0: 20.6, z1: 23.6, aisle: 'A1', lane: LANES.A1, dir: -1, nose: 1},
  {id: 'D2b', z0: 24.8, z1: 27.8, aisle: 'A2', lane: LANES.A2, dir: -1, nose: -1},
];
// Pedestrian strips between back-to-back rows, the promenade (slots 9-10)
// and the walkway along the fence to the Funfair gate.
export const SEAMS = [{min: [SLOT0, 12], max: [264, 13.2], z: 12.6}, {min: [SLOT0, 23.6], max: [264, 24.8], z: 24.2}];
export const PROMENADE = {min: [slotX(9) - BAY_W / 2, 4.3], max: [slotX(10) + BAY_W / 2, 27.8], x: (slotX(9) + slotX(10)) / 2};
// The walkway keeps south of the ticket-booth queue stanchions at x 228.8.
export const WALKWAY = {min: [226, 1.9], max: [PROMENADE.max[0] + .4, 4.4], z: 4.05};
export const GATE_PATH = [[227.4, 4.05], [223.6, 1.1], [220.3, -1.8], [220, -6]];
export const GATE = [220, -6];
export const CROSSWALKS = [
  {id: 'A0', min: [PROMENADE.min[0], AISLES.A0.min[1]], max: [PROMENADE.max[0], AISLES.A0.max[1]]},
  {id: 'A1', min: [PROMENADE.min[0], AISLES.A1.min[1]], max: [PROMENADE.max[0], AISLES.A1.max[1]]},
];
// The Funfair approach road is also a 'park' footpath in the residents' walk
// graph: residents walk its centre line while lot cars keep to a lane 1.25 m
// off it. Turning in across that walk line is a crossing: lot cars give way to
// anyone near it and never stop on it. tests/vehicle-variety.test.mjs keeps
// this copy in step with the compiled town.
export const PARK_PATH = Object.freeze({width: 2, points: [[211.86, 14.03], [213.66, 12.96], [215.15, 11.88], [216.08, 11], [216.87, 10.06], [217.55, 9.07], [218.16, 8.05], [218.74, 7.02], [219.34, 6], [220, 5], [220, 0]]});
export const parkPathFootprints = (pad = 0) => PARK_PATH.points.slice(1).map((b, i) => { const a = PARK_PATH.points[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]); return {c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d: [(b[0] - a[0]) / L, (b[1] - a[1]) / L], hl: L / 2 + pad, hw: WALK_LINE + pad}; });
const WALK_LINE = .3; // a walker's half-width either side of the centre line
// Planter islands close each double row; slots 0 and 19.
export const PLANTERS = [];
for (const [z0, z1] of [[9, 16.2], [20.6, 27.8]]) for (const k of [0, 19]) PLANTERS.push({min: [slotX(k) - BAY_W / 2 + .12, z0 + .15], max: [slotX(k) + BAY_W / 2 - .12, z1 - .15], tree: [slotX(k), (z0 + z1) / 2]});
export const SOUTH_STRIP = {min: [LOT.minX, LOT.maxZ], max: [LOT.maxX, 34.4]};
export const TREES = [...PLANTERS.map((p) => p.tree), ...[229, 238, 254, 262].map((x) => [x, 33.4]), [221.6, 24], [221.6, 30]];
export const LAMPS = [
  ...PLANTERS.map((p) => [p.tree[0], p.tree[1] + (p.tree[1] < 15 ? -2.4 : 2.4)]),
  [PROMENADE.min[0] + .25, 10.4], [PROMENADE.max[0] - .25, 22.1],
  [231, 2.2], [239, 2.2], [254, 2.2], [262, 2.2],
  [234, 33.4], [246, 33.4], [258, 33.4],
];
export const BOOTH = {center: [221.8, 11.4], size: [1.5, 1.1]};
export const SIGN = {center: [220.3, 16.6], width: 5.2, yaw: Math.PI / 4, text: 'FUNFAIR PARKING'};
export const BAYS = [];
for (const row of ROWS) for (let k = 1; k < SLOTS - 1; k++) {
  if (k === 9 || k === 10) continue;
  const z = (row.z0 + row.z1) / 2;
  BAYS.push({id: `${row.id}-${String(k).padStart(2, '0')}`, row: row.id, slot: k, aisle: row.aisle, center: [slotX(k), z], yaw: row.nose > 0 ? 0 : Math.PI, length: BAY.depth, width: BAY_W, box: {min: [slotX(k) - BAY_W / 2, row.z0], max: [slotX(k) + BAY_W / 2, row.z1]}});
}
export const rectFootprint = (r, pad = 0) => ({c: [(r.min[0] + r.max[0]) / 2, (r.min[1] + r.max[1]) / 2], d: [0, 1], hl: (r.max[1] - r.min[1]) / 2 + pad, hw: (r.max[0] - r.min[0]) / 2 + pad});
export const carFootprint = (p, h, pad = 0) => ({c: p, d: h, hl: CAR.length / 2 + pad, hw: CAR.width / 2 + pad});
export const inRect = (p, r, pad = 0) => p[0] >= r.min[0] - pad && p[0] <= r.max[0] + pad && p[1] >= r.min[1] - pad && p[1] <= r.max[1] + pad;

// ---- The mountain road. Same curve as themepark.js; lanes 1.25 m off-centre
// (the shuttle convention: inbound on the +normal side, (t.z, -t.x)).
export const ROAD = new THREE.CatmullRomCurve3(APPROACH.map(([x, z]) => new THREE.Vector3(x, 0, z)));
export const ROAD_LENGTH = ROAD.getLength();
export const ROAD_LANE = 1.25;
export function roadPose(s) {
  const u = Math.min(1, Math.max(0, s / ROAD_LENGTH)), p = ROAD.getPointAt(u), t = ROAD.getTangentAt(u);
  return {p: [p.x, p.z], t: [t.x, t.z]};
}
export function lanePoint(s, inbound) {
  const {p, t} = roadPose(s), k = inbound ? ROAD_LANE : -ROAD_LANE;
  return {p: [p[0] + t[1] * k, p[1] - t[0] * k], t: inbound ? t : [-t[0], -t[1]]};
}
export const SPAWN_S = ROAD_LENGTH - 30, TURN_IN_S = ROAD_LENGTH - 8, TURN_OUT_S = ROAD_LENGTH - 9.5;
// The shuttle pair in themepark.js: 95 s round trips, half a cycle apart.
export function shuttlePose(i, t) {
  const u = ((t / 95 + i * .5) % 1 + 1) % 1, forward = u < .5, v = forward ? u * 2 : (1 - u) * 2, s = v * ROAD_LENGTH;
  const {p, t: tan} = roadPose(s), k = forward ? 1.25 : -1.25;
  return {s, forward, position: [p[0] + tan[1] * k, p[1] - tan[0] * k], direction: forward ? tan : [-tan[0], -tan[1]], length: 4.8, width: 2.1};
}
// Apron: the paved mouth joining the road end to aisle A0 (rendered as a hull).
export const APRON = {min: [211.5, 3.2], max: [LANES.W + 2.2, 14.5]};

// ---- Paths. A path is a list of samples {p, h (body heading), s}; reverse
// legs keep the body heading opposite to the direction of travel.
const STEP = .25;
function densify(points) {
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(len / STEP);
    if (len < 1e-6) continue;
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
/** Polyline with circular fillets of radius r at every corner. */
export function fillet(points, r = 2.4) {
  const out = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const u = norm([b[0] - a[0], b[1] - a[1]]), v = norm([c[0] - b[0], c[1] - b[1]]);
    const turn = Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    if (turn < 1e-3) { out.push(b); continue; }
    const rr = Math.min(r, Math.hypot(b[0] - a[0], b[1] - a[1]) * .5 / Math.tan(turn / 2), Math.hypot(c[0] - b[0], c[1] - b[1]) * .5 / Math.tan(turn / 2));
    const back = rr * Math.tan(turn / 2), p0 = [b[0] - u[0] * back, b[1] - u[1] * back];
    const side = Math.sign(u[0] * v[1] - u[1] * v[0]), center = [p0[0] - u[1] * rr * side, p0[1] + u[0] * rr * side];
    const a0 = Math.atan2(p0[1] - center[1], p0[0] - center[0]), n = Math.max(2, Math.ceil(rr * turn / STEP));
    for (let k = 0; k <= n; k++) { const ang = a0 + side * turn * k / n; out.push([center[0] + Math.cos(ang) * rr, center[1] + Math.sin(ang) * rr]); }
  }
  out.push(points.at(-1));
  return out;
}
function hermite(a, ta, b, tb, n = 40) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    out.push([h00 * a[0] + h10 * ta[0] * d + h01 * b[0] + h11 * tb[0] * d, h00 * a[1] + h10 * ta[1] * d + h01 * b[1] + h11 * tb[1] * d]);
  }
  return out;
}
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const roadRun = (s0, s1, inbound) => { const out = [], n = Math.max(1, Math.ceil(Math.abs(s1 - s0) / STEP)); for (let k = 0; k <= n; k++) out.push(lanePoint(s0 + (s1 - s0) * k / n, inbound).p); return out; };
/** Turn a list of legs [{points, reverse}] into one sampled path. */
export function makePath(legs) {
  const samples = []; let s = 0;
  for (const leg of legs) {
    const pts = densify(leg.points);
    for (let i = 0; i < pts.length; i++) {
      if (samples.length && i === 0) continue;
      const prev = samples.at(-1);
      if (prev) s += Math.hypot(pts[i][0] - prev.p[0], pts[i][1] - prev.p[1]);
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], move = Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-9 ? norm([b[0] - a[0], b[1] - a[1]]) : (prev ? (prev.reverse ? [-prev.h[0], -prev.h[1]] : prev.h) : [1, 0]);
      samples.push({p: pts[i], h: leg.reverse ? [-move[0], -move[1]] : move, s, reverse: !!leg.reverse});
    }
  }
  return {samples, length: s};
}
export function samplePath(path, s) {
  const list = path.samples; s = Math.max(0, Math.min(path.length, s));
  let lo = 0, hi = list.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (list[m].s <= s) lo = m; else hi = m; }
  const a = list[lo], b = list[hi], f = b.s > a.s ? (s - a.s) / (b.s - a.s) : 0;
  return {p: [a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f], h: norm([a.h[0] + (b.h[0] - a.h[0]) * f, a.h[1] + (b.h[1] - a.h[1]) * f]), reverse: a.reverse};
}

// Arrival into the lot as far as aisle A0's in-lane, and the way out from the
// west aisle back onto the road's outbound lane.
const ENTRY = [...roadRun(SPAWN_S, TURN_IN_S, true), ...hermite(lanePoint(TURN_IN_S, true).p, lanePoint(TURN_IN_S, true).t, [LANES.W + 1.2, LANES.A0in], [1, 0]).slice(1)];
const EXIT_TAIL = [...hermite([LANES.W - 1.5, LANES.A0out], [-1, 0], lanePoint(TURN_OUT_S, false).p, lanePoint(TURN_OUT_S, false).t).slice(0), ...roadRun(TURN_OUT_S, SPAWN_S, false).slice(1)];
const corner = (pts) => fillet(pts, 2.4);
// Through routes, as corner lists, from the end of the entry onward.
function inboundTo(row, x0) {
  if (row.aisle === 'A0') return [[LANES.W + 1.2, LANES.A0in], [x0, LANES.A0in]];
  const z = row.aisle === 'A1' ? LANES.A1 : LANES.A2;
  return [[LANES.W + 1.2, LANES.A0in], [LANES.E, LANES.A0in], [LANES.E, z], [x0, z]];
}
function outboundFrom(row, x0) {
  const exit = [[LANES.W, LANES.A1], [LANES.W, LANES.A0out + .2], [LANES.W - 1.5, LANES.A0out]];
  if (row.aisle === 'A0') return [[x0, LANES.A0in], [LANES.E, LANES.A0in], [LANES.E, LANES.A1], ...exit];
  const z = row.aisle === 'A1' ? LANES.A1 : LANES.A2;
  return [[x0, z], [LANES.W, z], ...exit.slice(z === LANES.A1 ? 1 : 0)];
}
// Static things a manoeuvring car must never touch.
export const STATIC_OBSTACLES = [
  ...PLANTERS.map((p) => p), {min: [PROMENADE.min[0] + .15, 9], max: [PROMENADE.max[0] - .15, 16.2]}, {min: [PROMENADE.min[0] + .15, 20.6], max: [PROMENADE.max[0] - .15, 27.8]},
  {min: [BOOTH.center[0] - BOOTH.size[0] / 2, BOOTH.center[1] - BOOTH.size[1] / 2], max: [BOOTH.center[0] + BOOTH.size[0] / 2, BOOTH.center[1] + BOOTH.size[1] / 2]},
  ...SEAMS.map((s) => ({min: [s.min[0], s.min[1] + .15], max: [s.max[0], s.max[1] - .15]})),
];
const parkedFootprint = (b, pad = 0) => carFootprint(b.center, [Math.sin(b.yaw), Math.cos(b.yaw)], pad);
/** The turn between a bay and its aisle: largest radius whose swept car clears
 * every neighbouring parked car, the island kerbs and the far row. */
function bayTurn(bay) {
  const row = ROWS.find((r) => r.id === bay.row), [xb, zc] = bay.center;
  const others = BAYS.filter((b) => b !== bay && Math.abs(b.center[0] - xb) < 7 && Math.abs(b.center[1] - zc) < 12).map((b) => parkedFootprint(b, .1));
  const walls = STATIC_OBSTACLES.filter((r) => r.max[0] > xb - 8 && r.min[0] < xb + 8).map((r) => rectFootprint(r, 0));
  for (let R = 4.6; R >= 1.5; R -= .1) {
    const z1 = row.lane + row.nose * R;
    if ((zc - z1) * row.nose < -1e-6) continue;
    const c = [xb - row.dir * R, row.lane + row.nose * R], arc = [];
    // Start pointing back along the aisle direction from the arc centre.
    const a0 = Math.atan2(row.lane - c[1], (xb - row.dir * R) - c[0]), a1 = Math.atan2(z1 - c[1], xb - c[0]);
    let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
    const n = Math.ceil(R * Math.abs(da) / STEP);
    for (let k = 0; k <= n; k++) { const a = a0 + da * k / n; arc.push([c[0] + Math.cos(a) * R, c[1] + Math.sin(a) * R]); }
    const legs = [{points: [...arc, [xb, zc]]}], path = makePath(legs);
    const ok = path.samples.every((q) => { const f = carFootprint(q.p, q.h, .08); return !others.some((o) => footprintsOverlap(f, o)) && !walls.some((w) => footprintsOverlap(f, w)) && inRect(q.p, LOT, -.2); });
    if (ok) return {R, start: arc[0], arc};
  }
  throw Error(`No clear turn into bay ${bay.id}`);
}
for (const bay of BAYS) {
  const row = ROWS.find((r) => r.id === bay.row), turn = bayTurn(bay);
  bay.turn = turn.R;
  // Aisle stretch a manoeuvre needs to itself: from behind the turn start to just past the bay.
  const a = AISLES[row.aisle], x0 = bay.center[0] - row.dir * (turn.R + CAR.length / 2 + 1.6), x1 = bay.center[0] + row.dir * (BAY_W / 2 + .9);
  bay.mouth = {min: [Math.min(x0, x1), Math.min(a.min[1], bay.box.min[1])], max: [Math.max(x0, x1), Math.max(a.max[1], bay.box.max[1])]};
  if (row.aisle === 'A0') bay.mouth = {min: [bay.mouth.min[0], LANES.A0in - 1.1], max: [bay.mouth.max[0], bay.box.max[1]]};
  const arrive = [...ENTRY, ...corner(inboundTo(row, turn.start[0])).slice(1), ...turn.arc.slice(1), bay.center];
  bay.arrival = makePath([{points: arrive}]);
  const outFwd = [...corner(outboundFrom(row, turn.start[0])), ...EXIT_TAIL.slice(1)];
  bay.departure = makePath([{points: [bay.center, ...[...turn.arc].reverse()], reverse: true}, {points: outFwd}]);
  bay.walk = walkerPath(bay);
}
/** From the car door, along the seam and promenade, over the crosswalks to the gate. */
export function walkerPath(bay) {
  const row = ROWS.find((r) => r.id === bay.row), seam = SEAMS.find((s) => s.z > row.z0 - 1.3 && s.z < row.z1 + 1.3);
  const side = bay.center[0] < PROMENADE.x ? 1 : -1, door = [bay.center[0] + side * BAY_W / 2, bay.center[1]];
  return [door, [door[0], seam.z], [PROMENADE.x, seam.z], [PROMENADE.x, WALKWAY.z], ...GATE_PATH];
}
export const ROUTE_REGIONS = {
  apron: APRON,
  merge: {min: [AISLES.W.min[0], LANES.A1 - 2.6], max: [AISLES.W.max[0] + .4, LANES.A1 + 2.6]},
};
export const LOT_SUMMARY = {bays: BAYS.length, rows: ROWS.length, lamps: LAMPS.length, trees: TREES.length};
