// Grand Loop geometry, timetable, sidewalk access, crossings and town rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld, rebuildWorldGraph} from '../src/compiler/world-plan.js';
import {RAIL, RAIL_CONTROL, RAIL_RESERVED, SERVICE, polygonContains, nearRail} from '../src/compiler/railway.js';
import {CONSIST, createRailwayService, timetable, trainAt, trainCars, crossingState, railClear, travellerAt, SECONDS_PER_HOUR, TRAIN_LENGTH, grandLoopReview} from '../src/astra/railway-plan.js';
import {pedestrianGraph} from '../src/roads/pedestrian.js';
import {createRegionalTraffic} from '../src/roads/regional-traffic.js';
import {createLife} from '../src/astra/life/runtime.js';
import {runAudit} from '../tools/audit-roads.mjs';
import {TOWN_RULE} from '../src/compiler/town-rules.js';

const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const town = compileWorld(catalog, 831), rail = town.railway;
const graph = pedestrianGraph(town);
const stationIds = rail.stations.map((s) => s.id).sort();
const open = (r) => r.findings.filter((f) => f.status === 'open');

test('the surface loop closes, keeps the minimum radius, and respects district reservations', () => {
  assert(rail.samples.length >= 1773);
  assert(Math.min(...RAIL_CONTROL.map((p) => p[2])) >= 6);
  assert(rail.samples.every((q) => !q.tunnel));
  rail.samples.forEach((q, i) => assert(Math.hypot(q.p[0] - rail.samples[(i + 1) % rail.samples.length].p[0], q.p[1] - rail.samples[(i + 1) % rail.samples.length].p[1]) < RAIL.sample * 1.6));
  for (const id of ['airport', 'high', 'quay', 'union']) assert(stationIds.includes(id));
  for (const q of rail.samples) for (const r of RAIL_RESERVED) {
    if (r.overpass && q.clearance >= 3 || r.offshore && q.offshore && q.bridge) continue;
    assert(!polygonContains(r.area, q.p), `${r.id} at ${q.p}`);
  }
  // Airport station is landside: west of the terminal and north of the apron.
  const airport = rail.stations.find((s) => s.id === 'airport');
  assert(airport.polygon.every(([x, z]) => z > -189 && x < 72));
  // The West Works track is part of the loop, not an orphan stub.
  for (const x of [town.workRail.minX, town.workRail.maxX]) assert(nearRail(rail, [x, town.workRail.z]));
  for (const st of rail.stations) { const v = town.venues.find((x) => x.id === st.venue); assert(v && v.node !== undefined, st.id); }
  for (const seed of [0, 42]) assert.deepEqual(compileWorld(catalog, seed).railway.stations.map((s) => s.id).sort(), stationIds);
});

test('timetable: all-day service, 20-40 s dwells, lap under 12 sim minutes, rests at Union overnight', () => {
  const tt = timetable(rail);
  assert(SERVICE.dwell >= 20 && SERVICE.dwell <= 40);
  assert(tt.lap < 12 * 60, `lap ${tt.lap}`);
  assert(tt.first / SECONDS_PER_HOUR <= 7 && Math.abs(tt.end / SECONDS_PER_HOUR - 22) < .001);
  for (const h of [0, 3, 5.9, 23.5]) { const s = trainAt(rail, tt, h); assert.equal(s.phase, 'rest'); assert.equal(s.station, 'union'); assert.equal(s.siding, true); }
  const seen = new Set(); let maxStep = 0, prev = trainAt(rail, tt, 6.5);
  for (let h = 6.5; h < 22; h += 1 / SECONDS_PER_HOUR) { const s = trainAt(rail, tt, h); if (s.phase === 'dwell') seen.add(s.station); const d = Math.abs(((s.s - prev.s) % rail.length + rail.length * 1.5) % rail.length - rail.length / 2); maxStep = Math.max(maxStep, d); prev = s; }
  assert.deepEqual([...seen].sort(), stationIds);
  assert(maxStep < SERVICE.cruise + .5, `train jumps ${maxStep} m in a second`);
  assert(TRAIN_LENGTH > 50);
  assert(rail.siding.length > TRAIN_LENGTH);
  const parked = trainAt(rail, tt, 0);
  assert(trainCars(rail, parked.s, parked.siding).every(({pos}) => pos[1] < town.workRail.z - 3));
  assert.equal(trainAt(rail, tt, 6.3).phase, 'shunt');
  assert.equal(trainAt(rail, tt, 22.4).phase, 'shunt');
  assert.equal(tt.departures.length, tt.laps * rail.stations.length);
  // Doors open only while the coaches are beside the platform.
  for (let h = 6.5; h < 22; h += .37 / SECONDS_PER_HOUR) { const s = trainAt(rail, tt, h); if (!s.doors) continue; const st = rail.stations.find((x) => x.id === s.station); assert(Math.abs(s.s - st.s) < .01); }
});

