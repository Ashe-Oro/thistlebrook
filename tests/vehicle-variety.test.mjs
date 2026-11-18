// Vehicle & street variety (docs/specs/overnight/VEHICLE-STREET-VARIETY.md) and TOWN-11.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {createTrafficSimulation, PARKING_BAYS, CYCLE_STRIPS, TRAFFIC_STOPS, WEST_STOPS} from '../src/astra/traffic-simulation.js';
import {FLEET_MODELS, assignFleet, parkedFleet, sameLook, fitModel, FOOTPRINT} from '../src/astra/traffic-fleet.js';
import {planStreets, streetFindings, DOWNTOWN, FURNITURE_MODELS} from '../src/astra/street-plan.js';
import * as water from '../src/astra/water-traffic-plan.js';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {runAudit} from '../tools/audit-roads.mjs';
import {PARK_PATH} from '../src/astra/fair-lot-plan.js';

const town = compileWorld(resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url)))), 831);
const sim = createTrafficSimulation(town);
const fleet = assignFleet(sim.vehicles), parked = parkedFleet(PARKING_BAYS);
const inDowntown = ([x, z]) => x >= DOWNTOWN.minX && x <= DOWNTOWN.maxX && z >= DOWNTOWN.minZ && z <= DOWNTOWN.maxZ;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const plan = planStreets(town, sim);

test('every moving and parked vehicle is a pack model sized to its sim footprint', () => {
  for (const f of [...fleet, ...parked]) assert(f.kind === 'cycle' ? f.model === 'cv-bicycle' : FLEET_MODELS[f.model], `${f.model} is a pack model`);
  for (const [i, v] of sim.vehicles.entries()) {
    if (v.kind === 'cycle') continue;
    assert.equal(FLEET_MODELS[fleet[i].model].kind, v.kind, `vehicle ${v.id}`);
    const fit = fitModel(fleet[i].model, FOOTPRINT[v.kind]);
    assert(fit.size[2] <= v.length + 1e-6 && fit.size[0] <= v.width + 1e-6, `${fleet[i].model} fits ${v.kind}`);
  }
});

test(`${TOWN_RULE.fleet}: downtown shows at least 8 distinct pack models and the fleet never repeats a look side by side`, () => {
  const downtown = new Set();
  sim.vehicles.forEach((v, i) => { if (v.path.points.some(inDowntown)) downtown.add(fleet[i].model); });
  PARKING_BAYS.forEach((b, i) => { if (inDowntown(b.center)) downtown.add(parked[i].model); });
  assert(downtown.size >= 8, `downtown models: ${[...downtown]}`);
  const byRoute = new Map(); sim.vehicles.forEach((v, i) => byRoute.set(v.route, [...(byRoute.get(v.route) || []), fleet[i]]));
  for (const [route, list] of byRoute) for (let i = 1; i < list.length; i++) assert(!sameLook(list[i - 1], list[i]) || list[i].kind === 'cycle', `route ${route}`);
  for (let i = 0; i < PARKING_BAYS.length; i++) for (let j = i + 1; j < PARKING_BAYS.length; j++)
    if (dist(PARKING_BAYS[i].center, PARKING_BAYS[j].center) < 4) assert(!sameLook(parked[i], parked[j]), `${PARKING_BAYS[i].id} / ${PARKING_BAYS[j].id}`);
});

test('at least 6 parked pack cars in legal bays, using at least 3 models', () => {
  assert(PARKING_BAYS.length >= 6);
  assert(new Set(parked.map((p) => p.model)).size >= 3);
});

test('every Maple driveway fleet entry matches the parked model and paint', () => {
  const byBay = new Map(parked.map((p) => [p.bay, p]));
  for (const bay of town.mapleHollow.bays) {
    const car = byBay.get(bay.id);
    assert.equal(FLEET_MODELS[car.model].path, `licensed/suburban-neighborhood/${bay.model}.glb`);
    assert.equal(car.colour, bay.colour);
  }
});

