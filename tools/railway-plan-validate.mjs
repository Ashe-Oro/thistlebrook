// Plan validator for the railway reroute (Stage A). Re-checks every ban in the
// spec against tools/railway-plan/route.json with shapes from the compiled
// world, the terrain raycaster and the rendered-footprint harvest. It does not
// read the planner's grid or trust the plan's own labels: segment types are
// only used to ask "is this stretch declared as a crossing/tunnel/bridge?".
// Prints every violation (expected: 0) and the declared trade-offs.
// Usage: node tools/railway-plan-validate.mjs [plan.json] [--json out.json] [--rendered footprint.json]
import {readFileSync, writeFileSync} from 'node:fs';
import {loadWorld, worldLayers, renderedMasks} from './railway-plan/layers.mjs';
import {shapeIndex, radius3} from './railway-plan/describe.mjs';
import {Grid, GRID, shapeDist, shapeDir, segDist, dist} from './railway-plan/grid.mjs';
import {RULES, corridor} from './railway-plan/costmap.mjs';
import {sampleTrack, terrainSection, hasFace, hasCoreCover, extraInsideOffsets} from './railway-plan/tunnel.mjs';
import {stopsFor} from './railway-plan/stations.mjs';
import {terrainGrid} from './railway-plan/build.mjs';
import {terrainSurface} from '../src/compiler/terrain.js';
import {GROUND_TOP} from '../src/compiler/woods.js';
import {groundAt} from '../src/compiler/water.js';
import {buildPedestrianGraph, walkBetween} from '../src/roads/pedestrian.js';
import {RAIL} from '../src/compiler/railway.js';

const args = process.argv.slice(2);
const file = args.find((a, i) => a.endsWith('.json') && !['--json', '--rendered'].includes(args[i - 1]))
  ?? new URL('./railway-plan/route.json', import.meta.url).pathname;
const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const jsonOut = option('--json');
const rendered = option('--rendered');
const plan = JSON.parse(readFileSync(file, 'utf8'));
const R = RULES, HALF = RAIL.half, CLEAR = .3;
const violations = [], notes = [], add = (rule, at, detail) => violations.push({rule, at: at.map((v) => +v.toFixed(2)), detail});

const {town, catalog} = loadWorld(831);
const L = worldLayers(town, catalog), terrain = terrainSurface(town);
const I = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, shapeIndex(v)]));
const C = plan.centreline.map(([x, z, y]) => ({p: [x, z], y})), n = C.length;
if (n < 40 || C.some(({p, y}) => ![...p, y].every(Number.isFinite))) {
  console.error('VIOLATIONS: 1\n  [centreline] Missing or invalid centreline samples');
  process.exit(1);
}
C.forEach((q, i) => { const a = C[(i - 1 + n) % n].p, b = C[(i + 1) % n].p, d = [b[0] - a[0], b[1] - a[1]], l = Math.hypot(...d); q.d = [d[0] / l, d[1] / l]; q.s = i * plan.summary.length / n; });
const left = (q) => [-q.d[1], q.d[0]], off = (q, o) => [q.p[0] + left(q)[0] * o, q.p[1] + left(q)[1] * o];
const lateral = [-HALF, -HALF / 2, 0, HALF / 2, HALF];
const seg = (s) => { const len = plan.summary.length; s = (s + .01) % len; return plan.segments.find((g) => g.from <= g.to ? s >= g.from && s < g.to : s >= g.from || s < g.to); };
const crossings = new Map(plan.crossings.map((c) => [c.id, c]));
const tunnels = new Map(plan.tunnels.map((t) => [t.id, t]));

