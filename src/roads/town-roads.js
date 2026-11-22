import {vehicleModel} from '../astra/traffic-fleet.js';
// OWNER: grok-roads lane. Town carriageway hygiene (pure; no THREE, no DOM).
//
// Downtown streets are authored as short pieces. Where exactly two pieces of
// the same street class meet in a straight line, the narrower one used to keep
// its own width, so the kerb stepped in mid-block. A straight run now carries
// one width (the widest piece's); real junctions and class changes keep theirs.
const key = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
export const isTownCarriageway = (r) => r.kind === 'avenue' || (!r.owner && !r.external && r.kind === 'lane' && r.width >= 2.4);

export const WEST_LOOP = Object.freeze({west: -144, north: -90, south: -33, stationAvenue: -115});
export const BUS_ROUTES = {
  town:[[-66,-16],[-36,-16],[-36,-15],[-22,-15],[-22,-33],[46,-33],[46,4],[22,4],[22,-15],[-22,-15],[-22,4],[-66,4]],
  station:[[WEST_LOOP.stationAvenue,-139],[-42,-139],[-42,-103],[-105,-103],[-105,-77],[-80,-77],[-80,WEST_LOOP.south],
    [WEST_LOOP.west,WEST_LOOP.south],[WEST_LOOP.west,WEST_LOOP.north],[WEST_LOOP.stationAvenue,WEST_LOOP.north]],
};
export const TOWN_LANE_OFFSET = .89;
export const CIVIC_CYCLE_OFFSET = 1.72;

// The City bus is broad for its length. Leave room on both sides of the
// centre line for its full model width and the adjacent lane.
export function widenBusStreets(roads) {
  const width = 2 * TOWN_LANE_OFFSET + vehicleModel('city-bus').width + .08;
  const runs = Object.values(BUS_ROUTES).flatMap(points => points.map((a, i) => [a, points[(i + 1) % points.length]]));
  for (const road of roads.filter(isTownCarriageway)) {
    const axis = road.a[0] === road.b[0] ? 1 : 0;
    const other = 1 - axis;
    if (road.a[other] !== road.b[other]) continue;
    if (runs.some(([a, b]) => a[other] === road.a[other] && b[other] === road.a[other]
      && Math.max(Math.min(a[axis], b[axis]), Math.min(road.a[axis], road.b[axis]))
        < Math.min(Math.max(a[axis], b[axis]), Math.max(road.a[axis], road.b[axis])))) {
      road.width = Math.max(road.width, width);
    }
  }
}

export function unifyStraightRuns(town) {
  const roads = town.roads.filter(isTownCarriageway), ends = new Map();
  for (const r of roads) for (const p of [r.a, r.b]) { const k = key(p); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(r); }
  const dir = (r, p) => { const q = key(r.a) === key(p) ? r.b : r.a, d = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [(q[0] - p[0]) / d, (q[1] - p[1]) / d]; };
  const changed = [];
  for (let pass = 0, again = true; again && pass < 20; pass++) {
    again = false;
    for (const [k, list] of ends) {
      if (list.length !== 2) continue;
      const [r, s] = list, p = key(r.a) === k ? r.a : r.b;
      if (r.kind !== s.kind || Math.abs(r.width - s.width) < .01) continue;
      const u = dir(r, p), v = dir(s, p); if (u[0] * v[0] + u[1] * v[1] > -.995) continue; // not straight
      const w = Math.max(r.width, s.width); for (const x of [r, s]) if (x.width !== w) { changed.push({a: x.a, b: x.b, from: x.width, to: w}); x.width = w; again = true; }
    }
  }
  return changed;
}
