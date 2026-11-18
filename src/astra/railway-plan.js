// OWNER: railway-loop lane. Loop Line timetable, train state, level-crossing
// state and the travellers who ride it. Pure functions of the town plan and
// the clock hour (no THREE, no DOM), shared by the renderer, the residents'
// rail guard, sim-collisions and the tests.
// Clock: 1 game hour = 90 simulated seconds at 1x (src/astra/clock.js).
import {RAIL, SERVICE, railPose, sidingPose, inTunnel, dist, polygonContains, RAIL_POIS, RAIL_DISTRICTS, hasMapleHollow} from '../compiler/railway.js';
import {walkBetween} from '../roads/pedestrian.js';

export const SECONDS_PER_HOUR = 90;
// Licensed Railway pack geometry bounds, in metres before the stock scale.
export const CONSIST = Object.freeze([
  ['steam_locomotive', 7.48, 1.44, 'engine', .7275],
  ['loco_tender', 2.935, 1.28, 'tender'],
  ['passenger_coach', 8.475, 1.484, 'passenger'],
  ['passenger_coach', 8.475, 1.484, 'passenger'],
  ['guards_coach', 3.755, 1.55, 'passenger'],
  ['mail_coach', 3.755, 1.50, 'freight'],
  ['freight_van', 3.335, 1.40, 'freight'],
  ['open_coal_wagon', 3.285, 1.36, 'freight'],
  ['container_flat_wagon', 3.635, 1.25, 'freight'],
].map(([asset, length, width, role, centre = 0]) => Object.freeze({
  asset, length: length * RAIL.stock, width: width * RAIL.stock, role, centre,
})));
export const COUPLING = .45;
export const TRAIN_LENGTH = CONSIST.reduce((n, c) => n + c.length, 0) + COUPLING * (CONSIST.length - 1);
const HALF = TRAIN_LENGTH / 2;
const wrap = (s, L) => ((s % L) + L) % L;
const rel = (a, b, L) => { let d = wrap(a - b, L); if (d > L / 2) d -= L; return d; };

/** Run time of a stop-to-stop leg on a trapezoid speed profile. */
function leg(from, to, rail) {
  const d = wrap(to - from, rail.length), tunnelShare = sharedTunnel(rail, from, d) / d;
  const v = tunnelShare > .5 ? SERVICE.tunnelCruise : SERVICE.cruise, a = SERVICE.accel;
  const full = v * v / a <= d, time = full ? d / v + v / a : 2 * Math.sqrt(d / a), top = full ? v : Math.sqrt(a * d);
  return {from, d, time, v: top, a};
}
function sharedTunnel(rail, from, d) { let n = 0; for (let x = 0; x < d; x += 2) if (inTunnel(rail, from + x)) n += 2; return Math.min(n, d); }
function legDistance(l, t) {
  const {a, v, d, time} = l, ta = v / a;
  if (t <= 0) return 0; if (t >= time) return d;
  if (t < ta) return .5 * a * t * t;
  if (t > time - ta) { const r = time - t; return d - .5 * a * r * r; }
  return .5 * a * ta * ta + v * (t - ta);
}

/** Complete laps fit inside the service day. Excess time is layover at Union. */
export function timetable(rail) {
  const order = [...rail.stations].sort((a, b) => a.s - b.s);
  const start = order.findIndex((st) => st.id === SERVICE.berth);
  const stops = [...order.slice(start), ...order.slice(0, start)];
  const legs = stops.map((st, i) => leg(st.s, stops[(i + 1) % stops.length].s, rail));
  const lap = legs.reduce((n, l) => n + l.time + SERVICE.dwell, 0);
  const first = SERVICE.first * SECONDS_PER_HOUR, end = SERVICE.last * SECONDS_PER_HOUR;
  const laps = Math.max(1, Math.floor((end - first) / lap));
  const interval = laps > 1 ? (end - first - lap) / (laps - 1) : lap;
  const departures = [];
  for (let k = 0; k < laps; k++) {
    let t = first + k * interval;
    for (const [i, st] of stops.entries()) {
      t += SERVICE.dwell;
      departures.push({lap: k, station: st.id, at: t, arriveNext: t + legs[i].time, next: stops[(i + 1) % stops.length].id});
      t += legs[i].time;
    }
  }
  return {stops, legs, lap, laps, interval, first, end: departures.at(-1).arriveNext, departures, length: rail.length};
}