test('streets come in at least 3 classes, and downtown is furnished', () => {
  assert(plan.classes.length >= 3, plan.classes.join());
  const down = plan.items.filter((i) => inDowntown(i.pos)), count = (k) => down.filter((i) => i.kind === k).length;
  assert(count('lamp') >= 4, `lamps ${count('lamp')}`);
  assert(count('bench') + count('bike-rack') >= 3, 'benches and racks');
  assert(count('tree') >= 1, 'street trees');
  const stops = [...TRAFFIC_STOPS, ...WEST_STOPS];
  const shelters = plan.items.filter((i) => i.kind === 'shelter');
  assert(shelters.some((s) => inDowntown(s.pos)), 'a downtown shelter');
  for (const s of shelters) assert(dist(stops.find((t) => t.id === s.stop).point, s.pos) < 6, `${s.stop} shelter at its stop`);
  for (const i of plan.items) assert(FURNITURE_MODELS[i.model], i.model);
  assert.deepEqual(streetFindings(town, sim, plan), []);
  const bed = town.gardens[0], tree = {kind: 'tree', model: 'city-tree', pos: [bed.x + bed.width / 2 + .8, bed.z], yaw: 0};
  assert(streetFindings(town, sim, {...plan, items: [...plan.items, tree]}).some((f) => /garden/.test(f.detail)), 'a street tree over a garden bed is caught');
});

test('the Civic Avenue cycle strip carries the cyclist and no footpath', () => {
  assert(CYCLE_STRIPS.length >= 1);
  const cyclist = sim.vehicles.find((v) => v.kind === 'cycle');
  const s = CYCLE_STRIPS[0], u = [(s.b[0] - s.a[0]) / dist(s.a, s.b), (s.b[1] - s.a[1]) / dist(s.a, s.b)];
  const pts = cyclist.path.points.flatMap((p, i, a) => { if (!i) return [p]; const q = a[i - 1], n = Math.ceil(dist(q, p) / .5); return Array.from({length: n}, (_, k) => [q[0] + (p[0] - q[0]) * (k + 1) / n, q[1] + (p[1] - q[1]) * (k + 1) / n]); });
  const onStrip = pts.filter((p) => { const t = (p[0] - s.a[0]) * u[0] + (p[1] - s.a[1]) * u[1], off = Math.abs((p[0] - s.a[0]) * -u[1] + (p[1] - s.a[1]) * u[0]); return t > 2 && t < dist(s.a, s.b) - 2 && Math.abs(off - s.offset) < s.width / 2 + .05; });
  assert(onStrip.length > 40, 'cyclist rides inside the strip');
  const fault = {...plan, strips: [{...s, offset: 3.5}]};
  assert(streetFindings(town, sim, fault).some((f) => f.category === 'cycle-strip'), 'a strip off the carriageway is caught');
});

test('the harbor and Coral Coast carry varied watercraft through the day', () => {
  for (let h = 9; h <= 16; h += .5) {
    const all = water.watercraftAt(h), harbor = all.filter((b) => b.region === 'harbor' && b.model !== 'cutter'), coast = all.filter((b) => b.region === 'coast' && b.state === 'underway');
    assert(new Set(harbor.map((b) => b.model)).size >= 4, `harbor variety at ${h}`);
    assert(harbor.filter((b) => b.state === 'berth' && water.DOCKED.some((d) => d.id === b.id && /pier|T-head/.test(d.berth))).length >= 3, `docked at piers at ${h}`);
    assert(harbor.some((b) => b.state === 'underway'), `moving harbor boat at ${h}`);
    assert(new Set(coast.map((b) => b.model)).size >= 3, `coast variety at ${h}`);
  }
});

test('the cruiser is at a berth or underway every half hour 07-17 and ties up overnight', () => {
  let trips = 0;
  for (let h = 7; h <= 17; h += .5) { const p = water.cruiserPose(h); assert(['berth', 'underway'].includes(p.state), `${h}`); if (p.state === 'underway') trips++; }
  assert(trips >= 6);
  for (const h of [0, 3, 5.5, 18, 22, 23.5]) { const p = water.cruiserPose(h); assert.equal(p.state, 'berth'); assert.equal(p.berth, water.CRUISER.harborBerth.name); }
});

