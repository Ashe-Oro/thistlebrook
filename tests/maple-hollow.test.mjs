// OWNER: opus-suburb lane. Maple Hollow: lots, reachability, regions, bus route, residents.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {compileWorld} from '../src/compiler/world-plan.js';
import {createLife} from '../src/astra/life/runtime.js';
import {activityPose} from '../src/astra/life/visuals.js';
import {createRegionalTraffic} from '../src/roads/regional-traffic.js';
import {PARKING_BAYS, CROSSWALKS} from '../src/astra/traffic-simulation.js';
import {MAPLE_HOLLOW_BOUNDS, MAPLE_HOLLOW_RESIDENTS, STREETS, polyDist, planMapleHollow} from '../src/astra/maple-hollow-plan.js';
import {REGIONAL} from '../src/roads/regional.js';

const town = compileWorld(resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url)))), 831);
const mh = town.mapleHollow;
// Other lanes' reserved areas (docs/specs/OPUS-SUBURB.md): grok-woods and grok-fairlot.
const WOODS_AREA = {minX: -200, maxX: -72, minZ: -28, maxZ: 124}, FAIR_LOT = {minX: 195, maxX: 250, minZ: -15, maxZ: 45};
const overlaps = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const reachable = (() => { const seen = new Set([0]), queue = [0]; for (let i = 0; i < queue.length; i++) for (const n of town.edges[queue[i]]) if (!seen.has(n)) { seen.add(n); queue.push(n); } return seen; })();
const mhRoads = town.roads.filter((r) => r.mapleHollow && r.centerline);

test('maple hollow: 20-30 lots, each with a house (or an empty plot), driveway, lawn, mailbox and bins', () => {
  assert.ok(mh.lots.length >= 20 && mh.lots.length <= 30, `lots ${mh.lots.length}`);
  const built = mh.lots.filter((l) => !l.vacant);
  assert.ok(built.length >= 20, `homes ${built.length}`);
  assert.ok(mh.lots.filter((l) => l.vacant || l.forSale).length <= 2, 'one or two lots for sale or vacant');
  for (const l of built) for (const part of ['house', 'driveway', 'lawn', 'mailbox', 'bins', 'plaque']) assert.ok(l.parts[part], `${l.key} lacks ${part}`);
  assert.equal(new Set(built.map((l) => l.house)).size, 6, 'all six house types appear');
  for (let i = 1; i < built.length; i++) if (built[i].street === built[i - 1].street) assert.notEqual(built[i].house, built[i - 1].house, `${built[i].key} repeats its neighbour`);
  const homes = town.buildings.filter((b) => b.district === 'maple-hollow');
  assert.equal(homes.length, built.length);
  assert.ok(homes.every((b) => b.kind === 'home' && b.custom));
  // Driveway cars are parking bays, so the audit and the collision sim see them.
  assert.ok(mh.bays.length >= built.length * .8, 'most driveways hold a family car');
  for (const b of mh.bays) assert.ok(PARKING_BAYS.some((p) => p.id === b.id), `${b.id} in PARKING_BAYS`);
});

test('maple hollow: every home reachable from the world network, with door paths to its street', () => {
  for (const b of town.buildings.filter((b) => b.district === 'maple-hollow')) {
    assert.ok(Number.isInteger(b.node) && reachable.has(b.node), `${b.key} unreachable`);
    assert.ok(town.roads.some((r) => r.owner === b.key && r.kind === 'door'), `${b.key} has no door path`);
  }
  // Two connections to the existing network: the airport road (x 64) and the West Works lane/avenue corner.
  const drive = STREETS.drive.points;
  assert.deepEqual(drive[0], [-42, -139]);
  assert.equal(drive.at(-1)[0], 64);
  assert.ok(town.roads.some((r) => r.kind === 'world-link' && !r.mapleHollow && r.centerline && polyDist(drive.at(-1), r.centerline) < .05), 'Drive meets the airport road');
  assert.ok(town.roads.some((r) => r.kind !== 'world-link' && !r.mapleHollow && Math.hypot(r.a[0] + 42, r.a[1] + 139) < .05 || Math.hypot(r.b[0] + 42, r.b[1] + 139) < .05), 'Drive meets the West Works lane');
  // At least one cul-de-sac: a Maple Hollow street with a true terminus.
  assert.ok(mhRoads.some((r) => r.ends.some((e) => e.terminus && !e.touches)), 'a cul-de-sac turning circle');
  for (const s of ['mh-stop-acorn', 'mh-stop-drive', 'mh-stop-school']) assert.ok(reachable.has(mh.nodes[s]), s);
});

