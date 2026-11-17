// Snap-together coaster kit layout. Pure geometry: tests import this without
// a renderer. Kit pieces are 4 source units long; one source unit is KIT_SCALE
// metres. Flat rail tops sit 1.05 units above a piece's base.
export const KIT_SCALE = 1.5;
export const TILE = 4 * KIT_SCALE;
const RAIL = 1.05;

// Rail-top centreline in source units for u ∈ [0,1] along the piece.
const PROFILES = {
 straight: u => [0, RAIL, -2 + 4 * u],
 up0: u => { const z = -2 + 4 * u; return [0, RAIL + (z + 2) ** 2 / 16, z]; },
 up: u => { const z = -2 + 4 * u; return [0, 2.05 + .5 * z, z]; },
 up1: u => { const z = -2 + 4 * u; return [0, 2.05 - (2 - z) ** 2 / 16, z]; },
 curve: u => { const a = Math.PI - u * Math.PI / 2; return [6 + 6 * Math.cos(a), RAIL, -2 + 6 * Math.sin(a)]; },
};
/**
 * Piece vocabulary. `rise` changes the flat-base level (source units). Down
 * pieces are the matching up pieces mirrored along their length; B curves are
 * A curves mirrored across. The model base sits at `level + base`.
 */
export const PIECES = {
 S: { asset: 'coaster_track', profile: 'straight', rise: 0 },
 ST: { asset: 'coaster_station', profile: 'straight', rise: 0, station: true },
 U0: { asset: 'coaster_track_slope_start', profile: 'up0', rise: 1 },
 U: { asset: 'coaster_track_slope', profile: 'up', rise: 2 },
 LIFT: { asset: 'coaster_track_lift', profile: 'up', rise: 2, lift: true },
 U1: { asset: 'coaster_track_slope_end', profile: 'up1', rise: 1 },
 D0: { asset: 'coaster_track_slope_end', profile: 'up1', rise: -1, mirrorZ: true },
 D: { asset: 'coaster_track_slope', profile: 'up', rise: -2, mirrorZ: true },
 D1: { asset: 'coaster_track_slope_start', profile: 'up0', rise: -1, mirrorZ: true },
 A: { asset: 'coaster_track_curve', profile: 'curve', rise: 0, turn: 1 },
 B: { asset: 'coaster_track_curve', profile: 'curve', rise: 0, turn: -1, mirrorX: true },
};

/**
 * Lay a closed circuit from a start cell and heading. Station cells (ST) use
 * one station model per pair; its built-in rail replaces two straights.
 */
export function layCoaster({ origin, heading, sequence }) {
 let cell = [0, 0], f = [...heading], level = 0;
 const pieces = [], centre = [], segments = [];
 let stationOpen = false;
 for (const [n, op] of sequence.entries()) {
  const spec = PIECES[op]; if (!spec) throw Error('Unknown coaster piece ' + op);
  const yaw = Math.atan2(f[0], f[1]);
  const right = [Math.cos(yaw), -Math.sin(yaw)];
  const position = [origin[0] + cell[0] * TILE, origin[1] + cell[1] * TILE];
  const base = spec.rise < 0 ? level + spec.rise : level;
  const sx = spec.mirrorX ? -1 : 1, sz = spec.mirrorZ ? -1 : 1;
  // Station models span two cells; the second ST adds rail but no model.
  const model = spec.station ? (stationOpen ? null : 'coaster_station') : spec.asset;
  stationOpen = spec.station ? !stationOpen : false;
  if (model) pieces.push({ index: n, op, asset: model, position, yaw, base: base * KIT_SCALE, scale: [KIT_SCALE * (spec.station ? -1 : sx), KIT_SCALE, KIT_SCALE * sz], mirrored: sx * sz * (spec.station ? -1 : 1) < 0, lift: !!spec.lift, cell: [...cell] });
  const samples = spec.profile === 'curve' ? 24 : 8, from = Math.max(0, centre.length - 1);
  for (let i = centre.length ? 1 : 0; i <= samples; i++) {
   // Mirrored-length pieces are the source piece traversed from its far end.
   const local = PROFILES[spec.profile](spec.mirrorZ ? 1 - i / samples : i / samples);
   const across = local[0] * sx, along = local[2] * sz, ly = local[1];
   const wx = position[0] + (across * right[0] + along * f[0]) * KIT_SCALE;
   const wz = position[1] + (across * right[1] + along * f[1]) * KIT_SCALE;
   centre.push({ x: wx, y: (base + ly) * KIT_SCALE, z: wz, lift: !!spec.lift, station: !!spec.station });
  }
  segments.push({ index: n, op, from, to: centre.length - 1 });
  // Advance: straights and slopes move one cell; curves one forward and two across.
  if (spec.turn) {
   const n2 = spec.turn > 0 ? [f[1], -f[0]] : [-f[1], f[0]];
   cell = [cell[0] + f[0] + 2 * n2[0], cell[1] + f[1] + 2 * n2[1]]; f = n2;
  } else cell = [cell[0] + f[0], cell[1] + f[1]];
  level += spec.rise;
 }
 return { pieces, centre, segments, end: { cell, heading: f, level } };
}

