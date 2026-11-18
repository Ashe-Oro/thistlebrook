// OWNER: grok-roads lane. Full-day car/pedestrian safety simulation (seed 831).
// Usage: node tools/sim-collisions.mjs [--root <worktree>] [--hours 24] [--weather clear] [--json]
// Counts car-car overlaps, car-person contacts, walkers on carriageway outside
// a crossing, and crossings started with a car close. Works against older trees
// too (falls back to the legacy regional-vehicle and errand logic) so before and
// after numbers come from the same harness.
import {readFileSync, existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';
import {ZEBRA_HALF_WIDTH} from '../src/roads/crosswalks.js';
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const here = new URL('..', import.meta.url).pathname;
const root = opt('--root', here).replace(/\/$/, '') + '/';

export async function simulateDay({root: tree = root, hours = 24, seed = 831, dt = .2, weather = 'clear', log = false} = {}) {
  const imp = (p) => import(pathToFileURL(tree + p).href), mine = (p) => import(pathToFileURL(here + p).href);
  const {resolveAll} = await imp('src/catalog/resolve-all.js');
  const {compileWorld} = await imp('src/compiler/world-plan.js');
  const {createLife} = await imp('src/astra/life/runtime.js');
  const sim = await imp('src/astra/traffic-simulation.js');
  const loadWalk = existsSync(tree + 'src/roads/pedestrian.js') ? imp : mine;
  const {pedestrianGraph, segDistance} = await loadWalk('src/roads/pedestrian.js');
  const {residentPedestrian} = await mine('src/roads/walking.js');
  const {footprint, footprintsOverlap, pointInFootprint, crossingClear} = await mine('src/roads/collisions.js');
  const catalog = resolveAll(JSON.parse(readFileSync(tree + 'src/catalog/bounds.json')));
  const town = compileWorld(catalog, seed);
  const life = createLife(town, {hour: 0, weather});
  const traffic = sim.createTrafficSimulation(town);
  const graph = pedestrianGraph(town), surf = graph.index;
  // Regional vehicles: current module, or the legacy render-side logic.
  let regional;
  if (existsSync(tree + 'src/roads/regional-traffic.js')) regional = (await imp('src/roads/regional-traffic.js')).createRegionalTraffic(town);
  else {
    const curve = (pts) => new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
    const groups = new Map(); for (const r of town.roads.filter((r) => r.centerline)) { if (!groups.has(r.routeGroup)) groups.set(r.routeGroup, []); groups.get(r.routeGroup).push(r); }
    const vehicles = [];
    for (const g of groups.values()) { const c = new THREE.CurvePath(); g.forEach((r) => c.add(curve(r.centerline))); const length = c.getLength(), count = Math.max(2, Math.ceil(length / 65));
      for (let i = 0; i < count; i++) { const bus = i === 1 && length > 45; vehicles.push({curve: c, length, phase: i * 2 / count, speed: bus ? 6 : 8, distance: 0, kind: bus ? 'bus' : 'car', length: bus ? 4.6 : 2.9, width: bus ? 1.8 : 1.35, curveLength: length, position: [0, 0], direction: [0, 1]}); } }
    const place = (v) => { const u = (v.distance / v.curveLength + v.phase) % 2, f = u < 1 ? u : 2 - u, p = v.curve.getPointAt(f), t = v.curve.getTangentAt(f), side = u < 1 ? 1.3 : -1.3; v.position = [p.x + t.z * side, p.z - t.x * side]; v.direction = u < 1 ? [t.x, t.z] : [-t.x, -t.z]; };
    vehicles.forEach(place);
    regional = {vehicles, update(step, hour, people) { for (const v of vehicles) { const y = people.some((p) => Math.hypot(p.x - v.position[0], p.z - v.position[1]) < 3); if (!y) v.distance += step * v.speed * (hour > 6 && hour < 21 ? 1 : .55); v.speedNow = y ? 0 : v.speed; place(v); } }};
  }
  // Downtown errand walkers.
  let errand;
  if (existsSync(tree + 'src/astra/downtown-errands.js')) { const m = await imp('src/astra/downtown-errands.js'); errand = (t) => Array.from({length: m.ERRAND_WALKERS}, (_, n) => m.errandPose(n, weather === 'snow' ? t * .8 : t, weather === 'rain')); }
  else errand = (t) => Array.from({length: 10}, (_, n) => { const north = n < 5, u = (t * .018 + n * .18) % 2, v = u < 1 ? u : 2 - u, walk = Math.min(1, Math.max(0, (v - .12) / .76)); return {x: north ? -73 + walk * 26 : -65.2, z: north ? -17.8 + n % 2 * .55 : -13 + walk * 15}; });
  // Pinewood hikers (grok-woods): clock-driven trail walkers, pedestrians too.
  let hikers = () => [];
  if (town.woods && existsSync(tree + 'src/astra/woods-hikers.js')) { const m = await imp('src/astra/woods-hikers.js'), rosters = new Map(); hikers = (hour) => { const w = (4 + life.day) % 7; if (!rosters.has(w)) rosters.set(w, m.hikerRoster(town.woods, w)); return rosters.get(w).map((h) => [h, m.hikerPose(h, town.woods, hour)]).filter(([, p]) => p).map(([h, p]) => ({x: p.x, z: p.z, walking: p.walking, id: h.id})); }; }
  const parked = sim.PARKING_BAYS ? sim.PARKING_BAYS.map((b) => ({position: b.center, direction: [Math.sin(b.yaw), Math.cos(b.yaw)], length: b.length, width: b.width, speed: 0, parked: b.id}))
    : [[-73, -16], [-69, -16], [-31, -33]].map(([x, z], i) => ({position: [x, z + .82], direction: [1, 0], length: 1.85, width: .88, speed: 0, parked: 'legacy-' + i}));
  // Funfair Parking (grok-fairlot): parked and moving lot cars, and the visitors walking to the gate.
  const lot = existsSync(tree + 'src/astra/fair-lot-sim.js') ? (await imp('src/astra/fair-lot-sim.js')).createFairLotSim({hour: 0, seed}) : null;
  let lotVehicles = lot ? lot.vehicles() : [];
  const shuttlePose = lot ? (await imp('src/astra/fair-lot-plan.js')).shuttlePose : null;
  // Thistlebrook Loop Line (railway-loop): train cars are vehicles, barriers stop
  // regional cars and residents, and the day's rail travellers walk with everyone else.
  let railway = null, rail = null, trainVehicles = [], railPlan = null;
  if (town.railway && existsSync(tree + 'src/astra/railway-plan.js')) {
    railPlan = await imp('src/astra/railway-plan.js'); rail = await imp('src/compiler/railway.js');
    railway = railPlan.createRailwayService(town, graph);
    life.setRailGuard?.((a, b) => railway.clear(a, b));
    regional.setStopLines?.(() => town.railway.crossings.map((c, i) => ({point: c.pos, stop: rail.RAIL.half + 2.2, closed: railway.crossings[i].closed})));
  }
  // Thistlebrook High (school-day): pupils and their teacher walking the timetable.
  let school = null;
  if (existsSync(tree + 'src/astra/school-plan.js')) {
    const mod = await imp('src/astra/school-plan.js'), {walkBetween} = await loadWalk('src/roads/pedestrian.js');
    const plan = mod.planSchool(town, graph, walkBetween);
    school = {mod, plan, day: mod.createSchoolDay?.(plan), seen: new Set(), maxOut: 0};
  }
  const trainNow = () => railway ? railway.cars.filter((c) => !c.hidden && (c.y ?? 0) < 2.8).map((c) => ({position: c.pos, direction: c.dir, length: c.length, width: c.width, speed: railway.train.speed, kind: 'train', train: true})) : [];
  const allVehicles = () => [...traffic.vehicles, ...regional.vehicles, ...parked, ...lotVehicles, ...trainVehicles];
  const clearRoad = (a, b) => crossingClear(a, b, allVehicles());
  life.setCrossingGuard?.(clearRoad);
  railway?.setCrossingGuard?.(clearRoad);
  life.setLocalWalkGuard?.(lot?.clearWalk);
  // Scheduled vehicles (the Maple Hollow school bus) board and drop riders; riders aren't walkers.
  if (regional.transit) life.setTransit?.(regional.transit);
  const rides = {boarded: 0, alighted: 0, maxAboard: 0};
  let previousRiders = new Set();
  // TOWN-01: only crossing corridors in the same graph the residents use.
  const crossings = graph.crossings.map(([a, b]) => [graph.nodes[a].pos, graph.nodes[b].pos]);
  const crossingNear = (p) => crossings.some(([a, b]) => segDistance(p, a, b) <= ZEBRA_HALF_WIDTH);
  const counts = {carCar: 0, carPerson: 0, personOnRoad: 0, unsafeCrossing: 0, personOnRail: 0, vehicleOnRail: 0, boatClash: 0, boatPerson: 0, samples: 0}, firsts = {carCar: [], carPerson: [], personOnRoad: [], unsafeCrossing: [], personOnRail: [], vehicleOnRail: [], boatClash: [], boatPerson: []}, seen = {carCar: new Set(), carPerson: new Set(), personOnRoad: new Set(), unsafeCrossing: new Set(), personOnRail: new Set(), vehicleOnRail: new Set(), boatClash: new Set(), boatPerson: new Set()};
  const railStats = {travellers: railway?.travellers.length ?? 0, boardings: 0, crossingClosures: 0, waitsAtBarrier: 0};
  let wasClosed = [];
  // TOWN-11: docked, racked and moving boats and the cruiser versus piers, quays, roads and each other, every quarter hour.
  const water = existsSync(tree + 'src/astra/water-traffic-plan.js') ? await imp('src/astra/water-traffic-plan.js') : null;
  const keepOut = water ? water.boatKeepOut(town) : [];
  let quarter = -1, hulls = [];
  const note = (kind, key, detail) => { counts[kind]++; if (!seen[kind].has(key)) { seen[kind].add(key); if (firsts[kind].length < 12) firsts[kind].push(detail); } };
  let hour = 0, t = 0; const steps = Math.round(hours * 90 / dt);
  for (let n = 0; n < steps; n++) {
    t += dt; hour = (hour + dt / 90) % 24;
    if (railway) { railway.update(hour, dt); trainVehicles = trainNow(); const closed = railway.crossings.map((c) => c.closed); closed.forEach((c, i) => { if (c && !wasClosed[i]) railStats.crossingClosures++; }); wasClosed = closed; }
    life.update(dt, hour);
    const riders = new Set(life.actors.filter((a) => a.riding).map((a) => a.context.id));
    for (const id of riders) if (!previousRiders.has(id)) rides.boarded++;
    for (const id of previousRiders) if (!riders.has(id)) rides.alighted++;
    rides.maxAboard = Math.max(rides.maxAboard, riders.size);
    previousRiders = riders;
    const walkers = life.actors.filter((a) => !a.riding).map((a) => residentPedestrian(a, life.walkPace?.(a)));
    const errands = errand(t).map((p, i) => ({x: p.x, z: p.z, walking: true, id: 'errand-' + i}));
    const townPeople = [...walkers, ...errands, ...hikers(hour)];
    const visitors = lot ? lot.people() : [];
    railway?.advanceWalkers?.(dt, hour, clearRoad);
    const travellers = railway ? (typeof railway.pedestrians === 'function' ? railway.pedestrians() : railway.pedestrians) ?? railway.travellers.flatMap((tr) => { const pose = railPlan.travellerAt(tr, hour); return pose ? [{x: pose.pos[0], z: pose.pos[1], vx: pose.moving ? Math.sin(pose.facing) * 1.25 : 0, vz: pose.moving ? Math.cos(pose.facing) * 1.25 : 0, walking: true, id: tr.id}] : []; }) : [];
    const weekday = (4 + life.day) % 7;
    const pupils = school ? school.mod.schoolWalkers(school.day?.update(hour, weekday, dt, clearRoad, railway?.clear)
      ?? school.mod.schoolState(school.plan, hour, weekday)) : [];
    if (school) { pupils.forEach((p) => school.seen.add(p.id)); school.maxOut = Math.max(school.maxOut, pupils.length); }
    const people = [...townPeople, ...visitors, ...travellers, ...pupils];
    traffic.update(dt, people); regional.update(dt, hour, people, traffic.vehicles);
    if (lot) { lot.update(dt, hour, [...townPeople, ...travellers], t); lotVehicles = lot.vehicles(); }
    if (n % 2) continue; counts.samples++;
    if (water && Math.floor(hour * 4) !== quarter) { quarter = Math.floor(hour * 4); const list = water.watercraftAt(quarter / 4); hulls = list.map((b) => ({b, f: water.boatFootprint(b.model, b.world, b.yaw)}));
      for (const f of water.watercraftFindings({roads: keepOut, hours: [quarter / 4], boats: () => list})) note('boatClash', f.detail.replace(/ at [\d.]+h$/, ''), {hour: quarter / 4, detail: f.detail, at: f.at}); }
    const vs = allVehicles(), fps = vs.map(footprint);
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) if (!(vs[i].train && vs[j].train) && Math.hypot(fps[i].c[0] - fps[j].c[0], fps[i].c[1] - fps[j].c[1]) < 6 && footprintsOverlap(fps[i], fps[j])) note('carCar', `${i}-${j}`, {hour: +hour.toFixed(2), a: vs[i].kind || vs[i].parked, b: vs[j].kind || vs[j].parked, id: vs[i].id, line: vs[i].line?.id, s: vs[i].s, d: vs[i].direction, status: vs[i].status, at: fps[i].c.map((v) => +v.toFixed(1))});
    if (railway) {
      const shuttles = shuttlePose ? [0, 1].map((i) => ({...shuttlePose(i, t), id: 'pinecrest-shuttle-' + i})) : [];
      for (const v of [...vs.filter((car) => !car.train), ...shuttles]) {
        const q = v.position;
        if (rail.nearRail(town.railway, q) && !town.railway.crossings.some((c) => railPlan.onCrossingDeck(town.railway, c, q))) {
          note('vehicleOnRail', v.id ?? String(q), {hour: +hour.toFixed(2), vehicle: v.id ?? v.kind, at: q.map((x) => +x.toFixed(1))});
        }
      }
    }
    for (const p of people) {
      const q = [p.x, p.z];
      for (let i = 0; i < vs.length; i++) if (Math.abs(fps[i].c[0] - q[0]) < 4 && Math.abs(fps[i].c[1] - q[1]) < 4 && pointInFootprint(q, fps[i], .25)) note('carPerson', `${p.id}-${i}`, {hour: +hour.toFixed(2), person: p.id, vehicle: vs[i].kind || vs[i].parked, id: vs[i].id, status: vs[i].status, speed: +(vs[i].speed ?? vs[i].speedNow ?? 0).toFixed(2), car: fps[i].c.map((v) => +v.toFixed(1)), at: q.map((v) => +v.toFixed(1))});
      for (const {b, f} of hulls) if (b.state !== 'rack' && Math.abs(f.c[0] - q[0]) < 8 && Math.abs(f.c[1] - q[1]) < 8 && pointInFootprint(q, {c: f.c, d: f.d, hl: f.hl, hw: f.hw}, .1)) note('boatPerson', `${p.id}-${b.id}`, {hour: +hour.toFixed(2), person: p.id, boat: b.id, at: q.map((v) => +v.toFixed(1))});
      if (!p.walking) continue;
      // TOWN-10: on the railway only on a level-crossing deck.
      if (railway && rail.nearRail(town.railway, q, .05) && !town.railway.crossings.some((c) => railPlan.onCrossingDeck(town.railway, c, q, .6))) note('personOnRail', `${p.id}-${q.map((v) => Math.round(v / 3))}`, {hour: +hour.toFixed(2), person: p.id, at: q.map((v) => +v.toFixed(1))});
      if (surf.depth(q) > .05) {
        if (crossingNear(q)) { const i = vs.findIndex((v, i) => Math.hypot(fps[i].c[0] - q[0], fps[i].c[1] - q[1]) < fps[i].hl + 1.2 && (v.speed ?? v.speedNow ?? 0) > .2); if (i >= 0) note('unsafeCrossing', `${p.id}-${q.map(Math.round)}`, {hour: +hour.toFixed(2), person: p.id, at: q.map((v) => +v.toFixed(1)), vehicle: vs[i].kind || vs[i].id, vehicleAt: fps[i].c.map((v) => +v.toFixed(1)), speed: +(vs[i].speed ?? vs[i].speedNow ?? 0).toFixed(2), status: vs[i].status}); }
        else note('personOnRoad', `${p.id}-${q.map((v) => Math.round(v / 3))}`, {hour: +hour.toFixed(2), person: p.id, at: q.map((v) => +v.toFixed(1)), depth: +surf.depth(q).toFixed(2)});
      }
    }
    if (log && n % 4500 === 0) console.error('hour', hour.toFixed(1), JSON.stringify(counts));
  }
  if (railway) { railStats.waitsAtBarrier = life.actors.filter((a) => a.waitingForTrain).length; railStats.railYields = regional.events?.railYields ?? 0; railStats.laps = railway.timetable.laps; railStats.boardings = railway.travellers.filter((tr) => tr.depart < hours * 90).length; railStats.lapSeconds = +railway.timetable.lap.toFixed(1); }
  return {school: school ? {walkers: school.seen.size, mostOutAtOnce: school.maxOut} : null, lot: lot ? lot.audit() : null, railway: railway ? railStats : null, transit: regional.transit ? {busStops: regional.events.busStops, vehicles: regional.transit.vehicles.length, ...rides} : null, counts, unique: Object.fromEntries(Object.entries(seen).map(([k, s]) => [k, s.size])), firsts, vehicles: allVehicles().length, residents: life.actors.length};
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await simulateDay({hours: +opt('--hours', 24), weather: opt('--weather', 'clear'), log: true});
  console.log(JSON.stringify(result, null, args.includes('--json') ? 0 : 2));
  if (Object.entries(result.counts).some(([kind, count]) => kind !== 'samples' && count > 0)) process.exitCode = 1;
}
