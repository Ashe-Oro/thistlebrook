// OWNER: vehicle-variety lane. Pure watercraft plan (no THREE, no DOM) for
// Saltwind Harbor, Coral Coast and the harbor-to-coast passenger cruiser.
// TOWN-11: boats stay in the water or at a documented berth or beach rack;
// hulls never sit on roads, quays, sand (except a documented rack) or clip
// docks, pilings or seawalls. watercraftFindings() is the automated check,
// run by the road audit, sim:collisions and tests/vehicle-variety.test.mjs.
import {insideLandscape} from '../compiler/landscape.js';
import {shoreX} from './coast-plan.js';

export const HARBOR_OFFSET = [100, 0];
export const COAST_OFFSET = [160, 150];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const toWorld = (p, o) => [p[0] + o[0], p[1] + o[1]];
export function pointInPolygon([x, z], poly) { let inside = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }

/** Owned pack watercraft (measured bounds, +Z forward, hull bottom near y=0). */
export const WATERCRAFT = Object.freeze({
  speedboat: {name: 'Cigarette speedboat', path: 'licensed/vice-beach/cigarette_speedboat.glb', min: [-.88, .01, -3.25], max: [.88, 2.09, 3.4], scale: .7},
  airboat: {name: 'Airboat', path: 'licensed/vice-beach/airboat.glb', min: [-.99, .04, -1.65], max: [.99, 2.49, 1.9], scale: .85},
  yacht: {name: 'Motor yacht (Saltwind coastal ferry)', path: 'licensed/vice-beach/motor_yacht_vessel.glb', min: [-1.65, -.03, -5.17], max: [1.65, 5.08, 5.1], scale: .62},
  floatplane: {name: 'Moored floatplane', path: 'licensed/vice-beach/moored_floatplane.glb', min: [-3.36, .02, -3.21], max: [3.36, 3.75, 3.52], scale: .55},
  rowboat: {name: 'Rowboat', path: 'licensed/nature/rowboat.glb', min: [-1.39, 0, -1.54], max: [1.39, .86, 1.5], scale: 1.1},
  kayak: {name: 'Kayak', path: 'licensed/nature/kayak.glb', min: [-1.3, 0, -1.61], max: [1.3, .4, 1.61], scale: .95},
  canoe: {name: 'Canoe', path: 'licensed/nature/canoe.glb', min: [-.45, 0, -1.66], max: [.45, .58, 1.66], scale: .95},
  cutter: {name: 'Fishing cutter (procedural)', min: [-1.65, 0, -3], max: [1.65, 2, 3.6], scale: 1},
});
// Hull footprint: the rowboat and kayak bounds include their oars/paddle, so
// the hull is narrower than the box.
const HULL_WIDTH = {rowboat: 1.25, kayak: .75};
export function hullSize(model) {
  const m = WATERCRAFT[model];
  return {length: (m.max[2] - m.min[2]) * m.scale, width: (HULL_WIDTH[model] ?? m.max[0] - m.min[0]) * m.scale};
}
export function boatFootprint(model, pos, yaw) {
  const {length, width} = hullSize(model), m = WATERCRAFT[model], d = [Math.sin(yaw), Math.cos(yaw)];
  // Centre of the measured hull box (some origins sit off-centre).
  const off = (m.min[2] + m.max[2]) / 2 * m.scale;
  return {c: [pos[0] + d[0] * off, pos[1] + d[1] * off], d, hl: length / 2, hw: width / 2};
}
function footprintSamples(f, pad = 0) {
  const n = [-f.d[1], f.d[0]], out = [];
  for (let a = -1; a <= 1; a += .25) for (const b of [-1, 0, 1]) out.push([f.c[0] + f.d[0] * a * (f.hl + pad) + n[0] * b * (f.hw + pad), f.c[1] + f.d[1] * a * (f.hl + pad) + n[1] * b * (f.hw + pad)]);
  return out;
}