test(`${TOWN_RULE.boats}: hulls stay in water, at berths or on the documented rack`, () => {
  assert.deepEqual(water.watercraftFindings({roads: water.boatKeepOut(town)}), []);
  const road = town.roads.find((r) => r.kind === 'avenue' && dist(r.a, r.b) > 10), mid = [(road.a[0] + road.b[0]) / 2, (road.a[1] + road.b[1]) / 2];
  const faults = {
    'yacht on the quay': {id: 'fault-yacht', model: 'yacht', region: 'harbor', world: [160, 43], yaw: Math.PI / 2, state: 'berth'},
    'hull through the pier': {id: 'fault-hull', model: 'speedboat', region: 'harbor', world: [170, 60], yaw: 0, state: 'berth'},
    'kayak in the carriageway': {id: 'fault-kayak', model: 'kayak', region: 'town', world: mid, yaw: 0, state: 'underway'},
  };
  for (const [name, boat] of Object.entries(faults))
    assert(water.watercraftFindings({roads: water.boatKeepOut(town), hours: [12], boats: (h) => [...water.watercraftAt(h), boat]}).some((f) => f.rule === TOWN_RULE.boats && f.detail.startsWith(boat.id)), name);
});

test(`${TOWN_RULE.boats} faults fail the road audit`, async () => {
  const r = await runAudit({mutateBoats: (list, hour) => hour === 12 ? [...list,
    {id: 'fault-yacht', model: 'yacht', region: 'harbor', world: [160, 43], yaw: Math.PI / 2, state: 'berth'},
    {id: 'fault-hull', model: 'speedboat', region: 'harbor', world: [170, 60], yaw: 0, state: 'berth'},
    {id: 'fault-kayak', model: 'kayak', region: 'town', world: [-60, -15], yaw: 0, state: 'underway'}] : list});
  const open = r.findings.filter((f) => f.status === 'open' && f.rule === TOWN_RULE.boats);
  for (const id of ['fault-yacht', 'fault-hull', 'fault-kayak']) assert(open.some((f) => f.detail.startsWith(id)), id);
});

test('the lot sim knows where the Pinecrest park footpath crosses the apron', () => {
  const path = town.roads.filter((r) => r.owner === 'themepark' && r.kind === 'park');
  for (const p of PARK_PATH.points) assert(path.some((r) => dist(r.a, p) < .05 || dist(r.b, p) < .05), `${p} on the compiled footpath`);
});

test(`${TOWN_RULE.surface}: parked cars clear structures and fit their documented driveway`, async () => {
  PARKING_BAYS.push({id: 'fault-garden', center: [-10, -5.4], yaw: 0, length: 2.05, width: .9, road: [-7, -5.4]});
  try {
    const r = await runAudit({mutate(t) {
      const bay = t.mapleHollow.bays[0];
      t.mapleHollow.bays[0] = {...bay, id: 'fault-driveway', length: bay.length + 4};
    }});
    assert(r.findings.some((f) => f.status === 'open' && f.category === 'parked-on-lot' && f.rule === TOWN_RULE.surface && /fault-garden covers a garden/.test(f.detail)));
    assert(r.findings.some((f) => f.status === 'open' && f.category === 'parked-off-driveway' && f.rule === TOWN_RULE.surface && /fault-driveway/.test(f.detail)));
  } finally { PARKING_BAYS.pop(); }
});

test('hulls float on the water they are in, without jumps', () => {
  let last = null;
  for (let h = 7; h < 16; h += .002) {
    const p = water.cruiserPose(h).pos, y = water.waterlineAt(p);
    if (last) { const d = dist(p, last.p); assert(Math.abs(y - last.y) <= .12 * d + 1e-9, `cruiser waterline jumps ${Math.abs(y - last.y).toFixed(2)} m over ${d.toFixed(2)} m at ${h.toFixed(3)}h`); }
    last = {p, y};
  }
  for (const c of water.MOVING.filter((m) => m.region === 'coast')) { const p = water.movingPose(c, 12); assert.equal(water.waterlineAt([p.pos[0] + water.COAST_OFFSET[0], p.pos[1] + water.COAST_OFFSET[1]]), water.COAST_SHALLOWS, c.id); }
});

test(`${TOWN_RULE.fleet}: two identical neighbouring looks are a fault`, () => {
  assert(sameLook({model: 'city-sedan', colour: 1}, {model: 'city-sedan', colour: 1}));
  assert(!sameLook({model: 'city-sedan', colour: 1}, {model: 'city-sedan', colour: 2}));
  const pair = [{model: 'city-sedan', colour: 1}, {model: 'city-sedan', colour: 1}];
  assert(sameLook(pair[0], pair[1]), 'a matching pair must be detected');
});