// Reverse clear of the points, then pull forward on the other track.
const SHUNT_DISTANCE = 62;
const shunt = {d: SHUNT_DISTANCE, time: 2 * Math.sqrt(SHUNT_DISTANCE / .8), v: Math.sqrt(SHUNT_DISTANCE * .8), a: .8};

function shuntAt(berth, elapsed, toSiding, lap) {
  const reversing = elapsed < shunt.time;
  const t = reversing ? elapsed : elapsed - shunt.time;
  const offset = legDistance(shunt, t);
  const speed = Math.min(shunt.a * t, shunt.a * Math.max(0, shunt.time - t));
  return {
    s: berth.s - (reversing ? offset : SHUNT_DISTANCE - offset), speed,
    phase: 'shunt', station: berth.id, lap, doors: false, siding: reversing !== toSiding,
  };
}

/** Train state at a clock hour: centre arc length s, speed, phase, station. */
export function trainAt(rail, tt, hour) {
  const t = wrap(hour, 24) * SECONDS_PER_HOUR, berth = tt.stops[0];
  const startShunt = tt.first - 2 * shunt.time;
  const park = tt.end + SERVICE.dwell;
  if (t >= startShunt && t < tt.first) return shuntAt(berth, t - startShunt, false, -1);
  if (t >= tt.end && t < park) return {s: berth.s, speed: 0, phase: 'dwell', station: berth.id, lap: tt.laps - 1, doors: true};
  if (t >= park && t < park + 2 * shunt.time) return shuntAt(berth, t - park, true, tt.laps - 1);
  if (t < tt.first || t >= tt.end) return {s: berth.s, speed: 0, phase: 'rest', station: berth.id, lap: -1, doors: false, siding: true};
  const k = Math.floor((t - tt.first) / tt.interval); let u = t - tt.first - k * tt.interval;
  if (u >= tt.lap) return {s: berth.s, speed: 0, phase: 'layover', station: berth.id, lap: k, doors: false};
  for (let i = 0; i < tt.stops.length; i++) {
    if (u < SERVICE.dwell) return {s: tt.stops[i].s, speed: 0, phase: 'dwell', station: tt.stops[i].id, lap: k, doors: u > 3 && u < SERVICE.dwell - 3, dwellLeft: SERVICE.dwell - u};
    u -= SERVICE.dwell; const l = tt.legs[i];
    if (u < l.time) {
      const x = legDistance(l, u), x2 = legDistance(l, u + .1);
      return {s: wrap(l.from + x, rail.length), speed: (x2 - x) / .1, phase: 'run', station: null, next: tt.stops[(i + 1) % tt.stops.length].id, lap: k, doors: false};
    }
    u -= l.time;
  }
  return {s: berth.s, speed: 0, phase: 'rest', station: berth.id, lap: k, doors: false};
}

/** Each vehicle of the consist: centre pose, yaw and footprint. */
export function trainCars(rail, s, siding = false) {
  const pose = siding && rail.siding ? sidingPose : railPose;
  let front = s + HALF; const out = [];
  for (const c of CONSIST) {
    const mid = front - c.length / 2, a = pose(rail, mid + c.length * .32), b = pose(rail, mid - c.length * .32);
    const centre = [(a.p[0] + b.p[0]) / 2, (a.p[1] + b.p[1]) / 2], d = [a.p[0] - b.p[0], a.p[1] - b.p[1]], n = Math.hypot(...d) || 1;
    out.push({asset: c.asset, centre: c.centre, s: mid, pos: centre, y: (a.y + b.y) / 2, pitch: Math.atan2(a.y - b.y, n), dir: [d[0] / n, d[1] / n], yaw: Math.atan2(d[0], d[1]), length: c.length, width: c.width, hidden: inTunnel(rail, mid + c.length / 2) && inTunnel(rail, mid - c.length / 2)});
    front -= c.length + COUPLING;
  }
  return out;
}

