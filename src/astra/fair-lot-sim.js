// OWNER: grok-fairlot lane. Funfair Parking simulation (pure: no renderer,
// DOM, timers or global random). Cars reserve a bay, drive the mountain road's
// last stretch, circulate the one-way aisles and park nose-in; visitors walk
// from the car along the seam and promenade, over painted crosswalks, to the
// Funfair gate. Leaving visitors walk back, then the car reverses out and goes.
// Rules shared with the roads lane: cars follow the car ahead, give way to
// people, take turns through shared ground (apron, west-aisle merge, a bay
// mouth), and never start a manoeuvre with a shuttle due at the road end.
import {vehicleModel} from './traffic-fleet.js';
import {footprint, footprintsOverlap, pointInFootprint} from '../roads/collisions.js';
import {BAYS, CROSSWALKS, PROMENADE, ROAD_LENGTH, ROUTE_REGIONS, SEAMS, SPAWN_S, WALKWAY, inRect, lanePoint, rectFootprint, samplePath, shuttlePose, parkPathFootprints} from './fair-lot-plan.js';

export const STYLES = [
  {id: 'hatch', model:'vb-pastel-sedan', colors: ['#c87e62', '#80ada3', '#ebdfbc', '#d8b36f', '#7f93b5', '#b45e57']},
  {id: 'sedan', model:'city-sedan', colors: ['#e9e5d9', '#2f3a40', '#b8433c']},
  {id: 'crossover', model:'sn-family-sedan', colors: ['#568baf', '#e9e5d9', '#8a8f93']},
  {id: 'pickup', model:'sn-pickup', colors: ['#aebfbd']},
];
export function fairLotModel(style, color) {
  return vehicleModel(STYLES.find(s=>s.id===style).model,color);
}
// Funfair hours: open 9:00-22:30. Staff cars overnight, a morning rush, a
// full lot through the afternoon and evening, then the lot drains.
export function lotTarget(hour, bays = BAYS.length) {
  const h = ((hour % 24) + 24) % 24, ramp = (a, b, u0, u1) => a + (b - a) * Math.min(1, Math.max(0, (h - u0) / (u1 - u0)));
  let f;
  if (h < 7) f = .06; else if (h < 9) f = ramp(.06, .18, 7, 9); else if (h < 12) f = ramp(.18, .8, 9, 12);
  else if (h < 19) f = ramp(.8, .88, 12, 17); else if (h < 22.5) f = ramp(.88, .7, 19, 22.5); else f = ramp(.7, .06, 22.5, 24);
  return Math.round(f * bays);
}
const rng = (seed) => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
// D1a bays near the entrance: their turn reaches back toward the apron, so a car
// waiting on one would wait where the shuttle turns. They are used only when
// nothing else is moving through A0.
const WEST = new Set(BAYS.filter((b) => b.aisle === 'A0' && b.mouth.min[0] < 236).map((b) => b.id));
const MAX_MOVING = 8, ACCEL = 2, DECEL = 2.5, WALK = 1.25;
const regionPads = {apron: 0, merge: 0};
// A visitor is exposed to cars in a crosswalk, a door gap or an aisle; the
// promenade island, the seams and the fence walkway are car-free.
const exposed = (p) => CROSSWALKS.some((c) => inRect(p, c)) || !(inRect(p, PROMENADE) || SEAMS.some((r) => inRect(p, r)) || inRect(p, WALKWAY) || p[1] < WALKWAY.min[1]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const rectsOverlap = (a, b) => a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[1] < b.max[1] && a.max[1] > b.min[1];
function segRect(a, b, r) { for (let k = 0; k <= 10; k++) { const u = k / 10; if (inRect([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], r)) return true; } return false; }

export function createFairLotSim({hour = 10, seed = 831} = {}) {
  const random = rng(seed * 7 + 11), order = BAYS.map((b, i) => [rng(seed + i * 131)(), i]).sort((a, b) => a[0] - b[0]).map(([, i]) => BAYS[i]);
  const parked = new Map(); // bay id -> {style, color, leaving}
  const reserved = new Set(), cars = [], walkers = [], locks = new Map(), apron = {arrive: new Set(), depart: new Set()}, crossings = new Map(CROSSWALKS.map((c) => [c.id, 0]));
  const events = {arrivals: 0, departures: 0, parkedVisitors: 0, crosswalkWaits: 0, pedestrianYields: 0, resyncs: 0, shuttleHolds: 0};
  let lastHour = null, ids = 0, t = 0, otherVehicles = [];
  const identity = (n) => { const s = STYLES[[0, 0, 1, 0, 2, 0, 3, 1, 0, 2][n % 10]]; return {style: s.id, color: s.colors[Math.floor(n / 10 + n * 7) % s.colors.length]}; };
  function resync(h) {
    parked.clear(); reserved.clear(); cars.length = 0; walkers.length = 0; locks.clear(); apron.arrive.clear(); apron.depart.clear(); for (const k of crossings.keys()) crossings.set(k, 0);
    order.slice(0, lotTarget(h)).forEach((b) => parked.set(b.id, {...identity(BAYS.indexOf(b) * 3 + 1), leaving: false}));
    events.resyncs++;
  }
  // --- locks over shared ground
  const mouthKey = (bay) => 'mouth:' + bay.id;
  function regionOf(key) { if (key.startsWith('mouth:')) return BAYS.find((b) => 'mouth:' + b.id === key).mouth; return ROUTE_REGIONS[key]; }
  function lockList(car) {
    const list = [], keys = ['apron', 'merge', mouthKey(car.bay)];
    for (const key of keys) {
      const region = regionOf(key), f = rectFootprint(region, regionPads[key] || 0); let enter = null, exit = null;
      // First contiguous stretch only: a route that later brushes the same ground again claims it again.
      for (const q of car.path.samples) { if (footprintsOverlap(footprintOf(car,0,q.p,q.h), f)) { if (enter === null) enter = q.s; exit = q.s; } else if (enter !== null) break; }
      if (enter !== null) list.push({key, region, enter: key === 'apron' && car.kind === 'arrive' ? 0 : enter, exit: exit + .1});
    }
    return list;
  }
  const footprintOf = (c, pad = 0, p = c.p, h = c.h) => ({
    c:p, d:h, hl:c.length/2+pad, hw:c.width/2+pad,
  });
  const shuttles = () => [0, 1].map((i) => shuttlePose(i, t));
  function shuttleDue(horizon, zoneStart = ROAD_LENGTH - 14, inboundOnly = false) {
    for (let tau = 0; tau <= horizon; tau += .5) for (const i of [0, 1]) { const b = shuttlePose(i, t + tau); if (b.s > zoneStart && (!inboundOnly || b.forward)) return true; }
    return false;
  }
  // The apron is shared by cars going the same way (arrivals platoon in,
  // leavers platoon out) and exclusive between the two directions.
  const owns = (car, key) => key === 'apron' ? apron[car.kind].has(car.id) : locks.get(key) === car.id;
  const otherApron = (car) => car.kind === 'arrive' ? apron.depart : apron.arrive;
  function release(car, key) { if (key === 'apron') apron[car.kind].delete(car.id); else if (locks.get(key) === car.id) locks.delete(key); }
  function canAcquire(car, lock, people) {
    if (lock.key === 'apron' ? otherApron(car).size > 0 : locks.get(lock.key) && locks.get(lock.key) !== car.id) return false;
    const region = lock.region, rf = rectFootprint(region);
    for (const o of cars) if (o !== car && footprintsOverlap(footprintOf(o, .1), rf) && !(lock.key === 'apron' && o.kind === car.kind)) return false;
    if (lock.key.startsWith('mouth:')) {
      for (const [k, owner] of locks) if (owner !== car.id && k.startsWith('mouth:') && rectsOverlap(regionOf(k), region)) return false;
      for (const c of CROSSWALKS) if (crossings.get(c.id) > 0 && rectsOverlap(c, region)) return false;
      for (const w of walkers) if (w.delay <= 0 && exposed(w.p) && inRect(w.p, region, .4)) return false;
    }
    if (lock.key === 'apron') {
      if (shuttleDue(12) || car.kind === 'arrive' && shuttleDue(12, SPAWN_S - 25, true)) { events.shuttleHolds++; return false; }
      // A walker on the far side of the apron has room to keep walking.
      // Hold the reservation only when the car's route crosses their space.
      const close = people.filter(p=>inRect([p.x,p.z],region,1.5));
      if (close.length && car.path.samples.some(q=>q.s>=car.s && q.s<=lock.exit &&
        close.some(p=>pointInFootprint([p.x,p.z],footprintOf(car,0,q.p,q.h),p.waitingForLocalTraffic?.13:.4)))) return false;
      if (car.kind === 'arrive') { const entry = {min: [223, 4.6], max: [233, 6.9]}; for (const o of cars) if (o !== car && footprintsOverlap(footprintOf(o, .1), rectFootprint(entry))) return false; }
      apron[car.kind].add(car.id); return true;
    }
    if (lock.key === 'merge') { const ahead = {min: [223, 7], max: [227.4, 16]}; let n = 0; for (const o of cars) if (o !== car && footprintsOverlap(footprintOf(o), rectFootprint(ahead))) n++; if (n > 1) return false; }
    locks.set(lock.key, car.id); return true;
  }
  // --- cars
  function place(car) { const q = samplePath(car.path, car.s); car.p = q.p; car.h = q.h; car.reverse = q.reverse; }
  function spawnArrival(people) {
    if (cars.length >= MAX_MOVING) return false;
    const start = lanePoint(SPAWN_S, true).p;
    if (cars.some((c) => dist(c.p, start) < 14) || otherVehicles.some(v=>dist(v.position,start)<8)) return false;
    if (people.some((p) => Math.hypot(p.x - start[0], p.z - start[1]) < 6)) return false;
    if (cars.some((c) => WEST.has(c.bay.id) && !c.clearOfMouth)) return false;
    const free = BAYS.filter((b) => !parked.has(b.id) && !reserved.has(b.id) && (!WEST.has(b.id) || !cars.length)); if (!free.length) return false;
    const bay = free[Math.floor(random() * free.length)]; reserved.add(bay.id);
    const car = {id: 'lot-car-' + (++ids), kind: 'arrive', bay, path: bay.arrival, s: 0, speed: 3.5, status: 'Arriving', ...identity(ids * 3 + 7)};
    Object.assign(car,fairLotModel(car.style,car.color)); car.locks = lockList(car); place(car);
    if (!canAcquire(car, car.locks.find((l) => l.key === 'apron'), people)) { reserved.delete(bay.id); ids--; return false; }
    cars.push(car); events.arrivals++; return true;
  }
  function clearance(car, people) {
    const left = car.path.length - car.s, look = Math.min(left, 1.4 + car.speed * car.speed / (2 * DECEL) + .8);
    let clear = left;
    // Own locks first: wait before shared ground until it can be claimed.
    for (const lock of car.locks) {
      if (owns(car, lock.key) || car.s > lock.exit) continue;
      if (lock.enter - car.s > look + .3) continue;
      if (!canAcquire(car, lock, people)) clear = Math.min(clear, Math.max(0, lock.enter - car.s - .25));
    }
    const near = cars.filter((o) => o !== car && dist(o.p, car.p) < look + 5);
    const shut = [...shuttles(),...otherVehicles].filter((b) => dist(b.position, car.p) < look + 7);
    const held = [...locks].filter(([k, owner]) => owner !== car.id).map(([k]) => rectFootprint(regionOf(k)));
    if (otherApron(car).size && !owns(car, 'apron')) held.push(rectFootprint(ROUTE_REGIONS.apron));
    // Town residents share this approach with lot cars. Leave room for them
    // to keep walking along the park path while a car brakes or turns.
    const walking = walkers.filter(w=>w.delay<=0&&exposed(w.p)&&dist(w.p,car.p)<look+4).map(w=>w.p);
    const crossers = [...walking.filter(p=>parkPath.some(r=>pointInFootprint(p,r)))];
    const yielding = [];
    for (const p of people) {
      if (dist([p.x, p.z], car.p) >= look + 6) continue;
      // The walker has already yielded. Keep body clearance, but allow the
      // car to finish turning and release the footpath.
      if (p.waitingForLocalTraffic) yielding.push([p.x, p.z]);
      else {
        for (const t of [0, .45, .9, 1.35]) walking.push([p.x + t * (p.vx || 0), p.z + t * (p.vz || 0)]);
        if (parkPath.some(r=>pointInFootprint([p.x,p.z],r))) crossers.push([p.x,p.z]);
      }
    }
    const cross = CROSSWALKS.filter((c) => crossings.get(c.id) > 0).map((c) => rectFootprint(c, .3));
    const blockedNow = (f) => held.filter((r) => footprintsOverlap(f, r)).length + cross.filter((r) => footprintsOverlap(f, r)).length;
    const base = blockedNow(footprintOf(car));
    // Residents' walk line on the approach road: wait short of it while anyone is near the crossing point.
    const onPath = (f) => parkPath.some((r) => footprintsOverlap(f, r)), pathBase = onPath(footprintOf(car));
    for (let d = .3; d <= look; d += .3) {
      const q = samplePath(car.path, car.s + d), f = footprintOf(car,.15,q.p,q.h);
      let hit = near.some((o) => footprintsOverlap(f, footprintOf(o, .15))) || shut.some((b) => footprintsOverlap(f, footprint(b), .3));
      if (!hit && (walking.some(p => pointInFootprint(p, f, .4)) || yielding.some(p => pointInFootprint(p, f, .13)))) { hit = true; if (car.status !== 'Yielding to pedestrian') events.pedestrianYields++; car.status = 'Yielding to pedestrian'; }
      if (!hit && blockedNow(f) > base) hit = true;
      if (!hit && !pathBase && onPath(f) && crossers.some((p) => dist(p, q.p) < 4)) { hit = true; if (car.status !== 'Yielding to pedestrian') events.pedestrianYields++; car.status = 'Yielding to pedestrian'; }
      if (hit) return keepClear(car, Math.min(clear, Math.max(0, d - .3)));
    }
    return keepClear(car, clear);
  }
  // Never come to rest on a crosswalk: stop short of it unless already on it.
  const parkPath = parkPathFootprints(.25);
  const zebra = [...CROSSWALKS.map((c) => rectFootprint(c, .6)), ...parkPathFootprints(.45)];
  function keepClear(car, clear) {
    const left = car.path.length - car.s; if (clear >= left - 1e-6) return clear;
    if (zebra.some((z) => footprintsOverlap(footprintOf(car), z))) return clear;
    let d = clear; while (d > 0 && zebra.some((z) => { const q = samplePath(car.path, car.s + d); return footprintsOverlap(footprintOf(car,0,q.p,q.h), z); })) d -= .1;
    return Math.max(0, d);
  }
  function stepCar(car, dt, people) {
    const clear = clearance(car, people), inMouth = car.locks.some((l) => l.key.startsWith('mouth:') && locks.get(l.key) === car.id && car.s >= l.enter - .5);
    const onRoad = car.p[0] < 222.5, limit = car.reverse ? 1 : inMouth ? 1.5 : onRoad ? 5.5 : 3.6;
    const wanted = Math.min(limit, Math.sqrt(2 * DECEL * Math.max(0, clear)));
    car.speed = Math.max(0, Math.min(wanted, car.speed + ACCEL * dt));
    const travel = Math.min(car.speed * dt, clear);
    if (travel < 1e-4) car.speed = Math.min(car.speed, clear / Math.max(dt, 1e-3));
    car.s += travel; place(car);
    if (car.status === 'Yielding to pedestrian' && travel > .01) car.status = car.kind === 'arrive' ? 'Arriving' : 'Leaving';
    for (const lock of car.locks) if (owns(car, lock.key) && car.s > lock.exit) release(car, lock.key);
    const mouth = car.locks.find((l) => l.key.startsWith('mouth:'));
    if (!car.clearOfMouth && mouth && (car.kind === 'depart' ? car.s > mouth.exit : false)) { car.clearOfMouth = true; reserved.delete(car.bay.id); }
    if (car.s >= car.path.length - 1e-3) {
      for (const lock of car.locks) release(car, lock.key);
      cars.splice(cars.indexOf(car), 1);
      if (car.kind === 'arrive') { reserved.delete(car.bay.id); parked.set(car.bay.id, {style: car.style, color: car.color, leaving: false}); spawnVisitors(car.bay, 1 + Math.floor(random() * 3), 'out'); }
    }
  }
  // --- visitors
  function spawnVisitors(bay, n, way) {
    const route = way === 'out' ? bay.walk : [...bay.walk].reverse();
    for (let i = 0; i < n; i++) walkers.push({id: 'lot-visitor-' + (++ids), bay, way, route, leg: 0, p: [...route[0]], delay: i * 1.3, crossing: null, wait: 0, last: i === n - 1});
    if (way === 'out') events.parkedVisitors += n;
  }
  // The first crosswalk on the way from a to b, and how far the kerb is (a
  // waiting visitor stands 0.6 m back from the painted area).
  function crossingAt(a, b) {
    const len = dist(a, b); let best = null;
    for (const c of CROSSWALKS) for (let d = 0; d <= len; d += .05) { const p = [a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len]; if (inRect(p, c, .6)) { if (!best || d < best.d) best = {c, d: Math.max(0, d - .05)}; break; } }
    return best;
  }
  function crossingFree(c, people) {
    const rf = rectFootprint(c, .5);
    for (const o of cars) { const f = footprintOf(o); if (footprintsOverlap(f, rf)) return false; const cx = (c.min[0] + c.max[0]) / 2, cz = (c.min[1] + c.max[1]) / 2, to = [cx - o.p[0], cz - o.p[1]], d = Math.hypot(...to); if (d < 9 && o.speed > .15 && (to[0] * o.h[0] + to[1] * o.h[1]) * (o.reverse ? -1 : 1) > 0) return false; }
    for (const [k] of locks) if (k.startsWith('mouth:') && rectsOverlap(regionOf(k), c)) return false;
    return true;
  }
  function stepWalker(w, dt, people) {
    if (w.delay > 0) { w.delay -= dt; return; }
    let budget = WALK * dt;
    while (budget > 1e-6 && w.leg < w.route.length - 1) {
      const a = w.route[w.leg], b = w.route[w.leg + 1];
      // Leaving the door gap or a seam toward a car manoeuvring nearby: wait.
      if (w.leg === 0 || w.leg === w.route.length - 2) {
        const gap = w.way === 'out' ? [w.route[0], w.route[1]] : [w.route.at(-2), w.route.at(-1)];
        if (cars.some((o) => o.speed > .05 && Math.min(dist(o.p, gap[0]), dist(o.p, gap[1])) < 3.2)) { w.wait += dt; return; }
        if ([...locks.keys()].some((k) => k.startsWith('mouth:') && k !== 'mouth:' + w.bay.id && (inRect(gap[0], regionOf(k)) || inRect(gap[1], regionOf(k))) && cars.some((o) => o.speed > .05 && dist(o.p, gap[1]) < 6))) { w.wait += dt; return; }
      }
      const hit = !w.crossing && crossingAt(w.p, b);
      if (hit && !inRect(w.p, hit.c)) {
        if (hit.d < .02) { if (!crossingFree(hit.c, people)) { if (w.wait === 0) events.crosswalkWaits++; w.wait += dt; return; } w.crossing = hit.c.id; crossings.set(hit.c.id, crossings.get(hit.c.id) + 1); }
        else { const m = Math.min(budget, hit.d), d = dist(w.p, b); w.p = [w.p[0] + (b[0] - w.p[0]) * m / d, w.p[1] + (b[1] - w.p[1]) * m / d]; budget -= m; if (m === hit.d) continue; break; }
      }
      const d = dist(w.p, b);
      if (d <= budget) { w.p = [...b]; budget -= d; w.leg++; } else { w.p = [w.p[0] + (b[0] - w.p[0]) * budget / d, w.p[1] + (b[1] - w.p[1]) * budget / d]; budget = 0; }
      if (w.crossing) { const cw = CROSSWALKS.find((x) => x.id === w.crossing); if (!inRect(w.p, cw, .6)) { crossings.set(w.crossing, crossings.get(w.crossing) - 1); w.crossing = null; } }
    }
    if (w.leg >= w.route.length - 1) {
      walkers.splice(walkers.indexOf(w), 1);
      if (w.way === 'in' && w.last) { const info = parked.get(w.bay.id); if (info) info.ready = true; }
    }
  }
  function schedule(hour, people, dt) {
    const target = lotTarget(hour), arriving = cars.filter((c) => c.kind === 'arrive').length;
    const leaving = [...parked.values()].filter((v) => v.leaving).length + cars.filter((c) => c.kind === 'depart').length;
    const present = parked.size + arriving - leaving;
    if (present < target - 1) spawnArrival(people);
    // While the fair is open some visitors head home all day, so the lot keeps turning over.
    const open = hour > 9.5 && hour < 21.5, churn = open && leaving < 2 && present >= target - 1 && random() < dt / 22;
    if (churn || present > target + 1 && leaving < 6) {
      const options = BAYS.filter((b) => parked.has(b.id) && !parked.get(b.id).leaving); const bay = options[Math.floor(random() * options.length)];
      if (bay) { parked.get(bay.id).leaving = true; spawnVisitors(bay, 1 + Math.floor(random() * 2), 'in'); }
    }
    for (const bay of BAYS) {
      const info = parked.get(bay.id); if (!info?.ready || cars.length >= MAX_MOVING) continue;
      const car = {id: 'lot-car-' + (ids + 1), kind: 'depart', bay, path: bay.departure, s: 0, speed: 0, status: 'Leaving', style: info.style, color: info.color};
      Object.assign(car,fairLotModel(car.style,car.color)); car.locks = lockList(car); const mouth = car.locks.find((l) => l.key.startsWith('mouth:'));
      if (WEST.has(bay.id) && cars.some((c) => c.kind === 'arrive')) continue;
      if (cars.some((c) => c.kind === 'arrive' && rectsOverlap(c.bay.mouth, bay.mouth))) continue;
      if (!canAcquire(car, mouth, people)) continue;
      ids++; parked.delete(bay.id); reserved.add(bay.id); place(car); cars.push(car); events.departures++;
    }
  }
  // After the clock is set, run the last minute so the lot is mid-flow.
  let warmed = false;
  function warm(hour, time, people) {
    warmed = true;
    for (let k = 240; k > 0; k--) { t = time - k * .25; for (const car of [...cars]) stepCar(car, .25, people); for (const w of [...walkers]) stepWalker(w, .25, people); schedule(hour, people, .25); }
  }
  resync(hour); lastHour = hour;
  return {
    cars, walkers, parked, locks, events,
    get time() { return t; },
    update(dt, hour, people = [], time = t + dt, others = []) {
      otherVehicles = others;
      if (!(dt > 0)) return;
      const diff = (((hour - lastHour) % 24) + 24) % 24;
      lastHour = hour;
      if (Math.min(diff, 24 - diff) > .35 || !warmed) { resync(hour); warm(hour, time, people); } // the clock was set, not run
      t = time;
      if (dt < 1e-3) return; // paused: only follow the clock
      const step = Math.min(dt, .25);
      for (const car of [...cars]) stepCar(car, step, people);
      for (const w of [...walkers]) stepWalker(w, step, people);
      schedule(hour, people, step);
    },
    clearWalk(from, to) {
      if (to[0] < 190 || to[0] > 270 || to[1] < -12 || to[1] > 42) return true;
      const midpoint = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
      return !cars.some(car => {
        const body = footprintOf(car);
        return !pointInFootprint(from, body, .25) && [midpoint, to].some(p => pointInFootprint(p, body, .35));
      });
    },
    /** Every car, parked or moving, for rendering and collision checks. */
    vehicles() {
      const out = [];
      for (const b of BAYS) { const v = parked.get(b.id); if (v) out.push({id: 'lot-' + b.id, kind: 'lot-car', parked: 'lot-' + b.id, style: v.style, color: v.color, position: b.center, direction: [Math.sin(b.yaw), Math.cos(b.yaw)], ...fairLotModel(v.style,v.color), speed: 0}); }
      for (const c of cars) out.push({id: c.id, kind: 'lot-car', style: c.style, color: c.color, position: c.p, direction: c.h, model:c.model, colour:c.colour, fit:c.fit, length:c.length, width:c.width, speed: c.speed, moving: true, status: c.status});
      return out;
    },
    people() { return walkers.filter((w) => w.delay <= 0).map((w) => ({id: w.id, x: w.p[0], z: w.p[1], walking: true, heading: w.route[w.leg + 1] ? Math.atan2(w.route[w.leg + 1][0] - w.p[0], w.route[w.leg + 1][1] - w.p[1]) : 0, waiting: w.wait > 0})); },
    audit() { return {bays: BAYS.length, parked: parked.size, target: lotTarget(lastHour), moving: cars.length, walkers: walkers.length, locks: [...locks.keys(), ...[...apron.arrive, ...apron.depart].map((id) => 'apron:' + id)], events: {...events}}; },
  };
}