// 1) Closure, continuity, curvature, grade.
const gap = dist(C[0].p, C.at(-1).p);
if (gap > 1.5) add('loop-open', C[0].p, `Loop does not close (${gap.toFixed(2)} m gap)`);
let minR = Infinity, minRAt = C[0].p, kink = 0, maxGrade = 0, chordLength = 0;
for (let i = 0; i < n; i++) {
  const step = dist(C[i].p, C[(i + 1) % n].p);
  chordLength += step;
  if (step < .8 || step > 1.2) add('continuity', C[i].p, `Centreline samples are ${step.toFixed(2)} m apart`);
  const a = C[(i - 4 + n) % n], b = C[i], c = C[(i + 4) % n], r = radius3(a.p, b.p, c.p);
  if (r < minR) { minR = r; minRAt = b.p; }
  const t1 = [b.p[0] - C[(i - 1 + n) % n].p[0], b.p[1] - C[(i - 1 + n) % n].p[1]], t2 = [C[(i + 1) % n].p[0] - b.p[0], C[(i + 1) % n].p[1] - b.p[1]];
  const turn = Math.acos(Math.max(-1, Math.min(1, (t1[0] * t2[0] + t1[1] * t2[1]) / (Math.hypot(...t1) * Math.hypot(...t2))))) * 180 / Math.PI;
  kink = Math.max(kink, turn);
  maxGrade = Math.max(maxGrade, Math.abs(C[(i + 1) % n].y - b.y) / step);
}
if (Math.abs(chordLength - plan.summary.length) > 1) add('length', C[0].p, 'Reported length disagrees with the closed centreline');
const floorR = Math.min(R.Rmin, R.RminTight ?? R.Rmin) * .97; // 3% for the 1 m sampling of the arcs
if (minR < floorR) add('min-radius', minRAt, `Curve radius ${minR.toFixed(1)} m is below ${floorR.toFixed(1)} m`);
if (kink > 8) add('kink', C[0].p, `Centre line turns ${kink.toFixed(1)}° between 1 m samples`);
if (maxGrade > R.maxGrade) add('grade', C[0].p, `Grade ${(maxGrade * 100).toFixed(2)}% exceeds ${R.maxGrade * 100}%`);

// 2) Footprint against water, lots, buildings, plazas/parcels, props, reserved land (exact shapes).
const HARD = {sea: 'sea', water: 'water', stream: 'stream', lot: 'lot', building: 'building', parcel: 'plaza/parcel', prop: 'prop', tree: 'tree crown', reserved: 'reserved land'};
const hardLayers = Object.entries(HARD);
const minClear = {};
const roadContacts = new Map();
const stationIds = new Set(plan.stations.map((st) => st.id));
const wrap = (s) => (s + plan.summary.length) % plan.summary.length;
const insideDeck = (s, deck) => deck && wrap(s - deck.from + .02) <= wrap(deck.to - deck.from) + .04;
const step = plan.summary.length / n;
const insideOffsets = (q) => q.tightSide
  ? [1.5, 1.75, corridor()].map((o) => o * q.tightSide).concat(extraInsideOffsets(q))
  : [];
