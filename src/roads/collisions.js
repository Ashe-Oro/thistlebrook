// OWNER: grok-roads lane. Vehicle footprints and crossing safety (pure).
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
/** Oriented rectangle of a vehicle: {c, d (unit heading), hl, hw}. */
export function footprint(v) {
  const d = v.direction || [Math.sin(v.yaw), Math.cos(v.yaw)], c = v.position || v.center;
  return {c, d, hl: v.length / 2, hw: v.width / 2};
}
export function footprintsOverlap(a, b, pad = 0) {
  const axes = [a.d, [-a.d[1], a.d[0]], b.d, [-b.d[1], b.d[0]]], t = [b.c[0] - a.c[0], b.c[1] - a.c[1]];
  for (const ax of axes) {
    const ra = Math.abs(dot(a.d, ax)) * a.hl + Math.abs(dot([-a.d[1], a.d[0]], ax)) * a.hw;
    const rb = Math.abs(dot(b.d, ax)) * b.hl + Math.abs(dot([-b.d[1], b.d[0]], ax)) * b.hw;
    if (Math.abs(dot(t, ax)) > ra + rb + pad) return false;
  }
  return true;
}
export function pointInFootprint(p, f, pad = 0) {
  const t = [p[0] - f.c[0], p[1] - f.c[1]];
  return Math.abs(dot(t, f.d)) <= f.hl + pad && Math.abs(dot(t, [-f.d[1], f.d[0]])) <= f.hw + pad;
}
const segDist = (p, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (dx * dx + dz * dz || 1))); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz); };
/** A pedestrian may step from a to b (across a carriageway) only when no
 * vehicle is on or approaching the crossing. */
export function crossingClear(a, b, vehicles) {
  for (const v of vehicles) {
    const c = v.position, d = segDist(c, a, b);
    if (d < v.length / 2 + 1.2) return false; // already on the crossing
    if (d > 16) continue;
    const toward = [((a[0] + b[0]) / 2) - c[0], ((a[1] + b[1]) / 2) - c[1]], dir = v.direction;
    const approaching = dot(toward, dir) > 0, moving = (v.speed || 0) > .15;
    if (approaching && (moving || d < 6)) return false;
  }
  return true;
}