test('maple hollow: inside its site, clear of other regions, the woods and the fair lot', () => {
  const region = town.regions.find((r) => r.id === 'maple-hollow');
  assert.ok(region, 'region registered');
  assert.deepEqual(region.bounds, {...MAPLE_HOLLOW_BOUNDS});
  for (const r of town.regions) if (r.id !== 'maple-hollow') assert.ok(!overlaps(region.bounds, r.bounds), `overlaps region ${r.id}`);
  assert.ok(!overlaps(region.bounds, WOODS_AREA) && !overlaps(region.bounds, FAIR_LOT));
  for (const v of town.venues) { const b = {minX: v.box.min[0], maxX: v.box.max[0], minZ: v.box.min[1], maxZ: v.box.max[1]}; assert.ok(!overlaps(region.bounds, b), `overlaps venue ${v.id}`); }
  for (const b of town.buildings.filter((b) => b.district !== 'maple-hollow')) { const bb = {minX: b.box.min[0], maxX: b.box.max[0], minZ: b.box.min[1], maxZ: b.box.max[1]}; assert.ok(!overlaps(region.bounds, bb), `overlaps ${b.name}`); }
  // Everything Maple Hollow draws stays in the site box (props within a 2 m margin).
  const inside = (p, m = 0) => p[0] >= MAPLE_HOLLOW_BOUNDS.minX - m && p[0] <= MAPLE_HOLLOW_BOUNDS.maxX + m && p[1] >= MAPLE_HOLLOW_BOUNDS.minZ - m && p[1] <= MAPLE_HOLLOW_BOUNDS.maxZ + m;
  for (const l of mh.lots) assert.ok(inside(l.center), l.key);
  for (const p of mh.props) assert.ok(inside(p.pos, 2), `${p.model} at ${p.pos}`);
  // Landscape trees and hills never stand on a Maple Hollow street or lot (the seeded stream is unchanged).
  for (const m of town.landscape.models) for (const r of mhRoads) assert.ok(polyDist(m.pos, r.centerline) > REGIONAL.verge / 2 - .5, `landscape ${m.asset} on ${r.registryId}`);
  for (const m of town.landscape.models) assert.ok(!mh.lots.some((l) => Math.hypot(l.center[0] - m.pos[0], l.center[1] - m.pos[1]) < Math.min(l.width, l.depth) / 2), `landscape ${m.asset} in a lot`);
});

test('maple hollow: props stay off the carriageway; houses clear every street', () => {
  for (const p of mh.props) for (const r of [...mhRoads, ...town.roads.filter((r) => r.kind === 'world-link' && r.centerline)]) {
    if (p.model === 'vacant_lot_tile') continue;
    assert.ok(polyDist(p.pos, r.centerline) > REGIONAL.width / 2 + .1, `${p.model} at ${p.pos} on the road`);
  }
  for (const b of mh.bays) for (const r of mhRoads) assert.ok(polyDist(b.center, r.centerline) > REGIONAL.kerb + .6, `${b.id} sits beyond the sidewalk`);
  for (const l of mh.lots.filter((l) => !l.vacant)) for (const r of mhRoads) for (const x of [l.box.min[0], l.box.max[0]]) for (const z of [l.box.min[1], l.box.max[1]]) assert.ok(polyDist([x, z], r.centerline) > REGIONAL.verge / 2 - .1, `${l.key} corner near the street`);
  assert.ok(CROSSWALKS.filter((c) => c.mapleHollow).length >= 3, 'bus stop and school-edge crossings');
  // Play spots and the way round to the backyard stay clear of the parked driveway cars.
  const nearCar = (p) => mh.bays.some((b) => { const d = [p[0] - b.center[0], p[1] - b.center[1]], f = [Math.sin(b.yaw), Math.cos(b.yaw)]; return Math.abs(d[0] * f[0] + d[1] * f[1]) < b.length / 2 + .6 && Math.abs(d[0] * f[1] - d[1] * f[0]) < b.width / 2 + .6; });
  for (const l of mh.lots) for (const p of [...(l.yard?.slots || []).map((q) => q.at), ...(l.around || [])]) assert.ok(!nearCar(p), `${l.key} path or play spot at ${p} touches a parked car`);
});

