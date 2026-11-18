// OWNER: grok-fairlot lane. Funfair Parking: layout, bays, walkway and a
// simulated day of cars, shuttles and visitors with nothing touching.
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../src/astra/fair-lot-plan.js';
import {createFairLotSim, lotTarget} from '../src/astra/fair-lot-sim.js';
import {footprint, footprintsOverlap, pointInFootprint} from '../src/roads/collisions.js';
import {APPROACH, PARK_NODES, PARK_ORIGIN} from '../src/astra/themepark-plan.js';

const parkedFootprint = (b) => P.carFootprint(b.center, [Math.sin(b.yaw), Math.cos(b.yaw)]);
const within = (f, r) => { const c = Math.abs(f.d[0]), s = Math.abs(f.d[1]), hx = f.hl * c + f.hw * s, hz = f.hl * s + f.hw * c; return f.c[0] - hx >= r.min[0] - 1e-6 && f.c[0] + hx <= r.max[0] + 1e-6 && f.c[1] - hz >= r.min[1] - 1e-6 && f.c[1] + hz <= r.max[1] + 1e-6; };
const rotatedWithin = (f, r) => [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([a, b]) => { const p = [f.c[0] + f.d[0] * f.hl * a - f.d[1] * f.hw * b, f.c[1] + f.d[1] * f.hl * a + f.d[0] * f.hw * b]; return P.inRect(p, r, 1e-6); });

test('the lot sits between the road end, the Funfair fence and the coast with at least 60 marked bays', () => {
  assert(P.BAYS.length >= 60, `${P.BAYS.length} bays`);
  assert.equal(new Set(P.BAYS.map((b) => b.id)).size, P.BAYS.length);
  const gate = [PARK_ORIGIN[0] + PARK_NODES.gate[0], PARK_ORIGIN[1] + PARK_NODES.gate[1]];
  assert(P.LOT.minZ > gate[1] + 4 && P.LOT.maxZ < 36, 'south of the fence (z 0.6), north of the Coral Coast blocks (z 36)');
  assert(P.LOT.minX - gate[0] < 4, 'the lot starts beside the gate');
  // The road stub now ends in the apron: its last point lies inside the paved mouth.
  const end = APPROACH.at(-1);
  assert(P.inRect(end, P.APRON), 'road end opens into the apron');
  for (const b of P.BAYS) {
    assert(P.inRect(b.box.min, P.LOT) && P.inRect(b.box.max, P.LOT), `${b.id} inside the lot`);
    for (const a of Object.values(P.AISLES)) assert(!(b.box.min[0] < a.max[0] - 1e-6 && b.box.max[0] > a.min[0] + 1e-6 && b.box.min[1] < a.max[1] - 1e-6 && b.box.max[1] > a.min[1] + 1e-6), `${b.id} clear of the aisles`);
  }
  for (let i = 0; i < P.BAYS.length; i++) for (let j = i + 1; j < P.BAYS.length; j++) { const a = P.BAYS[i].box, b = P.BAYS[j].box; assert(!(a.min[0] < b.max[0] - 1e-6 && a.max[0] > b.min[0] + 1e-6 && a.min[1] < b.max[1] - 1e-6 && a.max[1] > b.min[1] + 1e-6), 'bays do not overlap'); }
  assert(P.LAMPS.length >= 8 && P.PLANTERS.length >= 4 && P.TREES.length >= 6 && P.SIGN.text === 'FUNFAIR PARKING' && P.BOOTH);
});

test('a parked car fits its bay, and every turn in or out clears the neighbours and islands', () => {
  for (const b of P.BAYS) assert(rotatedWithin(parkedFootprint(b), b.box), `${b.id} car inside its markings`);
  const statics = P.STATIC_OBSTACLES.map((r) => P.rectFootprint(r));
  for (const bay of P.BAYS) for (const path of [bay.arrival, bay.departure]) for (const q of path.samples) {
    const f = P.carFootprint(q.p, q.h);
    for (const o of P.BAYS) if (o !== bay) assert(!footprintsOverlap(f, parkedFootprint(o)), `${bay.id} route touches the car in ${o.id} at ${q.p.map((v) => v.toFixed(1))}`);
    for (const w of statics) assert(!footprintsOverlap(f, w), `${bay.id} route touches an island at ${q.p.map((v) => v.toFixed(1))}`);
    for (const p of [...P.LAMPS, ...P.TREES]) assert(!pointInFootprint(p, f, .2), `${bay.id} route touches a lamp or tree`);
  }
});

test('the walkway joins every bay to the Funfair gate, crossing aisles only at the zebras', () => {
  const gate = [PARK_ORIGIN[0] + PARK_NODES.gate[0], PARK_ORIGIN[1] + PARK_NODES.gate[1]];
  for (const bay of P.BAYS) {
    const path = bay.walk; assert(Math.hypot(path.at(-1)[0] - gate[0], path.at(-1)[1] - gate[1]) < 7, 'ends through the gate');
    for (let i = 1; i < path.length; i++) {
      const a = path[i - 1], b = path[i], n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .1);
      for (let k = 0; k <= n; k++) {
        const p = [a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n];
        const inAisle = Object.values(P.AISLES).some((r) => P.inRect(p, r, -.01));
        if (inAisle) assert(P.CROSSWALKS.some((c) => P.inRect(p, c)), `${bay.id} walk crosses an aisle off the zebra at ${p.map((v) => v.toFixed(2))}`);
        for (const o of P.BAYS) assert(!pointInFootprint(p, parkedFootprint(o), .25), `${bay.id} walk brushes the car in ${o.id}`);
      }
    }
  }
});