test('barriers are down whenever the train is on or near a crossing', () => {
  const tt = timetable(rail);
  assert(rail.crossings.length >= 2);
  for (const c of rail.crossings) assert(c.gated && Math.abs(90 - c.angle) <= RAIL.crossingAngleTolerance);
  for (let h = 6.5; h < 23.2; h += .25 / SECONDS_PER_HOUR) {
    const s = trainAt(rail, tt, h), cars = trainCars(rail, s.s, s.siding);
    rail.crossings.forEach((c) => { const on = cars.some((car) => Math.hypot(car.pos[0] - c.pos[0], car.pos[1] - c.pos[1]) < car.length / 2 + c.reach + 1); if (on) assert(crossingState(rail, c, s).closed, `open crossing under the train at ${h}`); });
  }
});

test('regional cars stop at a closed level crossing; residents wait at the barrier', () => {
  const traffic = createRegionalTraffic(town), c = rail.crossings[0];
  traffic.setStopLines(() => [{point: c.pos, stop: RAIL.half + 2.2, closed: true}]);
  for (let i = 0; i < 90 * 30; i++) traffic.update(1 / 3, 12);
  for (const v of traffic.vehicles) { const dx = v.position[0] - c.pos[0], dz = v.position[1] - c.pos[1]; const along = Math.abs(dx * v.direction[0] + dz * v.direction[1]); if (Math.hypot(dx, dz) < 8) assert(along > RAIL.half + 1, `car on a closed crossing ${v.position}`); }
  assert(traffic.events.railYields > 0);
  const svc = createRailwayService(town, pedestrianGraph(town));
  const closed = rail.crossings.map(() => ({closed: true, lower: 1}));
  const onDeck = c.pos.map((x, i) => x + c.railDir[i] * 3.3);
  const before = onDeck.map((x, i) => x - c.roadDir[i] * 4);
  svc.update(12);
  const states = rail.crossings.map((x) => crossingState(rail, x, {phase: 'run', s: x.s}));
  assert(states.every((s) => s.closed));
  const life = createLife(town, {hour: 12}); assert.equal(typeof life.setRailGuard, 'function');
  assert(!railClear(rail, closed, before, onDeck));
});

test('travellers walk the sidewalk graph to a platform, ride and walk off; never along the rails', () => {
  const svc = createRailwayService(town, pedestrianGraph(town));
  assert(svc.travellers.length >= 10);
  for (const tr of svc.travellers) {
    assert(tr.inboundTrack.at(-1).t < tr.depart, `${tr.id} misses its train`);
    for (const q of [...tr.inboundTrack, ...tr.outboundTrack]) if (nearRail(rail, q.p, .05)) assert(rail.crossings.some((c) => Math.hypot(q.p[0] - c.pos[0], q.p[1] - c.pos[1]) < c.reach + 4), `${tr.id} on the rails at ${q.p}`);
    const riding = travellerAt(tr, (tr.depart + 5) / SECONDS_PER_HOUR); assert.equal(riding, null);
  }
});

for (const leg of ['inboundTrack', 'outboundTrack']) {
  test(`a rail traveller on the ${leg === 'inboundTrack' ? 'way to' : 'way from'} the platform waits for road traffic`, () => {
    const svc = createRailwayService(town, graph);
    const tr = svc.travellers.find((traveller) => traveller[leg].some((sample) => sample.crossing));
    assert(tr, 'a scheduled walker uses a road crossing on this leg');
    const track = tr[leg], first = track.findIndex((sample) => sample.crossing);
    const curb = track[first - 1];
    const [from, to] = track[first].crossing;
    let clear = false;
    svc.setCrossingGuard((a, b) => clear || a !== from || b !== to);
    svc.update(curb.t / SECONDS_PER_HOUR);
    for (let i = 1; i <= 6; i++) {
      svc.update((curb.t + i * .25) / SECONDS_PER_HOUR, .25);
      assert.deepEqual(svc.travellerPose(tr).pos, curb.p);
      assert.equal(svc.travellerPose(tr).moving, false);
      const p = svc.pedestrians.find((person) => person.id === tr.id);
      assert.deepEqual([p.x, p.z, p.vx, p.vz], [...curb.p, 0, 0]);
    }
    svc.update(svc.hour);
    assert.equal(svc.travellerPose(tr).moving, false);
    clear = true;
    svc.update((curb.t + 1.75) / SECONDS_PER_HOUR, .25);
    assert.deepEqual(svc.travellerPose(tr).pos, track[first].p);

    clear = false;
    svc.update((curb.t + .125) / SECONDS_PER_HOUR);
    svc.update((curb.t + .25) / SECONDS_PER_HOUR, .125);
    assert.deepEqual(svc.travellerPose(tr).pos, track[first].p);
  });
}