// Barriers fall 60 m (over four seconds at line speed) before the engine reaches the
// road and rise once the last coach is 2 m clear of the deck.
export const CROSSING_WARN = 60;
export function crossingState(rail, c, train) {
  if (train.phase === 'rest') return {closed: false, lower: 0};
  const r = rel(c.s, train.s, rail.length); // + = crossing ahead of the train centre
  const ahead = r - HALF, behind = -r - HALF;
  if (ahead > CROSSING_WARN + 8 || behind > c.reach + 2) return {closed: false, lower: 0};
  const lower = ahead > CROSSING_WARN ? 1 - (ahead - CROSSING_WARN) / 8 : behind > c.reach ? 1 - (behind - c.reach) / 2 : 1;
  return {closed: lower > 0, lower: Math.max(0, Math.min(1, lower))};
}
/** True when q is on a level-crossing deck (the part of a road or footway that is also railway). */
export function onCrossingDeck(rail, c, q, pad = .6) {
  const v = [q[0] - c.pos[0], q[1] - c.pos[1]], across = Math.abs(v[0] * c.railDir[1] - v[1] * c.railDir[0]), along = v[0] * c.railDir[0] + v[1] * c.railDir[1];
  return across <= RAIL.half + pad && Math.abs(along) <= c.reach + 1;
}
/** Guard for walkers and drivers: may something step from a to b now? */
export function railClear(rail, states, a, b, pad = .6) {
  for (const [i, c] of rail.crossings.entries()) if (states[i]?.closed && onCrossingDeck(rail, c, b, pad) && !onCrossingDeck(rail, c, a, pad)) return false;
  return true;
}