// --- Saltwind Harbor (harbor-local coordinates, see harbor.js) -------------
export const HARBOR_LAND = Object.freeze({
  shore: [[22, 34], [65, 34], [65, 28], [87, 28], [95, 38], [95, 52], [88, 57], [69, 53], [54, 52], [44, 59], [28, 62], [21, 55], [21, 42]],
  sand: [[23, 44], [46, 44], [50, 49], [47, 55], [42, 59], [29, 62], [22, 56]],
});
/** Decks, quay wall, pilings, breakwater and lighthouse: rects {min,max} or circles {c,r}. */
export const HARBOR_STRUCTURES = Object.freeze([
  {id: 'quay-promenade', min: [25, 40.9], max: [93, 45.1]},
  {id: 'quay-wall', min: [52, 50.4], max: [89, 51.6]},
  {id: 'gullwatch-pier', min: [68, 43], max: [72, 71]},
  {id: 'gullwatch-t-head', min: [68.9, 57.75], max: [76.9, 60.25]},
  {id: 'gullwatch-pier-end', min: [62.8, 67.65], max: [72, 70.35]},
  {id: 'lighthouse', c: [91, 51], r: 3.1},
  ...Array.from({length: 11}, (_, n) => ({id: `breakwater-${n}`, c: [91 - n * .28, 52 + n * 1.8], r: 1.56})),
  {id: 'channel-marker-east', c: [84, 76], r: .5}, {id: 'channel-marker-west', c: [58, 77], r: .5},
]);
// Shell Cove's roped swimming area (the buoy line in harbor.js).
export const HARBOR_SWIM = Object.freeze([[21, 55], [28, 62], [44, 59], [46, 66], [44, 69.6], [24, 69.6], [20, 64]]);
/** Documented beach rack: Shell Cove sand beside the beach huts, off the walk. */
export const BEACH_RACKS = Object.freeze([{id: 'shell-cove-rack', region: 'harbor', min: [42.8, 49.2], max: [48.8, 53.6]}]);

// --- Coral Coast (coast-local coordinates, see coast.js) -------------------
export const COAST_SWIM_MARGIN = 10.5; // swimmers and the buoy line sit inside shoreX + 10
export const coastWaterFrom = (z) => shoreX(z) + COAST_SWIM_MARGIN;

// Docked boats: Gullwatch pier berths (pier at x 68–72), a buoy mooring off
// Shell Cove and a floatplane basin east of the breakwater. A 0.3 m gap keeps
// every hull off decks and pilings.
export const DOCKED = Object.freeze([
  {id: 'pier-east-speedboat', region: 'harbor', model: 'speedboat', pos: [73.3, 65.6], yaw: 0, berth: 'Gullwatch pier, east side'},
  {id: 'pier-west-airboat', region: 'harbor', model: 'airboat', pos: [65.8, 64.2], yaw: Math.PI, berth: 'Gullwatch pier, west side'},
  {id: 't-head-canoe', region: 'harbor', model: 'canoe', pos: [74.8, 56.95], yaw: Math.PI / 2, berth: 'Gullwatch T-head, north face'},
  {id: 'cove-rowboat', region: 'harbor', model: 'rowboat', pos: [49, 59], yaw: .5, registered: true, berth: 'Shell Cove mooring buoy'},
  {id: 'basin-floatplane', region: 'harbor', model: 'floatplane', pos: [99, 82], yaw: -.6, berth: 'Floatplane basin'},
]);
export const RACKED = Object.freeze([
  {id: 'cove-rack-rowboat', region: 'harbor', model: 'rowboat', pos: [45, 51], yaw: -.7, registered: true, rack: 'shell-cove-rack'},
  {id: 'cove-rack-kayak', region: 'harbor', model: 'kayak', pos: [47.1, 51.6], yaw: -.7, rack: 'shell-cove-rack', night: true},
]);
/** The procedural fishing cutters keep their own slips (harbor.js) at night. */
export const CUTTER_SLIPS = Object.freeze([{id: 'cutter-marigold', model: 'cutter', region: 'harbor', pos: [77, 66], yaw: 0}, {id: 'cutter-wren', model: 'cutter', region: 'harbor', pos: [63, 58], yaw: 0}]);

