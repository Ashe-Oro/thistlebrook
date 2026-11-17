// 2D geometry on the XZ ground plane for the compiler and checks. Pure JS, no
// three.js. Points are [x, z]; a "rect" is a local-frame AABB { min:[x,z],
// max:[x,z] } (as resolved footprint / lot / bounds-XZ); an OBB is that rect
// rotated+translated by a placement { x, z, rotY }.

import { math as Math } from './math.js';

export const TAU = Math.PI * 2;

/** Local [x,z] -> world [x,z] under a placement. Matches schema.toWorld's XZ. */
export function toWorldXZ([lx, lz], { x = 0, z = 0, rotY = 0 }) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return [x + lx * c + lz * s, z - lx * s + lz * c];
}

/** Rotate a local direction [x,z] by rotY (no translation). */
export function rotDir([dx, dz], rotY) {
  const c = Math.cos(rotY), s = Math.sin(rotY);
  return [dx * c + dz * s, -dx * s + dz * c];
}

/** OBB from a local rect + placement, with an optional extra uniform scale. */
export function obbFromRect(rect, place, scale = 1) {
  const cx = ((rect.min[0] + rect.max[0]) / 2) * scale;
  const cz = ((rect.min[1] + rect.max[1]) / 2) * scale;
  const hu = ((rect.max[0] - rect.min[0]) / 2) * scale;
  const hv = ((rect.max[1] - rect.min[1]) / 2) * scale;
  const [wx, wz] = toWorldXZ([cx, cz], place);
  return {
    c: [wx, wz],
    u: rotDir([1, 0], place.rotY || 0), // world axis for local X
    v: rotDir([0, 1], place.rotY || 0), // world axis for local Z
    hu, hv,
  };
}

/** XZ rect from a 3D bounds { min:[x,y,z], max:[x,y,z] }. */
export const rectXZ = (b) => ({ min: [b.min[0], b.min[2]], max: [b.max[0], b.max[2]] });

export function obbCorners(o) {
  const out = [];
  for (const su of [-1, 1]) for (const sv of [-1, 1]) {
    out.push([
      o.c[0] + su * o.hu * o.u[0] + sv * o.hv * o.v[0],
      o.c[1] + su * o.hu * o.u[1] + sv * o.hv * o.v[1],
    ]);
  }
  return out;
}

function projRadius(o, ax) {
  return Math.abs(o.u[0] * ax[0] + o.u[1] * ax[1]) * o.hu
       + Math.abs(o.v[0] * ax[0] + o.v[1] * ax[1]) * o.hv;
}

/** SAT overlap of two OBBs; `gap` inflates both (require that much clearance). */
export function obbOverlap(a, b, gap = 0) {
  for (const ax of [a.u, a.v, b.u, b.v]) {
    const d = Math.abs((b.c[0] - a.c[0]) * ax[0] + (b.c[1] - a.c[1]) * ax[1]);
    if (d - projRadius(a, ax) - projRadius(b, ax) - gap >= 0) return false; // separated
  }
  return true;
}

/** Signed separation of two OBBs: >=0 apart (max axis gap), <0 overlapping. */
export function obbSeparation(a, b) {
  let maxGap = -Infinity;
  for (const ax of [a.u, a.v, b.u, b.v]) {
    const d = Math.abs((b.c[0] - a.c[0]) * ax[0] + (b.c[1] - a.c[1]) * ax[1]);
    const gap = d - projRadius(a, ax) - projRadius(b, ax);
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

/** Distance from a point to an OBB (0 if inside). */
export function obbPointDistance(o, p) {
  const dx = p[0] - o.c[0], dz = p[1] - o.c[1];
  const lu = Math.abs(dx * o.u[0] + dz * o.u[1]) - o.hu;
  const lv = Math.abs(dx * o.v[0] + dz * o.v[1]) - o.hv;
  return Math.hypot(Math.max(lu, 0), Math.max(lv, 0));
}

export const obbContainsPoint = (o, p) => obbPointDistance(o, p) === 0;

/** Distance from point p to segment a-b. */
export function segPointDistance(a, b, p) {
  const abx = b[0] - a[0], abz = b[1] - a[1];
  const len2 = abx * abx + abz * abz || 1e-9;
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * abz) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + abx * t), p[1] - (a[1] + abz * t));
}

export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function norm([x, z]) { const l = Math.hypot(x, z) || 1; return [x / l, z / l]; }

/** Is a point inside the area, shrunk by `margin`? circle or rect. */
export function pointInArea(area, [x, z], margin = 0) {
  if (area.shape === 'rect') return Math.abs(x) <= area.w / 2 - margin && Math.abs(z) <= area.d / 2 - margin;
  return Math.hypot(x, z) <= area.radius - margin;
}

/** Centreline segment endpoints [A, B] of a path strip (length along local Z). */
export function strutEnds(p) {
  const { pos, rotY } = p;
  const length = p.length ?? p.params?.length ?? 0;
  const d = rotDir([0, 1], rotY);
  return [
    [pos[0] - (d[0] * length) / 2, pos[1] - (d[1] * length) / 2],
    [pos[0] + (d[0] * length) / 2, pos[1] + (d[1] * length) / 2],
  ];
}

/** Solid side volumes of an inspected walk-under portal, in local world units.
 * Its overhead lintel still participates in full-mesh placement separation. */
export function walkingRects(entry) {
  const r = rectXZ(entry.bounds);
  if (!entry.walkOpening) return [r];
  return [
    { min: r.min, max: [-entry.walkOpening / 2, r.max[1]] },
    { min: [entry.walkOpening / 2, r.min[1]], max: r.max },
  ];
}