test('all railway town rules are documented and the audit is clean', async () => {
  assert.equal(TOWN_RULE.rails, 'TOWN-10');
  assert.match(readFileSync(new URL('../docs/TOWN-RULES.md', import.meta.url), 'utf8'), /## TOWN-10 · Rails are not walkways/);
  assert.equal(TOWN_RULE.grandLoop, 'TOWN-17');
  assert.equal(TOWN_RULE.railAccess, 'TOWN-18');
  const rules = readFileSync(new URL('../docs/TOWN-RULES.md', import.meta.url), 'utf8');
  assert.match(rules, /## TOWN-17 · The main line must circle the town/);
  assert.match(rules, /## TOWN-18 · Major places need a named rail stop/);
  assert.deepEqual(open(await runAudit()), []);
});

test('the audit catches illegal walking, floating track, orphan platforms, broken rail and missing gates', async () => {
  const walk = open(await runAudit({mutateGraph: (g) => { const a = g.nodes.findIndex((n) => Math.hypot(n.pos[0] - 67.35, n.pos[1] + 120) < 4); const id = g.nodes.length; g.nodes.push({pos: [76, -120], kind: 'path'}); g.edges.push([{to: a, cost: 9}]); g.edges[a].push({to: id, cost: 9}); }}));
  assert(walk.some((f) => f.category === 'walk-on-rail' && f.rule === 'TOWN-10'));
  const float = open(await runAudit({mutate: (t) => { t.railway.samples[40].y += .5; }}));
  assert(float.some((f) => f.category === 'rail-off-surface' && f.rule === 'TOWN-04'));
  const orphan = open(await runAudit({mutate: (t) => { t.roads = t.roads.filter((r) => !(r.owner === 'railway' && r.a[0] > 60 && r.a[1] < -140)); rebuildWorldGraph(t); }}));
  assert(orphan.some((f) => f.category === 'station-orphan' && f.rule === 'TOWN-05'));
  assert(orphan.some((f) => f.category === 'rail-poi-access' && f.rule === 'TOWN-18'));
  const stub = open(await runAudit({mutate: (t) => { t.railway.samples.splice(100, 6); }}));
  assert(stub.some((f) => f.category === 'rail-stub' && f.rule === 'TOWN-06'));
  const road = open(await runAudit({mutate: (t) => { t.railway.crossings[0].gated = false; }}));
  assert(road.some((f) => f.category === 'rail-crossing' && f.rule === 'TOWN-10'));
});

test('TOWN-17 measures the traced length, enclosed districts and mixed service consist', () => {
  const r = grandLoopReview(town, graph);
  assert(r.length >= 1773);
  assert(r.enclosed >= .8);
  assert(r.trailing >= 6);
  assert(CONSIST.some((c) => c.role === 'passenger'));
  assert(CONSIST.some((c) => c.role === 'freight'));
  const short = {...town, railway: {...rail, samples: rail.samples.slice(0, 20)}};
  const broken = grandLoopReview(short, graph, CONSIST.slice(0, 4));
  assert(broken.length < 1773);
  assert(broken.enclosed < .8);
  assert(broken.trailing < 6);
});

test('TOWN-18 measures the named platform walk for every inventoried place', () => {
  const r = grandLoopReview(town, graph);
  assert.equal(r.stops.length, 13);
  assert.equal(r.stops.find((stop) => stop.id === 'maple-hollow')?.sign, 'MAPLE HOLLOW');
  for (const stop of r.stops) {
    assert(stop.linked, stop.id);
    assert(stop.distance <= 60, `${stop.id} is ${stop.distance.toFixed(1)} m away`);
    assert(stop.sign, stop.id);
  }
  const edited = {...town, railway: {...rail, stations: rail.stations.map((st) => st.id === 'quay'
    ? {...st, furniture: st.furniture.filter((f) => !f.sign)}
    : st)}};
  assert.equal(grandLoopReview(edited, graph).stops.find((st) => st.id === 'quay').sign, undefined);

  const relocated = {...town, venues: town.venues.map((v) => v.id === 'rail-quay'
    ? {...v, entry: town.venues.find((venue) => venue.id === 'work-station').entry}
    : v)};
  assert(grandLoopReview(relocated, graph).stops.find((st) => st.id === 'quay').distance > 60);
});