// Moving craft on reserved water loops (closed polylines), speeds in m per
// real second; a game hour is 90 s. Outside their hours they sit at `home`.
export const MOVING = Object.freeze([
  {id: 'harbor-speedboat', region: 'harbor', model: 'speedboat', hours: [7, 19.5], speed: 2.4, loop: [[93.5, 90], [100.5, 97], [99.5, 117], [93, 122], [90.6, 104]], home: {pos: [64.9, 71.75], yaw: Math.PI / 2, berth: 'Gullwatch pier end, south face'}},
  {id: 'cove-kayak', region: 'harbor', model: 'kayak', hours: [8, 18], speed: .7, loop: [[30, 73], [44, 73.5], [50, 78], [38, 81], [27, 78]], home: {rack: 'cove-rack-kayak'}},
  {id: 'coast-speedboat', region: 'coast', model: 'speedboat', hours: [8, 19], speed: 2.6, loop: [[151.5, -104], [157.5, -96], [157.5, -82], [151.5, -76], [150.6, -90]]},
  {id: 'coast-kayak-1', region: 'coast', model: 'kayak', hours: [8, 18], speed: .6, loop: [[150, -52], [152.5, -32], [150, -22], [149.6, -40]]},
  {id: 'coast-kayak-2', region: 'coast', model: 'kayak', hours: [9, 17], speed: .55, loop: [[151.5, -46], [153.8, -27], [152, -18], [151.2, -35]]},
  {id: 'coast-canoe', region: 'coast', model: 'canoe', hours: [8, 18], speed: .6, loop: [[150.5, -12], [152.5, -1], [150.5, 5], [149.8, -6]]},
]);

// The passenger cruiser: a Vice Beach motor yacht stands in for the ferry (the
// City: Paris Bateau Mouche download was not available to this lane). World
// coordinates. It ties up overnight at Gullwatch T-head and runs three return
// trips to the Coral Coast anchorage between 07:00 and 15:30.
export const CRUISER = Object.freeze({
  model: 'yacht', name: 'Saltwind coastal ferry',
  harborBerth: {pos: toWorld([75.7, 61.6], HARBOR_OFFSET), yaw: Math.PI / 2, name: 'Gullwatch T-head ferry berth'},
  coastBerth: {pos: [319, 84], yaw: Math.PI, name: 'Coral Coast anchorage'},
  route: [toWorld([75.7, 61.6], HARBOR_OFFSET), toWorld([82.5, 61.6], HARBOR_OFFSET), [185, 72], [185.5, 95], [187, 133], [207, 187], [270, 190], [315, 164], [322, 127], [319, 84]],
  // [depart harbor, arrive coast, depart coast, arrive harbor]
  trips: [[7, 8, 8.5, 9.5], [10, 11, 11.5, 12.5], [13, 14, 14.5, 15.5]],
});

function polyline(points, closed) {
  const pts = closed ? [...points, points[0]] : points, cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist(pts[i - 1], pts[i]));
  return {pts, cum, length: cum.at(-1)};
}
function sample(line, d) {
  d = Math.max(0, Math.min(line.length, d)); let i = 1; while (i < line.cum.length - 1 && line.cum[i] < d) i++;
  const span = line.cum[i] - line.cum[i - 1] || 1, t = (d - line.cum[i - 1]) / span, a = line.pts[i - 1], b = line.pts[i];
  return {pos: lerp(a, b, t), yaw: Math.atan2(b[0] - a[0], b[1] - a[1])};
}
const inHours = (h, [a, b]) => h >= a && h < b;
/** Where a moving craft is at a game hour (region-local coordinates). */
export function movingPose(craft, hour) {
  if (!inHours(hour, craft.hours)) {
    if (craft.home?.rack) { const r = RACKED.find((b) => b.id === craft.home.rack); return {pos: r.pos, yaw: r.yaw, state: 'rack', visible: true}; }
    if (craft.home) return {pos: craft.home.pos, yaw: craft.home.yaw, state: 'berth', visible: true};
    return {pos: craft.loop[0], yaw: 0, state: 'ashore', visible: false};
  }
  const line = polyline(craft.loop, true), d = ((hour - craft.hours[0]) * 90 * craft.speed) % line.length;
  return {...sample(line, d), state: 'underway', visible: true};
}
/** Cruiser pose in world coordinates. */
export function cruiserPose(hour) {
  const line = polyline(CRUISER.route, false);
  for (const [d0, a1, d1, a0] of CRUISER.trips) {
    if (hour >= d0 && hour < a1) return {...sample(line, (hour - d0) / (a1 - d0) * line.length), state: 'underway', leg: 'out'};
    if (hour >= a1 && hour < d1) return {pos: CRUISER.coastBerth.pos, yaw: CRUISER.coastBerth.yaw, state: 'berth', berth: CRUISER.coastBerth.name};
    if (hour >= d1 && hour < a0) { const s = sample(line, (1 - (hour - d1) / (a0 - d1)) * line.length); return {pos: s.pos, yaw: s.yaw + Math.PI, state: 'underway', leg: 'back'}; }
  }
  return {pos: CRUISER.harborBerth.pos, yaw: CRUISER.harborBerth.yaw, state: 'berth', berth: CRUISER.harborBerth.name};
}
/** Rack/kayak visibility: the cove kayak sits on its rack only while ashore. */
export function rackedVisible(item, hour) { return !item.night || !inHours(hour, MOVING.find((m) => m.home?.rack === item.id).hours); }