/** A tiny deterministic random stream (independent of the town's). */
function rng(seed) { let x = (seed ^ 0x9e3779b9) >>> 0; return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

// Where a traveller comes from or heads to after the platform: a door or
// venue gate in the station's own neighbourhood.
function placeFor(town, st, pick, graph) {
  const choices = [...town.venues, ...town.buildings.map((b) => ({...b, entry: b.door}))]
    .filter((v) => v.entry && !v.id?.startsWith('rail-') && v.district === st.district && dist(v.entry, st.centre) < 80)
    .filter((v) => {
      const path = walkBetween(graph, v.entry, st.entry ?? UNION_GATE[0]);
      return 'cross' in path.at(-1);
    });
  return choices[Math.floor(pick() * choices.length)];
}

/**
 * Travellers for one day. Each walks from a place near the origin station along
 * the sidewalk graph to a platform spot, waits, boards when the doors open,
 * rides (hidden inside the coach), steps off at the destination and walks on
 * along the sidewalks. Positions come from `travellerAt(t, hour)`.
 */
export function planTravellers(town, rail, tt, graph, {count = 18, seed = town.seed} = {}) {
  const random = rng(seed * 31 + 7), out = [];
  const deps = tt.departures;
  for (let n = 0; n < count * 6 && out.length < count; n++) {
    const dep = deps[Math.floor(random() * (deps.length - 3))];
    const from = rail.stations.find((s) => s.id === dep.station);
    const hops = 1 + Math.floor(random() * 3), di = deps.indexOf(dep) + hops - 1, arrive = deps[di];
    const to = rail.stations.find((s) => s.id === arrive.next);
    if (to.id === from.id) continue;
    const start = placeFor(town, from, random, graph), end = placeFor(town, to, random, graph);
    if (!start || !end) continue;
    const spot = (st) => { const along = (random() - .5) * (st.length - 8), k = .35 + random() * .3; return [st.centre[0] + st.along[0] * along + st.out[0] * (k - .5) * (st.far - st.near), st.centre[1] + st.along[1] * along + st.out[1] * (k - .5) * (st.far - st.near)]; };
    const fromEntry = from.entry ?? platformGate(from), toEntry = to.entry ?? platformGate(to);
    const inboundWalk = walkBetween(graph, start.entry, fromEntry);
    const outboundWalk = walkBetween(graph, toEntry, end.entry);
    const exit = [spot(to), ...gateway(to).reverse()];
    const inbound = [...inboundWalk.map((p) => p.pos), ...gateway(from), spot(from)];
    const outbound = [...exit, ...outboundWalk.map((p) => p.pos)];
    const crossingEdges = (walk, offset = 0) => new Map(walk.flatMap((p, i) => p.cross ? [[i + offset, [walk[i - 1].pos, p.pos]]] : []));
    out.push({id: 'rail-traveller-' + n, from: from.id, to: to.id, depart: dep.at, arrive: arrive.arriveNext, inbound, outbound, inboundCrossings: crossingEdges(inboundWalk), outboundCrossings: crossingEdges(outboundWalk, exit.length), origin: start.id, destination: end.id, model: Math.floor(random() * 1e6)});
  }
  return out;
}
// Union's platform is reached from the station forecourt, through the hall.
export const UNION_GATE = [[-88, -147], [-80, -147], [-80, -159.4]];
function platformGate(st) { return st.id === 'union' ? UNION_GATE[0] : st.entry; }
function gateway(st) { return st.id === 'union' ? UNION_GATE.slice(1).map((p) => [...p]) : []; }

const WALK = 1.25;
/**
 * Precompute each traveller's walking timeline at 0.25 s resolution, holding
 * at a closed level crossing. Returns a sampler.
 */
export function travellerTimeline(rail, tt, travellers) {
  const dt = .25;
  const statesAt = (t) => { const train = trainAt(rail, tt, t / SECONDS_PER_HOUR); return rail.crossings.map((c) => crossingState(rail, c, train)); };
  const walk = (path, t0, crossings) => { // forward in time from t0
    const track = [{t: t0, p: [...path[0]]}]; let t = t0, p = [...path[0]], i = 1;
    while (i < path.length) {
      const q = path[i], d = dist(p, q), step = Math.min(d, WALK * dt), nxt = d > 1e-6 ? [p[0] + (q[0] - p[0]) * step / d, p[1] + (q[1] - p[1]) * step / d] : q;
      t += dt;
      if (!railClear(rail, statesAt(t), p, nxt)) { track.push({t, p: [...p], wait: true}); continue; }
      const crossing = crossings.get(i);
      p = nxt; if (d <= WALK * dt) i++;
      track.push({t, p: [...p], crossing});
    }
    return track;
  };
  return travellers.map((tr) => {
    // Inbound: leave early enough to be on the platform 20-60 s before the doors close.
    const len = tr.inbound.slice(1).reduce((n, q, i) => n + dist(q, tr.inbound[i]), 0), early = 25 + (tr.model % 40);
    let t0 = tr.depart - len / WALK - early, a = walk(tr.inbound, t0, tr.inboundCrossings);
    for (let tries = 0; tries < 6 && a.at(-1).t > tr.depart - 6; tries++) { t0 -= a.at(-1).t - (tr.depart - 6) + 10; a = walk(tr.inbound, t0, tr.inboundCrossings); }
    const b = walk(tr.outbound, tr.arrive + 4 + (tr.model % 7), tr.outboundCrossings);
    return {...tr, inboundTrack: a, outboundTrack: b};
  });
}
function sample(track, t) {
  if (t < track[0].t || t > track.at(-1).t) return null;
  const i = Math.min(track.length - 1, Math.max(0, Math.floor((t - track[0].t) / .25 + 1e-8)));
  const A = track[i], B = track[Math.min(i + 1, track.length - 1)], f = Math.max(0, Math.min(1, (t - A.t) / .25));
  return {pos: [A.p[0] + (B.p[0] - A.p[0]) * f, A.p[1] + (B.p[1] - A.p[1]) * f], facing: Math.atan2(B.p[0] - A.p[0], B.p[1] - A.p[1]), moving: dist(A.p, B.p) > 1e-4};
}
/** Visible traveller pose at clock hour (or null when indoors / riding). */
export function travellerAt(tr, hour) {
  const t = wrap(hour, 24) * SECONDS_PER_HOUR;
  const a = sample(tr.inboundTrack, t); if (a) return {...a, phase: 'to-platform'};
  const end = tr.inboundTrack.at(-1);
  if (t > end.t && t < tr.depart) return {pos: end.p, facing: 0, moving: false, phase: 'waiting'};
  if (t >= tr.depart && t < tr.outboundTrack[0].t) return null; // riding
  const b = sample(tr.outboundTrack, t); return b ? {...b, phase: 'from-platform'} : null;
}

// Timelines set the departure schedule and provide poses for clock seeks.
// During continuous play, each walker advances independently and waits at
// the curb before starting a crossing. Rail barriers use the live clock.
function advanceTraveller(state, track, seconds, clearRoad, clearRail) {
  while (seconds > 1e-8 && state.t < track.at(-1).t - 1e-8) {
    const index = Math.floor((state.t - track[0].t) * 4 + 1e-8);
    const b = track[index + 1];
    const step = Math.min(seconds, b.t - state.t);
    if (b.crossing && state.crossing !== b.crossing && !clearRoad(...b.crossing)) return false;
    const from = sample(track, state.t).pos, to = sample(track, state.t + step).pos;
    if (!clearRail(from, to)) return false;
    state.crossing = b.crossing;
    state.t = b.t - state.t - step < 1e-8 ? b.t : state.t + step;
    seconds -= step;
  }
  return true;
}

/** One object for everything that needs the railway at an hour. */
export function createRailwayService(town, graph) {
  const rail = town.railway, tt = timetable(rail);
  const travellers = graph ? travellerTimeline(rail, tt, planTravellers(town, rail, tt, graph)) : [];
  let hour = 0, train = trainAt(rail, tt, 0), states = rail.crossings.map(() => ({closed: false, lower: 0})), cars = trainCars(rail, train.s, train.siding);
  let clearRoad = () => true;
  const clear = (a, b, pad) => railClear(rail, states, a, b, pad);
  const walkers = new Map();
  return {
    rail, timetable: tt, travellers,
    setCrossingGuard(fn) { clearRoad = fn; },
    update(h, dt = 0) {
      if (h === hour && dt === 0) return this;
      const seek = h < hour || Math.abs((h - hour) * SECONDS_PER_HOUR - dt) > 1e-5;
      hour = h; train = trainAt(rail, tt, h);
      states = rail.crossings.map((c) => crossingState(rail, c, train));
      cars = trainCars(rail, train.s, train.siding);
      if (seek) walkers.clear();
      const now = hour * SECONDS_PER_HOUR;
      for (const tr of travellers) {
        let state = walkers.get(tr);
        const inboundEnd = tr.inboundTrack.at(-1).t;
        if (state?.track === tr.inboundTrack && now - dt >= tr.depart && state.t < inboundEnd - 1e-8) state.missed = true;
        const outbound = !state?.missed && now >= tr.outboundTrack[0].t;
        const track = outbound ? tr.outboundTrack : tr.inboundTrack;
        if (now < track[0].t || (!outbound && now >= tr.depart && !state?.missed)) {
          if (state) state.pose = null;
          continue;
        }
        if (state?.track !== track) {
          const t = seek ? Math.min(now, track.at(-1).t) : Math.max(track[0].t, now - dt);
          // A seek can place someone partway across a road. Let them finish
          // that crossing under the same rules as a continuously moving walker.
          const crossing = seek ? track[Math.ceil((t - track[0].t) * 4 - 1e-8)].crossing : undefined;
          state = {track, t, crossing};
          walkers.set(tr, state);
        }
        const moving = advanceTraveller(state, track, seek ? 0 : Math.min(dt, now - track[0].t), clearRoad, clear);
        const finished = state.t >= track.at(-1).t - 1e-8;
        const pose = sample(track, state.t);
        state.pose = finished && (outbound || state.missed) ? null : {
          ...pose, moving: moving && pose.moving, phase: outbound ? 'from-platform' : finished ? 'waiting' : 'to-platform',
        };
      }
      return this;
    },
    travellerPose(tr) { return walkers.get(tr)?.pose ?? null; },
    get pedestrians() {
      return travellers.flatMap((tr) => {
        const state = walkers.get(tr), pose = state?.pose;
        return pose ? [{id: tr.id, x: pose.pos[0], z: pose.pos[1], walking: true,
          crossing: Boolean(state.crossing && dist(pose.pos, state.crossing[1]) > .001),
          vx: pose.moving ? Math.sin(pose.facing) * WALK : 0, vz: pose.moving ? Math.cos(pose.facing) * WALK : 0}] : [];
      });
    },
    get hour() { return hour; }, get train() { return train; }, get crossings() { return states; }, get cars() { return cars; },
    clear,
  };
}

function areaCentre(points) {
  let area = 0, x = 0, z = 0;
  for (const [i, a] of points.entries()) {
    const b = points[(i + 1) % points.length], signed = a[0] * b[1] - b[0] * a[1];
    area += signed;
    x += (a[0] + b[0]) * signed;
    z += (a[1] + b[1]) * signed;
  }
  return [x / (3 * area), z / (3 * area)];
}

/** Measured limits used by the two Grand Loop town rules. */
export function grandLoopReview(town, graph, consist = CONSIST) {
  const rail = town.railway, polygon = rail.samples.map((q) => q.p);
  const maple = hasMapleHollow(town);
  const districtIds = maple ? [...RAIL_DISTRICTS, 'maple-hollow'] : RAIL_DISTRICTS;
  const enclosure = districtIds.map((id) => {
    const centre = id === 'pinewood' && town.woods ? areaCentre(town.woods.area) : town.districts.find((d) => d.id === id)?.center;
    return {id, centre, enclosed: Boolean(centre && polygonContains(polygon, centre))};
  });
  const stops = RAIL_POIS.filter((poi) => !poi.parcel || maple).map((poi) => {
    const st = rail.stations.find((s) => s.id === poi.station);
    const place = town.venues.find((v) => v.id === poi.place);
    const landmark = town.registry?.places.find((v) => v.id === poi.registry);
    const origin = poi.gate ?? place?.entry ?? landmark?.entryPoints?.[0]?.position;
    const station = town.venues.find((v) => v.id === st?.venue);
    const entry = station?.entry;
    const sign = st?.furniture.find((f) => f.asset === 'station_nameboard' && f.sign?.trim())?.sign;
    const path = origin && entry ? walkBetween(graph, origin, entry) : [];
    const linked = path.length > 0 && 'cross' in path.at(-1) && dist(path[0].pos, origin) < 5 && dist(path.at(-1).pos, entry) < .75;
    let distance = linked ? dist(origin, path[0].pos) + dist(entry, path.at(-1).pos) : Infinity;
    if (linked) {
      for (let i = 1; i < path.length; i++) distance += dist(path[i - 1].pos, path[i].pos);
      if (st.existing) {
        for (let i = 1; i < UNION_GATE.length; i++) distance += dist(UNION_GATE[i - 1], UNION_GATE[i]);
      } else {
        const firstLink = town.roads.find((r) => r.station === st.id && dist(r.a, entry) < .01);
        if (firstLink) {
          const flat = dist(firstLink.a, firstLink.b);
          distance += Math.hypot(flat, st.y + .57) - flat;
        }
      }
    }
    return {id: poi.id, station: poi.station, origin, entry, sign, linked, distance};
  });
  const trailing = consist.filter((c) => c.role === 'passenger' || c.role === 'freight').length;
  const tracedLength = polygon.reduce((n, p, i) => n + dist(p, polygon[(i + 1) % polygon.length]), 0);
  return {length: Math.min(rail.length, tracedLength), enclosure, enclosed: enclosure.filter((d) => d.enclosed).length / enclosure.length, trailing, stops};
}
