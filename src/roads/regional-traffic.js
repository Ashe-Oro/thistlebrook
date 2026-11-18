// OWNER: grok-roads lane. Regional road traffic (pure; render reads positions).
// Cars drive their line's right-hand lane, follow the car ahead, give way to
// people on the road, take turns through regional junctions and turn around
// only at a line's end (a turning circle, or short of a town junction).
import {distanceToSegment} from '../compiler/astra.js';
import {footprint, footprintsOverlap} from './collisions.js';
const mod = (v, n) => ((v % n) + n) % n;
const LANE = 1.3, END_TAPER = 5, TURN_TIME = 1.6;
function sampler(points) {
  const cum = [0]; for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const length = cum.at(-1);
  return {length, at(s) {
    s = Math.max(0, Math.min(length, s)); let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const a = points[lo], b = points[hi], span = cum[hi] - cum[lo] || 1, t = (s - cum[lo]) / span, d = [(b[0] - a[0]) / span, (b[1] - a[1]) / span], l = Math.hypot(...d) || 1;
    return {p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], d: [d[0] / l, d[1] / l]};
  }};
}
export function createRegionalTraffic(town) {
  const roads = town.roads.filter((r) => r.kind === 'world-link');
  const touchesTown = (p) => town.roads.some((r) => r.kind !== 'world-link' && (r.kind === 'avenue' || r.width >= 2.4) && distanceToSegment(p, r.a, r.b) < .05); // a T onto a street counts, not just a shared end
  const lines = (town.regionalLines || []).map((line) => {
    // Lines that end at a town junction turn around 7 m short of it.
    const pts = line.points;
    const throughRoad = (p) => touchesTown(p) || (line.mapleHollow && roads.some((r, i) => !line.roads.includes(i)
      && [r.a, r.b].some((end) => Math.hypot(end[0] - p[0], end[1] - p[1]) < .05)));
    const trim = [throughRoad(pts[0]) ? 7 : 0, throughRoad(pts.at(-1)) ? 7 : 0];
    const s = sampler(pts); return {...line, sampler: s, start: trim[0], end: s.length - trim[1]};
  }).filter((l) => l.end - l.start > 20);
  // Junctions shared by several regional roads: one vehicle at a time.
  const ends = new Map(); for (const r of roads) for (const p of [r.a, r.b]) { const k = p.map((v) => v.toFixed(2)).join(','); ends.set(k, (ends.get(k) || 0) + 1); }
  const junctions = [...ends.entries()].filter(([, n]) => n >= 3 || n === 2).map(([k]) => ({point: k.split(',').map(Number), owner: null}))
    .filter((j) => roads.filter((r) => [r.a, r.b].some((p) => Math.hypot(p[0] - j.point[0], p[1] - j.point[1]) < .05)).length >= 3);
  const vehicles = [];
  // Lines through Maple Hollow (opus-suburb) carry family cars, never the boxy shuttle.
  lines.forEach((line) => {
    const usable = line.end - line.start, count = Math.max(1, Math.round(usable / 90)), suburb = line.mapleHollow;
    for (let i = 0; i < count; i++) {
      const bus = i === 1 && usable > 45 && !suburb, forward = i % 2 === 0;
      vehicles.push({id: 'regional-' + vehicles.length, kind: bus ? 'bus' : 'car', line, regionalId: line.roads[0], forward, ...(suburb ? {mapleHollow: true} : {}), s: line.start + usable * ((i + .5) / count), speed: 0, maxSpeed: bus ? 5 : 6.5, length: bus ? 4.6 : 2.9, width: bus ? 1.8 : 1.35, turning: 0, status: 'Cruising', position: [0, 0], direction: [0, 1]});
    }
  });
  const place = (v) => {
    const {p, d} = v.line.sampler.at(v.s), edge = Math.min(v.s - v.line.start, v.line.end - v.s), lane = LANE * Math.min(1, Math.max(0, edge / END_TAPER)), side = v.forward ? 1 : -1;
    v.position = [p[0] + d[1] * lane * side, p[1] - d[0] * lane * side];
    const heading = v.forward ? d : [-d[0], -d[1]];
    if (v.turning > 0) { const f = v.turning / TURN_TIME, a0 = Math.atan2(heading[0], heading[1]) + Math.PI * f; v.direction = [Math.sin(a0), Math.cos(a0)]; } else v.direction = heading;
  };
  // Scheduled vehicles (opus-suburb): the Maple Hollow school bus runs a weekday
  // morning and afternoon loop on its own route over these same roads. It obeys
  // every rule above (follows, yields, takes junction turns) and adds stops,
  // where it opens its doors until the commuters walking to that stop are aboard.
  const transit = {vehicles: [], pending: null}, sched = town.mapleHollow?.bus;
  let day = 0, lastHour = null;
  if (sched?.route?.length > 1) {
    const sm = sampler(sched.route), line = {id: 'school-bus', points: sched.route, sampler: sm, start: 0, end: sm.length, roads: []};
    const project = (p) => { let best = 0, bd = Infinity; for (let q = 0; q <= sm.length; q += .2) { const r = sm.at(q).p, d = Math.hypot(r[0] - p[0], r[1] - p[1]); if (d < bd) { bd = d; best = q; } } return best; };
    const stops = sched.stops.map((st) => ({...st, s: project(st.at), node: town.mapleHollow.nodes?.[st.id.replace(/-home$/, '')] ?? null}));
    const bus = {id: 'school-bus', kind: 'school-bus', scheduled: true, mapleHollow: true, line, regionalId: -1, forward: true, s: 0, speed: 0, maxSpeed: 4.2, length: 4.4, width: 1.6, turning: 0,
      status: 'Parked at the depot', position: [0, 0], direction: [0, 1], parked: true, run: null, done: null, visited: new Set(), dwell: 0, doorOpen: false, stopAt: null, pickup: [], dropoff: [], door: [0, 0], stopNode: null, stops};
    vehicles.push(bus); transit.vehicles.push(bus);
  }
  for (const v of vehicles) {
    place(v);
    v.positionAhead = (distance) => {
      const s = Math.max(v.line.start, Math.min(v.line.end, v.s + (v.forward ? distance : -distance)));
      const probe = {...v, s};
      place(probe);
      return probe.position;
    };
  }
  // Lines share road (several run up the airport road), so a car may spawn on
  // another: step it along its own line until it stands clear.
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i]; if (v.scheduled) continue;
    for (let k = 0; k < 40 && vehicles.slice(0, i).some((o) => Math.hypot(o.position[0] - v.position[0], o.position[1] - v.position[1]) < (o.length + v.length) / 2 + 2); k++) { v.s = Math.min(v.line.end - 1, v.s + 3.1); place(v); }
  }
  const events = {pedestrianYields: 0, junctionYields: 0, followed: 0, turnarounds: 0, railYields: 0, busStops: 0};
  // Level crossings (railway-loop): [{point, stop, closed}], point on the rail
  // centre line, stop = distance from it to the stop line.
  let stopLines = () => [];
  // Returns true when the scheduled vehicle is done for this tick (parked or dwelling).
  function scheduled(v, dt, hour) {
    if (v.parked) {
      const weekday = (4 + day) % 7 < 5, run = weekday && sched.runs.find((r) => hour >= r.depart && hour < r.depart + .6 && v.done !== r.id + ':' + day);
      if (!run) { v.speed = 0; return true; }
      Object.assign(v, {parked: false, run: run.id, pickup: run.pickup, dropoff: run.dropoff, visited: new Set(), forward: true, s: 0, status: 'Leaving the depot'});
    }
    if (v.doorOpen) {
      v.dwell += dt; v.speed = 0;
      const waiting = v.pickup.includes(v.stopAt) && transit.pending ? transit.pending(v.stopAt) : 0;
      if (v.dwell < sched.dwell || (waiting > 0 && v.dwell < sched.maxDwell)) { v.status = v.pickup.includes(v.stopAt) ? 'Boarding at the stop' : 'Dropping off'; return true; }
      v.visited.add(v.stopAt); v.doorOpen = false; v.stopAt = null;
    }
    return false;
  }
  function nextStop(v) {
    let best = null;
    for (const st of v.stops) {
      if (st.forward !== v.forward || v.visited.has(st.id) || !(v.pickup.includes(st.id) || v.dropoff.includes(st.id))) continue;
      const gap = v.forward ? st.s - v.s : v.s - st.s; if (gap < -.01) continue;
      if (!best || gap < best.gap) best = {st, gap};
    }
    return best;
  }
  function tick(dt, hour, pedestrians, others) {
    for (const j of junctions) {
      if (j.owner) { const v = j.owner, dx = j.point[0] - v.position[0], dz = j.point[1] - v.position[1]; if (dx * v.direction[0] + dz * v.direction[1] < -4 || Math.hypot(dx, dz) > 12) j.owner = null; }
    }
    for (const v of vehicles) {
      if (v.scheduled && scheduled(v, dt, hour)) continue;
      if (v.turning > 0) { v.turning = Math.max(0, v.turning - dt); v.speed = 0; place(v); continue; }
      const ahead = (q) => { const dx = q[0] - v.position[0], dz = q[1] - v.position[1]; return {along: dx * v.direction[0] + dz * v.direction[1], across: Math.abs(dx * v.direction[1] - dz * v.direction[0])}; };
      let clearance = Infinity, reason = 'Cruising';
      const horizons = v.scheduled ? [0, .5, 1, 1.5, 2] : [0, .5];
      for (const p of pedestrians) for (const h of horizons) {
        const a = ahead([p.x + (p.vx || 0) * h, p.z + (p.vz || 0) * h]);
        // A zebra spans both lanes. Hold short even while the walker is on the
        // opposite half of the road, including on the approach to a turn.
        const width = p.crossing ? 3.6 : v.width / 2 + (v.scheduled ? 1.1 : .6);
        const buffer = p.crossing ? 1.45 : .9;
        if (a.along > -.2 && a.along < 10 && a.across < width) {
          const gap = a.along - v.length / 2 - buffer;
          if (gap < clearance) { clearance = gap; reason = 'Yielding to pedestrian'; }
        }
      }
      for (const o of [...vehicles, ...others]) { if (o === v) continue; const a = ahead(o.position), align = v.direction[0] * o.direction[0] + v.direction[1] * o.direction[1];
        if (a.along > 0 && a.across < (v.width + o.width) / 2 + .3 && (align > .2 || a.along < (v.length + o.length) / 2 + 2.5)) { const gap = a.along - (v.length + o.length) / 2 - 1; if (gap < clearance) { clearance = gap; reason = 'Following traffic'; } } }
      for (const j of junctions) { const a = ahead(j.point); if (a.along < 0 || a.along > 9 || a.across > 3.5) continue;
        if (!j.owner) j.owner = v; if (j.owner !== v) { const gap = a.along - v.length / 2 - 4; if (gap < clearance) { clearance = gap; reason = 'Yielding at junction'; } } }
      for (const line of stopLines()) { if (!line.closed) continue; const a = ahead(line.point); if (a.across > 4 || a.along > 40) continue;
        const gap = a.along - v.length / 2 - line.stop; if (gap > -.4 && gap < clearance) { clearance = Math.max(0, gap); reason = 'Waiting at level crossing'; } }
      const left = v.forward ? v.line.end - v.s : v.s - v.line.start;
      if (v.scheduled) {
        // Look ahead along its own route (corners included): crawl through turns, and stop for anyone on the path.
        const probe = (k) => { const q = {...v, s: v.s + (v.forward ? k : -k)}; if (q.s < v.line.start || q.s > v.line.end) return null; place(q); return q; };
        for (const k of [1.5, 3, 4.5, 6, 7.5]) {
          const q = probe(k); if (!q) break;
          const turn = 1 - (q.direction[0] * v.direction[0] + q.direction[1] * v.direction[1]);
          if (turn > .15 && k - v.length / 2 < clearance + 3) { const crawl = k - 1.2; if (crawl < clearance) { clearance = Math.max(.6, crawl); reason = 'Turning the corner'; } }
          if (pedestrians.some((p) => Math.hypot(p.x - q.position[0], p.z - q.position[1]) < v.width / 2 + 1)) { const gap = k - v.length / 2 - .6; if (gap < clearance) { clearance = gap; reason = 'Yielding to pedestrian'; } break; }
        }
        const stop = nextStop(v);
        if (stop && stop.gap < clearance) { clearance = stop.gap; reason = 'Approaching stop'; }
        if (stop && stop.gap < .05) { const h = v.direction; Object.assign(v, {doorOpen: true, stopAt: stop.st.id, dwell: 0, speed: 0, stopNode: stop.st.node, door: [v.position[0] + h[1] * (v.width / 2 + 1.1), v.position[1] - h[0] * (v.width / 2 + 1.1)], status: 'At stop'}); events.busStops++; continue; }
        if (!v.forward && left < .05) { Object.assign(v, {parked: true, done: v.run + ':' + day, forward: true, s: 0, speed: 0, status: 'Parked at the depot'}); place(v); continue; }
        if (reason === 'Cruising' && left > 12) reason = v.run === 'morning' ? 'Morning school run' : 'Afternoon school run';
      }
      if (left < clearance) { clearance = left; if (reason === 'Cruising') reason = 'Turning around'; }
      if (left < .05) { v.forward = !v.forward; v.turning = TURN_TIME; events.turnarounds++; place(v); continue; }
      const factor = hour > 6 && hour < 21 ? 1 : .55, wanted = Math.min(v.maxSpeed * factor, Math.sqrt(Math.max(0, 2 * 3 * Math.max(0, clearance))));
      if (v.status !== reason && reason === 'Yielding to pedestrian') events.pedestrianYields++;
      if (v.status !== reason && reason === 'Yielding at junction') events.junctionYields++;
      if (v.status !== reason && reason === 'Waiting at level crossing') events.railYields++;
      v.status = reason; v.speed = Math.max(0, Math.min(wanted, v.speed + dt * 2.5));
      const travel = Math.max(0, Math.min(v.speed * dt, Math.max(0, clearance)));
      v.s += v.forward ? travel : -travel; place(v);
    }
  }
  return {lines, vehicles, junctions, events, transit, get day() { return day; },
    setStopLines(fn) { stopLines = typeof fn === 'function' ? fn : () => []; },
    update(dt, hour = 10, pedestrians = [], others = []) { if (!Number.isFinite(dt) || dt <= 0) return; if (lastHour !== null && lastHour > 23 && hour < 1) day++; lastHour = hour; let left = Math.min(dt, 1); while (left > 1e-8) { const step = Math.min(left, 1 / 30); tick(step, hour, pedestrians, others); left -= step; } },
    overlaps() { let n = 0; for (let i = 0; i < vehicles.length; i++) for (let j = i + 1; j < vehicles.length; j++) if (footprintsOverlap(footprint(vehicles[i]), footprint(vehicles[j]))) n++; return n; }};
}