/**
 * Support towers for raised pieces, in world metres. Curves get two posts on
 * their arc; straights and slopes one at mid-length. Each tower stands on the
 * lawn (y 0) and its top meets the piece's model base, where the piece's own
 * legs take over. Local post points are source units on the unmirrored piece.
 */
export const SUPPORT_POSTS = { coaster_track_curve: [[.4, .16], [3.68, 3.53]] };
export function coasterSupports(pieces) {
 const out = [];
 for (const p of pieces) {
  if (p.base <= .01) continue;
  const posts = SUPPORT_POSTS[p.asset] ?? [[0, 0]];
  const sx = Math.sign(p.scale[0]), sz = Math.sign(p.scale[2]), c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  for (const [lx, lz] of posts) {
   const ax = lx * sx * KIT_SCALE, az = lz * sz * KIT_SCALE;
   out.push({ piece: p.index, x: p.position[0] + ax * c + az * s, z: p.position[1] - ax * s + az * c, yaw: p.yaw, height: p.base });
  }
 }
 return out;
}

/** Arc-length table over a closed centreline. */
export function coasterPath(centre) {
 const points = centre.slice(), lengths = [0];
 if (Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y, points[0].z - points.at(-1).z) < 1e-6) points.pop();
 for (let i = 1; i <= points.length; i++) { const a = points[i - 1], b = points[i % points.length]; lengths.push(lengths.at(-1) + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)); }
 const length = lengths.at(-1);
 function sample(distance) {
  const d = ((distance % length) + length) % length;
  let lo = 0, hi = lengths.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (lengths[m] <= d) lo = m; else hi = m; }
  const a = points[lo], b = points[hi % points.length], u = (d - lengths[lo]) / (lengths[hi] - lengths[lo] || 1);
  const t = [b.x - a.x, b.y - a.y, b.z - a.z], n = Math.hypot(...t) || 1;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u, z: a.z + (b.z - a.z) * u, tangent: t.map(v => v / n), lift: a.lift, station: a.station && b.station };
 }
 return { points, lengths, length, sample };
}

/**
 * Deterministic timetable: dwell in the station, chain up the lift at a
 * constant speed, then roll under gravity with friction. Precomputed so a
 * train never detaches from the rail at any frame rate.
 */
export function coasterTimetable(path, { dwell = 8, chain = 3.2, station = 2.2, gap }) {
 const steps = 1600, times = [0], top = Math.max(...path.points.map(p => p.y));
 for (let i = 1; i <= steps; i++) {
  const p = path.sample(path.length * (i - .5) / steps);
  const v = p.station ? station : p.lift ? chain : Math.max(4, Math.sqrt(2 * 9.81 * .82 * Math.max(0, top - p.y) + 16));
  times.push(times.at(-1) + path.length / steps / v);
 }
 const run = times.at(-1), period = run + dwell;
 function distanceAt(time) {
  const phase = ((time % period) + period) % period;
  if (phase < dwell) return 0;
  const travel = phase - dwell;
  let lo = 0, hi = steps;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (times[m] <= travel) lo = m; else hi = m; }
  return (lo + (travel - times[lo]) / (times[hi] - times[lo])) / steps * path.length;
 }
 return { period, run, dwell, distanceAt, gap: gap ?? period / 2 };
}