const checkSamples = sampleTrack(C, plan.summary.length);
for (const q of C) {
  const segment = seg(q.s);
  const valid = segment && (segment.type === 'surface' && segment.ref === null
    || segment.type === 'tunnel' && tunnels.has(segment.ref)
    || segment.type === 'crossing' && crossings.has(segment.ref)
    || segment.type === 'station' && stationIds.has(segment.ref));
  if (!valid) add('segment-type', q.p, 'Missing segment or reference at this point');
}
let waterLength = 0;
for (const q of checkSamples) {
  let wet = false;
  for (const o of lateral) {
    const p = off(q, o);
    for (const [k, label] of hardLayers) {
      const near = I[k].nearest(p, 6), d = near.d - (HALF - Math.abs(o));
      if (d < (minClear[k]?.d ?? Infinity)) minClear[k] = {d, at: p, src: near.s?.src};
      if (near.d < CLEAR) add('overlap-' + k, p, `Track footprint over or within ${CLEAR} m of ${label}: ${near.s?.src}`);
      if (['sea', 'water', 'stream'].includes(k) && near.d < .01) wet = true;
    }
    for (const road of I.road.near(p, 2)) {
      if (shapeDist(road, p) >= .01) continue;
      const candidates = [seg(q.s), seg(wrap(q.s - step))];
      const crossing = candidates.filter((segment) => segment?.type === 'crossing')
        .map((segment) => crossings.get(segment.ref)).find((c) => c && insideDeck(q.s, c.deck));
      if (!crossing) { add('rail-on-road', p, `Track on a carriageway outside a registered crossing: ${road.src}`); continue; }
      const dir = shapeDir(road, p);
      const deviation = dir ? Math.asin(Math.min(1, Math.abs(dir[0] * q.d[0] + dir[1] * q.d[1]))) * 180 / Math.PI : Infinity;
      if (deviation > 10) add('crossing-angle', p, `Track crosses ${road.src} ${deviation.toFixed(1)}° off square`);
      if (Math.abs(q.y - groundAt(town, p)) > .03) add('crossing-flush', p, 'Track head is above or below the road');
      if (!roadContacts.has(crossing.id)) roadContacts.set(crossing.id, new Set());
      roadContacts.get(crossing.id).add(road.src);
    }
  }
  for (const o of insideOffsets(q)) {
    const p = off(q, o);
    for (const [name, label] of hardLayers) {
      if (I[name].nearest(p, 4).d < .01) add('tight-corridor-' + name, p, `Inside of tight curve overlaps ${label}`);
    }
    if (I.road.nearest(p, 4).d < .01) add('tight-corridor-road', p, 'Inside of tight curve overlaps a road');
  }
  if (wet) waterLength += step / 4;
}
// Running along a road: within 3.5 m of a carriageway edge and within 40° of its direction.
for (const q of C) {
  if (plan.crossings.some((c) => insideDeck(q.s, c.deck))) continue;
  const nr = I.road.nearest(q.p, 8); if (!nr.s || nr.d > 3.5) continue;
  const s = nr.s, pts = s.type === 'seg' ? [s.a, s.b] : s.pts; let rd = null, bb = Infinity;
  for (let j = 1; j < pts.length; j++) { const e = segDist(q.p, pts[j - 1], pts[j]); if (e < bb) { bb = e; rd = [pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]]; } }
  const cos = Math.abs(rd[0] * q.d[0] + rd[1] * q.d[1]) / Math.hypot(...rd);
  if (cos > Math.cos(40 * Math.PI / 180)) add('along-road', q.p, `Track runs alongside ${s.src} (${nr.d.toFixed(1)} m off its edge)`);
}

// 3) Rendered geometry (structures and paving the compiled world does not describe).
const grid = new Grid(GRID);
for (const k of ['road', 'path']) grid.paint(k, L[k], 4);
const masks = renderedMasks(grid, terrainGrid(grid, terrain), rendered);
const checkRendered = (p, feature) => {
  if (!masks) return;
  const i = grid.ix(p[0]), j = grid.iz(p[1]), c = j * grid.w + i;
  if (i < 0 || j < 0 || i >= grid.w || j >= grid.h) { add('grid-bounds', p, feature + ' outside the harvested area'); return; }
  if (masks.structure[c]) add('overlap-rendered', p, feature + ' overlaps rendered geometry of ' + masks.ids[masks.owner[c]]?.[0]);
  if (masks.paving[c] && grid.fields.road[c] >= 3.2 && grid.fields.path[c] >= .8) add('overlap-rendered-paving', p, feature + ' overlaps paving of ' + masks.ids[masks.owner[c]]?.[0]);
};
if (!masks) add('rendered-footprint', C[0].p, 'Missing rendered-footprint.json');
else for (const q of checkSamples) for (const o of [...lateral, ...insideOffsets(q)]) checkRendered(off(q, o), 'Track');