test('Maple Hollow local traffic turns before Airport Road and the railway clears that road', () => {
  const traffic = createRegionalTraffic(town);
  const connector = STREETS.drive.points.at(-1);
  const airportApproach = town.roads.find((r) => r.centerline && !r.mapleHollow &&
    polyDist(connector, r.centerline) < .05 && r.centerline.some((p) => p[1] < -180));
  assert(airportApproach, 'Airport Road connects the Maple junction and the northbound approach');
  assert.equal(town.railway.crossings.length, 0, 'the northern loop clears the airport through road');
  const approach = traffic.lines.find((line) => line.mapleHollow && polyDist(connector, line.points) < .05);
  assert(approach);
  const end = approach.sampler.at(approach.end).p, start = approach.sampler.at(approach.start).p;
  assert(Math.min(Math.hypot(end[0] - connector[0], end[1] - connector[1]),
    Math.hypot(start[0] - connector[0], start[1] - connector[1])) >= 6.5);
});

test('TOWN-13: Maple traffic yields while a pedestrian is on either half of a zebra', () => {
  for (const offset of [0, 1.6]) {
    const traffic = createRegionalTraffic(town);
    const car = traffic.vehicles.find((v) => v.mapleHollow && !v.scheduled);
    traffic.vehicles.splice(0, traffic.vehicles.length, car);
    const [x, z] = car.position, [dx, dz] = car.direction;
    car.speed = 3;
    traffic.update(.2, 12, [{x: x + dx * 2 - dz * offset, z: z + dz * 2 + dx * offset, crossing: true}]);
    assert.equal(car.speed, 0);
    assert.equal(car.status, 'Yielding to pedestrian');
    assert.deepEqual(car.position, [x, z]);
    traffic.update(.2, 12);
    assert(car.speed > 0);
  }
});

test('maple hollow: the school bus route runs on regional roads only', () => {
  const route = mh.bus.route, centerlines = town.roads.filter((r) => r.kind === 'world-link' && r.centerline).map((r) => r.centerline);
  assert.ok(route.length > 20);
  // After leaving the depot lay-by, every route point lies on a planned centerline.
  for (const p of route.slice(1)) assert.ok(centerlines.some((c) => polyDist(p, c) < .05), `route point ${p} off the roads`);
  for (let i = 1; i < route.length; i++) assert.ok(Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]) < 6, 'route is continuous');
  assert.ok(Math.hypot(route.at(-1)[0] - 64, route.at(-1)[1] + 69) < .1, 'turns at the campus end of the airport road');
  const rt = createRegionalTraffic(town), bus = rt.transit.vehicles[0];
  assert.equal(bus.kind, 'school-bus');
  for (const s of mh.bus.stops) assert.ok(bus.stops.find((x) => x.id === s.id).s > 0, s.id);
});