test('the lot fills while the fair is open and empties overnight', () => {
  assert(lotTarget(3) <= 6 && lotTarget(14) >= 50 && lotTarget(20) > lotTarget(8));
  const sim = createFairLotSim({hour: 14});
  assert.equal(sim.parked.size, lotTarget(14));
  for (const v of sim.vehicles()) { const bay = P.BAYS.find((b) => 'lot-' + b.id === v.parked); assert(bay, 'parked cars only in bays'); assert.deepEqual(v.position, bay.center); }
});

for (const seed of [831, 42]) test(`a simulated day (seed ${seed}): cars only in bays or on routes, nothing touches, nobody waits forever`, {timeout: 600000}, () => {
  const sim = createFairLotSim({hour: 0, seed}), dt = .2, counts = {carCar: 0, carShuttle: 0, carPerson: 0, offRoute: 0}, firsts = [];
  const routeArea = [P.LOT, P.APRON, {min: [190, 3], max: [223, 22]}];
  let hour = 0, t = 0, maxParked = 0, still = new Map(), maxStill = 0, sawMoving = 0, sawVisitors = 0;
  for (let n = 0; n < 24 * 90 / dt; n++) {
    t += dt; hour = (hour + dt / 90) % 24; sim.update(dt, hour, [], t);
    const vs = sim.vehicles(), fps = vs.map(footprint), people = sim.people(), shuttles = [0, 1].map((i) => P.shuttlePose(i, t));
    maxParked = Math.max(maxParked, sim.parked.size); if (vs.some((v) => v.moving)) sawMoving++; if (people.length) sawVisitors++;
    for (let i = 0; i < vs.length; i++) {
      if (vs[i].parked) { const bay = P.BAYS.find((b) => 'lot-' + b.id === vs[i].parked); if (!bay || vs[i].position !== bay.center) counts.offRoute++; continue; }
      if (!routeArea.some((r) => P.inRect(vs[i].position, r))) { counts.offRoute++; firsts.push(['off', vs[i].position]); }
      for (let j = 0; j < vs.length; j++) if (j !== i && (j > i || vs[j].parked) && footprintsOverlap(fps[i], fps[j])) { counts.carCar++; firsts.push(['cc', +hour.toFixed(2), vs[i].id, vs[j].id]); }
      for (const b of shuttles) if (footprintsOverlap(fps[i], {c: b.position, d: b.direction, hl: b.length / 2, hw: b.width / 2})) { counts.carShuttle++; firsts.push(['cs', +hour.toFixed(2), vs[i].id]); }
    }
    for (const p of people) for (let i = 0; i < vs.length; i++) if (pointInFootprint([p.x, p.z], fps[i], .25)) { counts.carPerson++; firsts.push(['cp', +hour.toFixed(2), p.id, vs[i].id]); }
    for (const car of sim.cars) { const prev = still.get(car.id); if (prev && Math.abs(prev.s - car.s) < 1e-3) { prev.n++; maxStill = Math.max(maxStill, prev.n * dt); } else still.set(car.id, {s: car.s, n: 0}); }
  }
  const e = sim.audit().events;
  assert.deepEqual(counts, {carCar: 0, carShuttle: 0, carPerson: 0, offRoute: 0}, JSON.stringify(firsts.slice(0, 6)));
  assert(e.arrivals > 40 && e.departures > 15 && e.parkedVisitors > 60, JSON.stringify(e));
  assert(maxParked >= 50 && sawMoving > 1000 && sawVisitors > 1000, `${maxParked} ${sawMoving} ${sawVisitors}`);
  assert(maxStill < 60, `a car stood still for ${maxStill.toFixed(1)} s`);
});

test('TOWN-01/02/03: lot walk lines stay off the asphalt except at curb-to-curb zebras that land on footways', async () => {
  const {auditFairLot} = await import('../tools/audit-town-rules.mjs');
  const run = (plan) => { const found = []; auditFairLot(plan, (category) => found.push(category)); return found; };
  assert.deepEqual(run(P), []);
  // A zebra that stops mid-aisle, and a walk line cut straight across aisle A1, are both caught.
  const short = P.CROSSWALKS.map((c) => c.id === 'A1' ? {...c, max: [c.max[0], c.max[1] - 1.5]} : c);
  assert(run({...P, CROSSWALKS: short}).includes('unconnected-crosswalk'));
  const bay = P.BAYS.find((b) => b.row === 'D2a'), cut = {...bay, walk: [bay.walk[0], [bay.walk[0][0], 10.5], ...bay.walk.slice(3)]};
  assert(run({...P, BAYS: [cut]}).includes('walk-on-road'));
});

test(`${TOWN_RULE.yield}: lot cars give way at the residents' walk line`, () => {
  const sim = createFairLotSim({hour: 11, seed: 831}), dt = .2;
  let t = 11 * 90;
  const line = P.parkPathFootprints(.45);
  for (let n = 0; n < 2 * 90 / dt; n++) {
    t += dt;
    const people = [];
    for (const c of sim.cars) {
      if (c.kind !== 'arrive' || !c.path) continue;
      for (let d = 0; d <= 10; d += .5) {
        const q = P.samplePath(c.path, Math.min(c.path.length, c.s + d));
        if (line.some((z) => footprintsOverlap(P.carFootprint(q.p, q.h), z))) {
          people.push({x: q.p[0], z: q.p[1], id: 'walker'});
          break;
        }
      }
    }
    sim.update(dt, 11 + n * dt / 90, people, t);
  }
  assert(sim.audit().events.pedestrianYields > 0, `expected lot-car yields, got ${sim.audit().events.pedestrianYields}`);
});