// 4) Terrain: open track is clear across the full corridor, and only a
// declared tunnel with real faces and a continuous bore may cross a hill.
const sectionsByTunnel = new Map(plan.tunnels.map((t) => [t.id, []]));
const sections = checkSamples.map((q) => ({q, ...terrainSection(terrain, q)}));
for (const section of sections) {
  const {q, bed} = section, segment = seg(q.s);
  const inTunnel = segment?.type === 'tunnel' && sectionsByTunnel.has(segment.ref);
  if (inTunnel) sectionsByTunnel.get(segment.ref).push(section);
  else if (bed > R.open) add('terrain', q.p, `Hillside ${bed.toFixed(2)} m over the ground plane within the open-track corridor`);
}
for (const t of plan.tunnels) {
  const inT = sectionsByTunnel.get(t.id);
  const vector = (p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
  const portalAt = vector(t.portals?.[0]?.pos) ? t.portals[0].pos : C[0].p;
  if (t.portals?.length !== 2 || t.portals.some((p) => !vector(p.pos) || !Number.isFinite(p.s) || !vector(p.outward))) {
    add('tunnel-portals', portalAt, `${t.id} needs distinct portals at both mouths`);
    continue;
  }
  const segment = plan.segments.find((g) => g.type === 'tunnel' && g.ref === t.id);
  if (!inT.length) {
    add('tunnel-segment', portalAt, `${t.id} has no track in its declared segment`);
    continue;
  }
  const along = (s) => wrap(s - segment.from + .01);
  const spanLength = wrap(segment.to - segment.from);
  inT.sort((a, b) => along(a.q.s) - along(b.q.s));
  const matchPortal = (p, sign) => {
    const face = inT.find(({q}) => Math.abs(q.s - p.s) <= .015 && dist(p.pos, q.p) <= .01);
    if (!face || sign * (face.q.d[0] * p.outward[0] + face.q.d[1] * p.outward[1]) < .95) {
      add('tunnel-portals', p.pos, `${t.id} portal must lie on the track and open away from the bore`);
      return null;
    }
    if (!hasFace(face)) add('portal-face', p.pos, `${t.id} face ${face.crown.toFixed(2)} m / wings ${face.wings.toFixed(2)} m (need ${R.portalHeight} / ${R.wingCover} m)`);
    return face;
  };
  const a = matchPortal(t.portals[0], -1), b = matchPortal(t.portals[1], 1);
  // The stone faces bound the bore. Cover must hold along its full length.
  if (!a || !b) continue;
  const bore = inT.filter(({q}) => along(q.s) >= along(a.q.s) && along(q.s) <= along(b.q.s));
  if (bore.length < 2) {
    add('tunnel-cover', portalAt, `${t.id} has no covered bore between its portals`);
    continue;
  }
  const start = bore[0].q, end = bore.at(-1).q;
  for (const section of bore) {
    const {q, crown, walls, flank} = section;
    if (!hasCoreCover(section)) add('tunnel-cover', q.p, `${t.id}: cover ${crown.toFixed(2)} m / walls ${walls.toFixed(2)} m inside the bore`);
    if (flank < R.flankCover) add('tunnel-flank', q.p, `${t.id}: only ${flank.toFixed(2)} m of cover ${R.boreFlank} m from the centreline`);
  }
  const approaches = [along(start.s), spanLength - along(end.s)];
  if (approaches.some((length) => length > R.maxHood + .02)) add('tunnel-hood', portalAt, `${t.id}: approach ${approaches.map((x) => x.toFixed(2)).join(' / ')} m (maximum ${R.maxHood} m)`);
  for (const [q, approach] of [[start, inT.filter((s) => along(s.q.s) < along(start.s))], [end, inT.filter((s) => along(s.q.s) > along(end.s))]]) {
    if (approach.some((s) => Math.abs((s.q.p[0] - q.p[0]) * q.d[1] - (s.q.p[1] - q.p[1]) * q.d[0]) > .12)) {
      add('tunnel-hood', q.p, `${t.id} portal approach must be straight`);
    }
  }
  if (inT.some((section) => section.bed <= R.open && along(section.q.s) > .3 && spanLength - along(section.q.s) > .3)) {
    add('tunnel-segment', portalAt, `${t.id} contains daylight beyond its approach edges`);
  }
  const min = (key) => +Math.min(...bore.map((s) => s[key])).toFixed(2);
  t.check = {bore: +wrap(end.s - start.s).toFixed(2), minCover: min('crown'), minWalls: min('walls'), minFlank: min('flank'),
    faces: [a, b].map((x) => x && {height: +x.crown.toFixed(2), wings: +x.wings.toFixed(2)})};
}

// 5) Level crossings: square (within 10°), straight over the deck, flush, gates on dry kerbs outside lots.
for (const c of plan.crossings) {
  if (!roadContacts.get(c.id)?.has(c.road)) add('crossing-road', c.at, `${c.id} has no track contact with its declared road`);
  if (c.deviation > 10) add('crossing-angle', c.at, `${c.id} meets ${c.road} ${c.deviation.toFixed(1)}° off square`);
  const radius = Math.min(...C.map((q, i) => [C[(i - 1 + n) % n], q, C[(i + 1) % n]])
    .filter((triple) => triple.every((q) => insideDeck(q.s, c.deck))).map(([a, b, d]) => radius3(a.p, b.p, d.p)));
  if (radius < 200) add('crossing-curve', c.at, `${c.id} deck is curved (radius ${radius.toFixed(0)} m)`);
  const g0 = groundAt(town, c.at); if (!c.deck?.flush || !c.deck.continuousRails || Math.abs(c.deck.y - g0) > .03) add('crossing-flush', c.at, `${c.id} needs a flush deck with continuous rails`);
  const road = I.road.near(c.at, 8).find((s) => s.src === c.road && shapeDist(s, c.at) < .01);
  const direction = road && shapeDir(road, c.at);
  const side = (g) => direction ? direction[0] * (g[1] - c.at[1]) - direction[1] * (g[0] - c.at[0]) : 0;
  if (c.gates?.length !== 2 || c.gates.some((g) => !Array.isArray(g) || !g.every(Number.isFinite)) || side(c.gates[0]) * side(c.gates[1]) >= 0) {
    add('crossing-gate', c.at, `${c.id} needs a gate on each side of the road`);
  }
  c.gates?.forEach((g) => {
    const clearance = I.road.nearest(g, 6).d;
    if (clearance < .1 || clearance > 3.5) add('crossing-gate', g, `${c.id} gate is outside the kerb zone`);
    for (const k of ['lot', 'building', 'parcel', 'water', 'stream', 'sea', 'prop', 'tree']) if (I[k].nearest(g, 6).d < .2) add('crossing-gate', g, `${c.id} gate stands in a ${k}`);
    checkRendered(g, c.id + ' gate');
  });
}

// 6) Bridges: only over an inland stream, short, abutments on land.
for (const b of plan.bridges) {
  add('bridge', b.piers?.[0] ?? C[0].p, `${b.id} proposes a bridge under the no-water rule`);
}

// 7) Stations: platform fully on land and clear; walk to the landmark.
const graph = buildPedestrianGraph({...town, roads: town.roads.filter((r) => !r.station || r.surveyApproach)});
const knownStops = new Map(stopsFor(town).map((stop) => [stop.id, stop]));
const tradeoffs = [];
if (plan.service?.mode !== 'continuous-loop') add('service', C[0].p, 'The Northern Loop must run continuously');
if (!plan.stations.length) add('station', C[0].p, 'The loop needs at least one station');
for (const st of plan.stations) {
  const poly = st.platformWithRamps, [a, b, c] = poly;
  const rows = Math.ceil(dist(a, b) / .25), cols = Math.ceil(dist(b, c) / .25);
  for (let u = 0; u <= rows; u++) for (let v = 0; v <= cols; v++) {
    const p = [a[0] + (b[0] - a[0]) * u / rows + (c[0] - b[0]) * v / cols, a[1] + (b[1] - a[1]) * u / rows + (c[1] - b[1]) * v / cols];
    for (const k of [...Object.keys(HARD), 'road']) if (I[k].nearest(p, 6).d < .05) add('platform-' + k, p, `${st.name} platform over ${k}: ${I[k].nearest(p, 6).s?.src}`);
    if (terrain.height(...p) - GROUND_TOP > R.open) add('platform-terrain', p, `${st.name} platform on a hillside`);
    checkRendered(p, st.name + ' platform');
  }
  // Walk: sidewalk graph from the landmark entrance to the access node, plus the new footpath.
  const stop = knownStops.get(st.id);
  let walk = dist(st.entry, st.access.to);
  if (!stop || dist(stop.origin, st.origin) > .01) add('station-landmark', st.centre, `${st.name} access does not start at its compiled landmark`);
  else {
    const path = walkBetween(graph, stop.origin, st.access.to);
    if (path.length) walk += dist(stop.origin, path[0].pos) + path.slice(1).reduce((acc, p, i) => acc + dist(path[i].pos, p.pos), 0) + dist(path.at(-1).pos, st.access.to);
    else add('station-walk', st.centre, `${st.name} has no walk from its landmark`);
  }
  if (!C.some((q) => dist(st.centre, q.p) < .6 && seg(q.s)?.ref === st.id)) add('station-track', st.centre, `${st.name} platform is disconnected from its track segment`);
  st.checkWalk = +walk.toFixed(1);
  if (walk > 60.05) {
    add('station-walk', st.centre, `${st.name} is a ${walk.toFixed(1)} m walk from ${st.landmark}`);
  }
  if (st.shortened) tradeoffs.push(`${st.name}: platform ${st.length} m (was ${st.lengthBefore} m) to fit the land`);
  if (st.access.newCrosswalks) tradeoffs.push(`${st.name}: footpath needs ${st.access.newCrosswalks} new zebra crossing(s)`);
}

// 8) Tree crowns must stay outside the corridor, and the loop clear of itself.
if (plan.treesCleared.length) add('tree-clearing', C[0].p, 'The plan proposes tree clearing');
let minSep = Infinity, minSepAt = null;
for (const [i, q] of C.entries()) {
  for (let j = i + 1; j < n; j++) {
    const gapS = Math.min(Math.abs(i - j), n - Math.abs(i - j)); if (gapS < 40) continue;
    const d = dist(q.p, C[j].p); if (d < minSep) { minSep = d; minSepAt = q.p; }
  }
}
if (minSep < R.separation - .3) add('self-separation', minSepAt, `Two parts of the loop pass ${minSep.toFixed(1)} m apart`);
if (plan.tunnels.length < 2) notes.push(`Only ${plan.tunnels.length} tunnel(s)`);

// Dedupe violations by rule within 3 m.
const merged = [];
for (const v of violations) { const m = merged.find((x) => x.rule === v.rule && dist(x.at, v.at) < 3); if (m) m.count++; else merged.push({...v, count: 1}); }
const report = {
  plan: file, violations: merged, violationCount: merged.length, tradeoffs: [...tradeoffs, ...(plan.tradeoffs ?? []).filter((t) => t.kind !== 'walk').map((t) => t.text)], notes,
  measured: {length: plan.summary.length, closureLink: +gap.toFixed(3), minRadius: +minR.toFixed(1), minRadiusAt: minRAt.map((v) => +v.toFixed(1)), maxGrade: (maxGrade * 100).toFixed(3) + '%', maxTurnPerMetre: +kink.toFixed(2),
    crossings: plan.crossings.length, maxCrossingDeviation: Math.max(0, ...plan.crossings.map((c) => c.deviation)), tunnels: plan.tunnels.map((t) => ({id: t.id, ...t.check})), bridges: plan.bridges.length,
    overWater: +waterLength.toFixed(2), selfSeparation: +minSep.toFixed(1), treesCleared: plan.treesCleared.length, stationWalks: Object.fromEntries(plan.stations.map((s) => [s.id, s.checkWalk])),
    minClearance: Object.fromEntries(Object.entries(minClear).map(([k, v]) => [k, {m: +v.d.toFixed(2), at: v.at.map((x) => +x.toFixed(1)), src: v.src}]))},
};
console.log(`Railway plan validator: ${file}`);
console.log(`  closed loop, ${gap.toFixed(2)} m last-to-first link, min radius ${minR.toFixed(1)} m, max grade ${(maxGrade * 100).toFixed(2)}%, self-separation ${minSep.toFixed(1)} m`);
console.log(`  ${plan.summary.length} m | ${plan.tunnels.length} tunnels | ${plan.crossings.length} crossings | ${plan.stations.length} stations | ${report.measured.overWater} m over water | ${plan.treesCleared.length} trees cleared`);
console.log(`  minimum footprint clearance: ${Object.entries(report.measured.minClearance).map(([k, v]) => `${k} ${v.m} m`).join(', ')}`);
console.log(`VIOLATIONS: ${merged.length}`);
for (const v of merged) console.log(`  [${v.rule}] (${v.at}) ${v.detail}${v.count > 1 ? ` (x${v.count})` : ''}`);
console.log(`TRADE-OFFS: ${report.tradeoffs.length}`);
for (const t of report.tradeoffs) console.log('  - ' + t);
for (const t of notes) console.log('  note: ' + t);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(report, null, 1));
process.exitCode = merged.length ? 1 : 0;