/** All hulls at an hour, in world coordinates, with their region. */
export function watercraftAt(hour) {
  const out = [];
  const add = (id, model, region, pos, yaw, extra = {}) => { const o = region === 'harbor' ? HARBOR_OFFSET : region === 'coast' ? COAST_OFFSET : [0, 0]; out.push({id, model, region, local: pos, world: toWorld(pos, o), yaw, ...extra}); };
  for (const b of DOCKED) add(b.id, b.model, b.region, b.pos, b.yaw, {state: 'berth'});
  for (const b of RACKED) if (rackedVisible(b, hour)) add(b.id, b.model, b.region, b.pos, b.yaw, {state: 'rack', rack: b.rack});
  for (const c of MOVING) { const p = movingPose(c, hour); if (p.visible && p.state !== 'rack') add(c.id, c.model, c.region, p.pos, p.yaw, {state: p.state}); }
  const nightCutters = hour < 5 || hour >= 19;
  if (nightCutters) for (const c of CUTTER_SLIPS) add(c.id, c.model, c.region, c.pos, c.yaw, {state: 'berth'});
  const f = cruiserPose(hour); add('cruiser', CRUISER.model, 'world', f.pos, f.yaw, {state: f.state, berth: f.berth});
  return out;
}

const inRect = (p, r, pad = 0) => p[0] > r.min[0] - pad && p[0] < r.max[0] + pad && p[1] > r.min[1] - pad && p[1] < r.max[1] + pad;
/** TOWN-11 problems for one hull (empty = legal). `roads` are world road
 * segments {a,b,width}; `extraStructures` lets tests inject faults. */
