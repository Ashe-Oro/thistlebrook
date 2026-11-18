// OWNER: vehicle-variety lane. Pure street dressing plan (no THREE, no DOM):
// street classes, kerbside furniture, bus shelters and the cycle strips.
// Everything here is validated by streetFindings(), which the road audit and
// tests/vehicle-variety.test.mjs both run (TOWN-01/02/04 for furniture).
import {pedestrianGraph, segDistance} from '../roads/pedestrian.js';
import {motorRoads, PARKING_BAYS, CYCLE_STRIPS, TRAFFIC_STOPS, WEST_STOPS} from './traffic-simulation.js';

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unit = (a, b) => { const d = dist(a, b); return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
function inOutline([x, z], outline) { let inside = false; for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) { const a = outline[i], b = outline[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside; } return inside; }

/** Street furniture models per street class. Downtown uses the City pack,
 * ordinary streets keep the owned Cozy lamp, residential lanes the Suburban
 * lamp and shade tree, so the three classes read differently from a still. */
export const FURNITURE_MODELS = Object.freeze({
  'city-lamp': {path: 'licensed/city/street_lamp_01.glb', scale: .82, r: .3, min: [-.28, 0, -.27], max: [1.51, 4.1, .44]},
  'city-bench': {path: 'licensed/city/bench_01.glb', scale: .85, r: .5, min: [-.78, 0, -.4], max: [.78, .93, .39]},
  'city-bike-rack': {path: 'licensed/city/bike_rack_01.glb', scale: .8, r: .55, min: [-.86, -.01, -.49], max: [.89, 1.02, .37]},
  'city-tree': {path: 'licensed/city/street_tree_01.glb', scale: .95, r: .35, min: [-1.04, 0, -1.02], max: [1.2, 3.59, .96]},
  'city-bin': {path: 'licensed/city/trash_bin_01.glb', scale: .8, r: .3, min: [-.37, 0, -.39], max: [.48, .9, .35]},
  'city-shelter': {path: 'licensed/city/bus_shelter_01.glb', scale: .62, r: 1.6, min: [-2.2, -.01, -.81], max: [2.71, 3.34, 1.1]},
  'city-sign': {path: 'licensed/city/street_sign_01.glb', scale: .7, r: .3, min: [-.33, 0, -.19], max: [1.31, 3.24, .94]},
  'cozy-lamp': {catalog: 'cv-streetlamp', scale: .9, r: .3},
  'sub-lamp': {path: 'licensed/suburban-neighborhood/streetlamp.glb', scale: .8, r: .25, min: [-.16, 0, -.16], max: [.89, 4.55, .16]},
  'sub-tree': {path: 'licensed/suburban-neighborhood/shade_tree.glb', scale: .62, r: .45},
  'sub-stop-sign': {path: 'licensed/suburban-neighborhood/street_stop_sign.glb', scale: .7, r: .3, min: [-.55, 0, -.55], max: [.55, 2.7, .55]},
});

/** Which loop segments the buses use (residential lanes never carry a bus). */
export function busSegments(sim) {
  const out = [];
  for (const v of sim.vehicles) if (v.kind === 'bus') { const p = v.path.points; for (let i = 0; i < p.length; i++) out.push([p[i], p[(i + 1) % p.length]]); }
  return out;
}
// Downtown's avenue grid (High Street, Town Hall Row and the cross streets).
export const DOWNTOWN = Object.freeze({minX: -80, maxX: -31, minZ: -20, maxZ: 6});
const inDowntown = (p) => p[0] >= DOWNTOWN.minX && p[0] <= DOWNTOWN.maxX && p[1] >= DOWNTOWN.minZ && p[1] <= DOWNTOWN.maxZ;
export function streetClass(road, busPoints, town = null) {
  if (road.kind === 'avenue' && road.width >= 4.2) return 'boulevard';
  if (road.kind === 'avenue' && inDowntown(road.a) && inDowntown(road.b)) return 'avenue';
  const L = dist(road.a, road.b), N = Math.max(2, Math.ceil(L / 2)), samples = Array.from({length: N - 1}, (_, k) => [road.a[0] + (road.b[0] - road.a[0]) * (k + 1) / N, road.a[1] + (road.b[1] - road.a[1]) * (k + 1) / N]);
  const onBus = samples.some((p) => busPoints.some(([a, b]) => segDistance(p, a, b) < road.width / 2));
  const mid = [(road.a[0] + road.b[0]) / 2, (road.a[1] + road.b[1]) / 2];
  const home = town?.districts?.reduce((best, d) => (!best || dist(d.center, mid) < dist(best.center, mid) ? d : best), null);
  if (!onBus && (road.width < 3 || home?.type === 'neighbourhood')) return 'residential';
  return 'town';
}
export const CLASS_STYLE = Object.freeze({
  boulevard: {asphalt: '#6a7671', edge: '#ece6cf', centre: 'double', dash: null, lamp: 'city-lamp', tree: 'city-tree', every: 9, extras: ['city-bench', 'city-bike-rack', 'city-bin']},
  avenue: {asphalt: '#6f7c77', edge: '#ece6cf', centre: 'dash', dash: '#f1ead2', lamp: 'city-lamp', tree: 'city-tree', every: 7, extras: ['city-bench', 'city-bike-rack', 'city-bin', 'city-bench']},
  town: {asphalt: '#77867e', edge: null, centre: 'dash', dash: '#e1d6b3', lamp: 'cozy-lamp', tree: 'city-tree', every: 10, extras: ['city-bench'], extraEvery: 4, treeEvery: 10},
  residential: {asphalt: '#8a948b', edge: null, centre: null, dash: null, lamp: 'sub-lamp', tree: 'sub-tree', every: 8, extras: [], treeEvery: 4},
});

function context(town, sim) {
  const graph = pedestrianGraph(town), index = graph.index;
  const walk = []; graph.edges.forEach((list, u) => { for (const e of list) if (e.to > u) walk.push({a: graph.nodes[u].pos, b: graph.nodes[e.to].pos, crossing: !!e.crossing}); });
  // The Founders Fountain plaza is open paving: a shelter may stand on its rim.
  const boxes = [...town.buildings, ...town.venues].filter((b) => b.box).map((b) => ({...b.box, open: b.type === 'fountain'}));
  const props = [...town.props.map((p) => ({pos: p.pos, r: .35})), ...town.trees.map((p) => ({pos: p.pos, r: .6})), ...[...(town.modelPlacements || []), ...(town.districtFurniture || [])].map((p) => ({pos: p.pos, r: Math.max(p.size?.[0] || .6, p.size?.[2] || .6) / 2}))].filter((p) => p.pos);
  // Home garden beds and fences/supplemental props (a tree canopy must not overhang a bed either).
  const gardens = (town.gardens || []).map((g) => ({min: [g.x - g.width / 2, g.z - g.depth / 2], max: [g.x + g.width / 2, g.z + g.depth / 2]}));
  props.push(...(town.supplemental || []).filter((p) => p.pos).map((p) => ({pos: p.pos, r: .4})));
  const junctions = sim.junctions.flatMap((j) => j.points);
  const posts = [...TRAFFIC_STOPS, ...WEST_STOPS].map((s) => { const hw = Math.max(1.5, ...motorRoads(town).filter((r) => segDistance(s.point, r.a, r.b) < .05).map((r) => r.width / 2)); return [s.point[0] + s.side[0] * (hw + .22), s.point[1] + s.side[1] * (hw + .22)]; });
  return {graph, index, walk, boxes, gardens, props, junctions, posts};
}
function footprintCircles(item) {
  // Long items (benches, shelters, racks) are checked as a row of circles.
  const m = FURNITURE_MODELS[item.model], len = item.length || 0, d = [Math.sin(item.yaw + Math.PI / 2), Math.cos(item.yaw + Math.PI / 2)];
  if (!len) return [{c: item.pos, r: m.r}];
  const n = Math.max(2, Math.ceil(len / .6)), r = item.depth / 2;
  return Array.from({length: n + 1}, (_, k) => ({c: [item.pos[0] + d[0] * (k / n - .5) * len, item.pos[1] + d[1] * (k / n - .5) * len], r}));
}
/** Every reason an item may not stand where it is (empty = legal). */
export function furnitureProblems(item, ctx, town, others = []) {
  const out = [];
  for (const {c, r} of footprintCircles(item)) {
    if (ctx.index.depth(c) > -r - .05) out.push('carriageway');
    if (ctx.walk.some((e) => segDistance(c, e.a, e.b) < r + (e.crossing ? .9 : .3))) out.push(item.model === 'city-shelter' ? 'walk' : 'walk');
    if (ctx.junctions.some((p) => dist(p, c) < 3.2 + r)) out.push('junction');
    if (ctx.boxes.some((b) => !(b.open && item.kind === 'shelter' && Math.min(c[0] - b.min[0], b.max[0] - c[0], c[1] - b.min[1], b.max[1] - c[1]) < 2) && c[0] > b.min[0] - r && c[0] < b.max[0] + r && c[1] > b.min[1] - r && c[1] < b.max[1] + r)) out.push('building');
    if (ctx.props.some((p) => dist(p.pos, c) < p.r + r + .15)) out.push('prop');
    { const pad = r + (item.kind === 'tree' ? 1.2 : .25); if (ctx.gardens.some((g) => c[0] > g.min[0] - pad && c[0] < g.max[0] + pad && c[1] > g.min[1] - pad && c[1] < g.max[1] + pad)) out.push('garden'); }
    if (PARKING_BAYS.some((b) => dist(b.center, c) < 1.6 + r)) out.push('parking');
    if (ctx.posts.some((p) => dist(p, c) < r + .4)) out.push('stop-post');
    if (!inOutline(c, town.outline)) out.push('off-slab');
    if (others.some((o) => o !== item && footprintCircles(o).some((q) => dist(q.c, c) < q.r + r + .2))) out.push('crowded');
  }
  return [...new Set(out)];
}

/** Street classes, furniture and shelters for the seeded town. Candidates
 * that fail any check are dropped; the survivors are re-validated in tests. */
export function planStreets(town, sim) {
  const ctx = context(town, sim), busPoints = busSegments(sim), roads = motorRoads(town);
  const streets = roads.map((r, i) => ({id: `street-${i}`, a: r.a, b: r.b, width: r.width, kind: r.kind, cls: streetClass(r, busPoints, town)}));
  const items = [];
  const tryAdd = (item) => { if (!furnitureProblems(item, ctx, town, items).length) { items.push(item); return true; } return false; };
  // Bus shelters first: behind the gold post at every stop where the kerb has room.
  for (const s of [...TRAFFIC_STOPS, ...WEST_STOPS]) {
    const hw = Math.max(1.5, ...roads.filter((r) => segDistance(s.point, r.a, r.b) < .05).map((r) => r.width / 2)), m = FURNITURE_MODELS['city-shelter'];
    const len = (m.max[0] - m.min[0]) * m.scale, depth = (m.max[2] - m.min[2]) * m.scale, along = [s.side[1], -s.side[0]];
    let placed = false;
    for (const off of [hw + 1.15 + depth / 2, hw + 1.45 + depth / 2]) {
      for (const slide of [0, 1.6, -1.6, 3.2, -3.2]) {
        const pos = [s.point[0] + s.side[0] * off + along[0] * slide, s.point[1] + s.side[1] * off + along[1] * slide];
        // The open front (+Z) faces the carriageway.
        if (tryAdd({kind: 'shelter', model: 'city-shelter', stop: s.id, pos, yaw: Math.atan2(-s.side[0], -s.side[1]), length: len, depth})) { placed = true; break; }
      }
      if (placed) break;
    }
  }
  const along = (st, d, off, side) => { const u = unit(st.a, st.b), n = [-u[1], u[0]]; return {pos: [st.a[0] + u[0] * d + n[0] * off * side, st.a[1] + u[1] * d + n[1] * off * side], face: Math.atan2(-n[0] * side, -n[1] * side)}; };
  const offsets = (hw) => [hw + 1.4, hw + 1.25, hw + 1.6];
  // Pass 1: lamps at the class spacing. Pass 2: benches, racks and bins in
  // between. Pass 3: street trees in whatever kerb is left.
  for (const st of streets) {
    const style = CLASS_STYLE[st.cls], L = dist(st.a, st.b), hw = st.width / 2;
    for (const side of [1, -1]) for (let d = 2.5; d < L - 2.5; d += style.every) for (const off of offsets(hw)) { const {pos, face} = along(st, d, off, side); if (tryAdd({kind: 'lamp', model: style.lamp, street: st.id, cls: st.cls, pos, yaw: face - Math.PI / 2})) break; }
  }
  for (const st of streets) {
    const style = CLASS_STYLE[st.cls], L = dist(st.a, st.b), hw = st.width / 2;
    if (!style.extras.length) continue;
    let extra = 0;
    for (const side of [1, -1]) for (let d = 2.5 + style.every / 2; d < L - 2.5; d += style.every * (style.extraEvery || 1)) {
      const model = style.extras[extra % style.extras.length], m = FURNITURE_MODELS[model];
      const len = model === 'city-bin' ? 0 : (m.max[0] - m.min[0]) * m.scale, depth = (m.max[2] - m.min[2]) * m.scale;
      done: for (const slide of [0, .9, -.9]) for (const off of offsets(hw)) { const {pos, face} = along(st, d + slide, off, side); if (tryAdd({kind: model.replace('city-', ''), model, street: st.id, cls: st.cls, pos, yaw: face, length: len, depth})) { extra++; break done; } }
    }
  }
  for (const st of streets) {
    const style = CLASS_STYLE[st.cls], L = dist(st.a, st.b), hw = st.width / 2;
    const step = style.treeEvery || style.every / 2;
    for (const side of [1, -1]) for (let d = 2.5 + step / 2; d < L - 2.5; d += step) for (const off of offsets(hw)) { const {pos} = along(st, d, off, side); if (tryAdd({kind: 'tree', model: style.tree, street: st.id, cls: st.cls, pos, yaw: (d * 1.7) % (Math.PI * 2)})) break; }
  }
  const strips = CYCLE_STRIPS.map((s) => ({...s}));
  return {streets, items, strips, classes: [...new Set(streets.map((s) => s.cls))]};
}

/** Findings for the road audit: furniture on a carriageway, walk, junction,
 * building or off the town slab; a cycle strip outside its carriageway or a
 * footpath running along it; a shelter away from a real stop. */
export function streetFindings(town, sim, plan = planStreets(town, sim)) {
  const ctx = context(town, sim), out = [];
  for (const item of plan.items) for (const why of furnitureProblems(item, ctx, town, plan.items)) out.push({rule: why === 'carriageway' || why === 'walk' ? 'TOWN-01' : 'TOWN-04', category: 'street-furniture', at: item.pos, detail: `${item.model} (${item.kind}) ${why}`});
  for (const item of plan.items) if (item.kind === 'shelter') { const stop = [...TRAFFIC_STOPS, ...WEST_STOPS].find((s) => s.id === item.stop); if (!stop || dist(stop.point, item.pos) > 6) out.push({rule: 'TOWN-04', category: 'street-furniture', at: item.pos, detail: 'Bus shelter away from a real stop'}); }
  for (const s of plan.strips) {
    const u = unit(s.a, s.b), n = [-u[1], u[0]], L = dist(s.a, s.b);
    for (const side of [1, -1]) for (let d = 0; d <= L; d += .5) for (const e of [-s.width / 2, s.width / 2]) {
      const p = [s.a[0] + u[0] * d + n[0] * side * (s.offset + e), s.a[1] + u[1] * d + n[1] * side * (s.offset + e)];
      if (ctx.index.depth(p) < .05) { out.push({rule: 'TOWN-01', category: 'cycle-strip', at: p, detail: `${s.name} leaves the carriageway`}); break; }
      if (ctx.walk.some((w) => !w.crossing && segDistance(p, w.a, w.b) < .3)) { out.push({rule: 'TOWN-01', category: 'cycle-strip', at: p, detail: `A footpath runs in ${s.name}`}); break; }
    }
  }
  return out;
}