test('maple hollow: residents live here, kids ride the bus to school and home, adults work in town', () => {
  const life = createLife(town, {hour: 6.6});
  const mine = life.actors.filter((a) => a.context.district === 'maple-hollow');
  assert.equal(mine.length, MAPLE_HOLLOW_RESIDENTS.length);
  assert.equal(new Set(life.actors.map((a) => a.context.id)).size, life.actors.length, 'unique resident ids');
  for (const a of mine) {
    const c = a.context, labels = c.schedule.map((s) => s.label), targets = c.schedule.map((s) => s.target);
    assert.ok(c.assets.home.startsWith('maple-lot-'), `${c.name} lives in Maple Hollow`);
    assert.ok(targets.includes(c.assets.home), `${c.name} schedule includes home`);
    if (c.kid) { assert.ok(labels.includes('At school') && life.registry.places.find((p) => p.id === c.job.workplace)?.name === 'Thistlebrook High School', `${c.name} goes to school`); assert.ok(c.commute.stop.startsWith('mh-stop-'), `${c.name} has a bus stop`); }
    else assert.ok(labels.includes('At work'), `${c.name} works`);
  }
  // Older residents keep their homes (no one moves into Maple Hollow by accident).
  assert.ok(life.actors.filter((a) => a.context.district !== 'maple-hollow').every((a) => !a.context.assets.home.startsWith('maple-lot-')));
  // Run the weekday morning: every kid boards at a Maple Hollow stop and alights at Thistlebrook High.
  const rt = createRegionalTraffic(town); life.setTransit(rt.transit);
  const kids = mine.filter((a) => a.context.kid), boarded = new Set(), alighted = new Set();
  let hour = 6.6;
  while (hour < 8.8) {
    hour += .2 / 90; life.update(.2, hour);
    rt.update(.2, hour, life.actors.filter((a) => !a.riding).map((a) => ({x: a.context.location.position[0], z: a.context.location.position[1]})), []);
    for (const k of kids) { if (k.riding) boarded.add(k.context.id); else if (boarded.has(k.context.id)) alighted.add(k.context.id); }
  }
  assert.equal(boarded.size, kids.length, 'every kid boarded the bus');
  assert.equal(alighted.size, kids.length, 'every kid got off at school');
  assert.ok(kids.every((k) => Math.hypot(k.context.location.position[0] - 30, k.context.location.position[1] + 70) < 45), 'kids are at the campus');
  // Stay in class until the bell, ride the afternoon bus, step off at their own stop, then play in the yards.
  const home = new Set(), off = new Map();
  while (hour < 17.6) {
    hour += .2 / 90; life.update(.2, hour);
    rt.update(.2, hour, life.actors.filter((a) => !a.riding).map((a) => ({x: a.context.location.position[0], z: a.context.location.position[1]})), []);
    if (hour < 14.8) assert.ok(kids.every((k) => Math.hypot(k.context.location.position[0] - 30, k.context.location.position[1] + 70) < 45), 'kids stay on campus until the bell');
    for (const k of kids) { if (k.riding) home.add(k.context.id); else if (home.has(k.context.id) && !off.has(k.context.id)) off.set(k.context.id, rt.transit.vehicles[0].stopAt); }
  }
  assert.equal(home.size, kids.length, 'every kid rode the afternoon bus');
  for (const k of kids) assert.equal(off.get(k.context.id), k.context.commute.stop + '-home', `${k.context.name} steps off at their own stop`);
  const {minX, maxX, minZ, maxZ} = MAPLE_HOLLOW_BOUNDS;
  const inHollow = (k) => { const [x, z] = k.context.location.position; return x >= minX - 3 && x <= maxX + 3 && z >= minZ - 3 && z <= maxZ + 3; };
  assert.ok(kids.every(inHollow), 'kids are back in Maple Hollow after school');
  assert.ok(kids.filter((k) => String(k.action?.args?.target || k.context.location.place || '').startsWith('mh-yard:')).length >= kids.length - 1, 'kids play in the yards');
});

test('Maple kids reach the treehouse, jump at the hoop and bob in the pool', () => {
  for (const yard of ['treehouse', 'hoop', 'pool']) {
    const place = town.registry.places.find((p) => p.interaction?.yard === yard);
    const slot = place.interaction.slots[0];
    const actor = {index: 0, facing: slot.facing, action: {tool: 'visit'},
      context: {location: {position: slot.position, slot: slot.id}}};
    const start = activityPose(actor, place, 0);
    const during = activityPose(actor, place, .2);
    if (yard === 'treehouse') {
      assert.equal(during.lift, 1.3);
      assert.notEqual(during.facing, start.facing);
    } else if (yard === 'hoop') {
      assert.equal(start.lift, 0);
      assert(during.lift > .3);
    } else {
      assert(during.lift < 0 && during.lift > start.lift);
    }
    actor.action.tool = 'walkTo';
    assert.equal(activityPose(actor, place, .2).lift, undefined);
  }
});

test('maple hollow: plan is deterministic and pure', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(planMapleHollow())), JSON.parse(JSON.stringify(planMapleHollow())));
  assert.ok(town.districts.some((d) => d.id === 'maple-hollow' && d.name === 'Maple Hollow'));
});
