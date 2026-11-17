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
    let pts = line.points; const trim = [touchesTown(pts[0]) ? 7 : 0, touchesTown(pts.at(-1)) ? 7 : 0];
    const s = sampler(pts); return {...line, sampler: s, start: trim[0], end: s.length - trim[1]};
  }).filter((l) => l.end - l.start > 20);
  // Junctions shared by several regional roads: one vehicle at a time.
  const ends = new Map(); for (const r of roads) for (const p of [r.a, r.b]) { const k = p.map((v) => v.toFixed(2)).join(','); ends.set(k, (ends.get(k) || 0) + 1); }
  const junctions = [...ends.entries()].filter(([, n]) => n >= 3 || n === 2).map(([k]) => ({point: k.split(',').map(Number), owner: null}))
    .filter((j) => roads.filter((r) => [r.a, r.b].some((p) => Math.hypot(p[0] - j.point[0], p[1] - j.point[1]) < .05)).length >= 3);
  const vehicles = [];
  lines.forEach((line) => {
    const usable = line.end - line.start, count = Math.max(1, Math.round(usable / 90));
    for (let i = 0; i < count; i++) {
      const bus = i === 1 && usable > 45, forward = i % 2 === 0;
      vehicles.push({id: 'regional-' + vehicles.length, kind: bus ? 'bus' : 'car', line, regionalId: line.roads[0], forward, s: line.start + usable * ((i + .5) / count), speed: 0, maxSpeed: bus ? 5 : 6.5, length: bus ? 4.6 : 2.9, width: bus ? 1.8 : 1.35, turning: 0, status: 'Cruising', position: [0, 0], direction: [0, 1]});
    }
  });
  const place = (v) => {
    const {p, d} = v.line.sampler.at(v.s), edge = Math.min(v.s - v.line.start, v.line.end - v.s), lane = LANE * Math.min(1, Math.max(0, edge / END_TAPER)), side = v.forward ? 1 : -1;
    v.position = [p[0] + d[1] * lane * side, p[1] - d[0] * lane * side];
    const heading = v.forward ? d : [-d[0], -d[1]];
    if (v.turning > 0) { const f = v.turning / TURN_TIME, a0 = Math.atan2(heading[0], heading[1]) + Math.PI * f; v.direction = [Math.sin(a0), Math.cos(a0)]; } else v.direction = heading;
  };
  vehicles.forEach(place);
  const events = {pedestrianYields: 0, junctionYields: 0, followed: 0, turnarounds: 0};
  function tick(dt, hour, pedestrians, others) {
    for (const j of junctions) {
      if (j.owner) { const v = j.owner, dx = j.point[0] - v.position[0], dz = j.point[1] - v.position[1]; if (dx * v.direction[0] + dz * v.direction[1] < -4 || Math.hypot(dx, dz) > 12) j.owner = null; }
    }
    for (const v of vehicles) {
      if (v.turning > 0) { v.turning = Math.max(0, v.turning - dt); v.speed = 0; place(v); continue; }
      const ahead = (q) => { const dx = q[0] - v.position[0], dz = q[1] - v.position[1]; return {along: dx * v.direction[0] + dz * v.direction[1], across: Math.abs(dx * v.direction[1] - dz * v.direction[0])}; };
      let clearance = Infinity, reason = 'Cruising';
      for (const p of pedestrians) for (const h of [0, .5]) { const a = ahead([p.x + (p.vx || 0) * h, p.z + (p.vz || 0) * h]); if (a.along > -.2 && a.along < 10 && a.across < v.width / 2 + .6) { const gap = a.along - v.length / 2 - .9; if (gap < clearance) { clearance = gap; reason = 'Yielding to pedestrian'; } } }
      for (const o of [...vehicles, ...others]) { if (o === v) continue; const a = ahead(o.position), align = v.direction[0] * o.direction[0] + v.direction[1] * o.direction[1];
        if (a.along > 0 && a.across < (v.width + o.width) / 2 + .3 && (align > .2 || a.along < (v.length + o.length) / 2 + 2.5)) { const gap = a.along - (v.length + o.length) / 2 - 1; if (gap < clearance) { clearance = gap; reason = 'Following traffic'; } } }
      for (const j of junctions) { const a = ahead(j.point); if (a.along < 0 || a.along > 9 || a.across > 3.5) continue;
        if (!j.owner) j.owner = v; if (j.owner !== v) { const gap = a.along - v.length / 2 - 4; if (gap < clearance) { clearance = gap; reason = 'Yielding at junction'; } } }
      const left = v.forward ? v.line.end - v.s : v.s - v.line.start;
      if (left < clearance) { clearance = left; if (reason === 'Cruising') reason = 'Turning around'; }
      if (left < .05) { v.forward = !v.forward; v.turning = TURN_TIME; events.turnarounds++; place(v); continue; }
      const factor = hour > 6 && hour < 21 ? 1 : .55, wanted = Math.min(v.maxSpeed * factor, Math.sqrt(Math.max(0, 2 * 3 * Math.max(0, clearance))));
      if (v.status !== reason && reason === 'Yielding to pedestrian') events.pedestrianYields++;
      if (v.status !== reason && reason === 'Yielding at junction') events.junctionYields++;
      v.status = reason; v.speed = Math.max(0, Math.min(wanted, v.speed + dt * 2.5));
      const travel = Math.max(0, Math.min(v.speed * dt, Math.max(0, clearance)));
      v.s += v.forward ? travel : -travel; place(v);
    }
  }
  return {lines, vehicles, junctions, events,
    update(dt, hour = 10, pedestrians = [], others = []) { if (!Number.isFinite(dt) || dt <= 0) return; let left = Math.min(dt, 1); while (left > 1e-8) { const step = Math.min(left, 1 / 30); tick(step, hour, pedestrians, others); left -= step; } },
    overlaps() { let n = 0; for (let i = 0; i < vehicles.length; i++) for (let j = i + 1; j < vehicles.length; j++) if (footprintsOverlap(footprint(vehicles[i]), footprint(vehicles[j]))) n++; return n; }};
}