export function hullProblems(boat, {roads = [], extraStructures = []} = {}) {
  const out = [], harborLocal = (p) => [p[0] - HARBOR_OFFSET[0], p[1] - HARBOR_OFFSET[1]], coastLocal = (p) => [p[0] - COAST_OFFSET[0], p[1] - COAST_OFFSET[1]];
  const f = boatFootprint(boat.model, boat.world, boat.yaw);
  const rack = boat.rack && BEACH_RACKS.find((r) => r.id === boat.rack);
  const samples = footprintSamples(f), padded = footprintSamples(f, .3);
  for (const p of samples) {
    const h = harborLocal(p), c = coastLocal(p);
    if (rack) { if (!inRect(h, rack)) out.push('outside its documented rack'); continue; }
    if (insideLandscape(p) || pointInPolygon(h, HARBOR_LAND.shore) || pointInPolygon(h, HARBOR_LAND.sand)) out.push('on land, sand or quay');
    if (c[1] > -112 && c[1] < 9 && c[0] > 60 && c[0] < shoreX(c[1]) + 1) out.push('on the Coral Coast beach');
    if (pointInPolygon(h, HARBOR_SWIM)) out.push('in the Shell Cove swimming area');
    if (c[1] > -106 && c[1] < 7 && c[0] < coastWaterFrom(c[1]) && c[0] > shoreX(c[1]) - 5) out.push('inside the Coral Coast swim line');
  }
  for (const p of padded) {
    const h = harborLocal(p);
    for (const s of [...HARBOR_STRUCTURES, ...extraStructures]) if (s.c ? dist(h, s.c) < s.r : inRect(h, s)) { out.push(`clips ${s.id}`); break; }
    for (const r of roads) { const dx = r.b[0] - r.a[0], dz = r.b[1] - r.a[1], t = Math.max(0, Math.min(1, ((p[0] - r.a[0]) * dx + (p[1] - r.a[1]) * dz) / (dx * dx + dz * dz || 1))); if (Math.hypot(p[0] - r.a[0] - t * dx, p[1] - r.a[1] - t * dz) < r.width / 2) { out.push('on a road or walk'); break; } }
  }
  return [...new Set(out)];
}
const overlap = (a, b, pad) => { const dot = (u, v) => u[0] * v[0] + u[1] * v[1], t = [b.c[0] - a.c[0], b.c[1] - a.c[1]]; for (const ax of [a.d, [-a.d[1], a.d[0]], b.d, [-b.d[1], b.d[0]]]) { const ra = Math.abs(dot(a.d, ax)) * a.hl + Math.abs(dot([-a.d[1], a.d[0]], ax)) * a.hw, rb = Math.abs(dot(b.d, ax)) * b.hl + Math.abs(dot([-b.d[1], b.d[0]], ax)) * b.hw; if (Math.abs(dot(t, ax)) > ra + rb + pad) return false; } return true; };
export const SAMPLE_HOURS = Array.from({length: 96}, (_, i) => i / 4);
/** TOWN-11 findings over a day: every hull at every sampled quarter hour, plus
 * hull-to-hull clashes. `boats(hour)` can be swapped in by tests. */
export function watercraftFindings({roads = [], hours = SAMPLE_HOURS, boats = watercraftAt, extraStructures = []} = {}) {
  const out = [], seen = new Set();
  for (const hour of hours) {
    const list = boats(hour);
    for (const b of list) for (const why of hullProblems(b, {roads, extraStructures})) { const key = b.id + why; if (seen.has(key)) continue; seen.add(key); out.push({rule: 'TOWN-11', category: 'boat-placement', at: b.world.map((v) => +v.toFixed(1)), detail: `${b.id} (${WATERCRAFT[b.model].name}) ${why} at ${hour.toFixed(2)}h`}); }
    const fps = list.map((b) => boatFootprint(b.model, b.world, b.yaw));
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (dist(fps[i].c, fps[j].c) < 14 && overlap(fps[i], fps[j], .2)) { const key = list[i].id + list[j].id; if (seen.has(key)) continue; seen.add(key); out.push({rule: 'TOWN-11', category: 'boat-clash', at: list[i].world.map((v) => +v.toFixed(1)), detail: `${list[i].id} and ${list[j].id} overlap at ${hour.toFixed(2)}h`}); }
  }
  return out;
}
/** Water surface height at a world point: the open sea is at -0.45, but the
 * Coral Coast draws shallow turquoise bands up to 28 m off the shore at about
 * -0.07 (coast.js ribbons), and a hull there has to float on them. */
export const SEA_LEVEL = -.45, COAST_SHALLOWS = -.07;
export function waterlineAt(world) {
  const c = [world[0] - COAST_OFFSET[0], world[1] - COAST_OFFSET[1]];
  if (!(c[1] > -111 && c[1] < 9 && c[0] > 60)) return SEA_LEVEL;
  // Ease across the band edges (26-30 m out, and its two ends) so a hull crossing them never jumps.
  const clamp = (v) => Math.max(0, Math.min(1, v)), k = Math.max(clamp((c[0] - shoreX(c[1]) - 26) / 4), clamp((c[1] - 5) / 4), clamp((-107 - c[1]) / 4));
  return COAST_SHALLOWS + (SEA_LEVEL - COAST_SHALLOWS) * k;
}
/** Road and walk segments in world coordinates that boats must keep off. */
export function boatKeepOut(town) { return town.roads.filter((r) => r.kind !== 'water').map((r) => ({a: r.a, b: r.b, width: r.width})); }
