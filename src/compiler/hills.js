// Runtime backdrop placement, shared with geometry checks. No compiled hills.
import { obbFromRect, obbPointDistance, rectXZ } from './geometry.js';
export const HILL_SPOTS = [
  [-45,-8,-55,18], [40,-6,-60,22], [0,-10,-70,30],
  [-62,-7,-30,16], [60,-9,-20,20], [-30,-6,-48,14],
];
export function occupiedHillBounds(town, catalog) {
  return town.instances.flatMap(i => {
    const e = catalog.get(i.id);
    if (!e) return [];
    const rect = i.kind === 'path'
      ? { min: [-i.params.width/2,-i.params.length/2], max: [i.params.width/2,i.params.length/2] }
      : e.lot || rectXZ(e.bounds);
    return [obbFromRect(rect, { x:i.pos[0], z:i.pos[1], rotY:i.rotY }, i.scale || 1)];
  });
}
export function hillCircle(h, surfaceY = 0) {
  // Ellipsoid: horizontal radius R, vertical radius R/2, centre cy < 0.
  return h.r * Math.sqrt(Math.max(0, 1 - ((surfaceY-h.y)/(h.r/2)) ** 2));
}
export function hillClearanceFailures(hills, occupied, margin = 0, surfaceY = 0.05) {
  return hills.flatMap((h, index) => occupied.filter(o => obbPointDistance(o, [h.x,h.z]) < hillCircle(h,surfaceY)+margin-1e-7).map(o => ({ index, box:o })));
}
export function hillLayout(scale = 1, occupied = [], margin = 10) {
  return HILL_SPOTS.map(([x,y,z,r]) => {
    const h = { x:x*scale, y:y*scale, z:z*scale, r:r*scale };
    const original = Math.hypot(h.x,h.z), ux = h.x/original, uz = h.z/original;
    const required = hillCircle(h)+margin;
    if (!occupied.some(o => obbPointDistance(o,[h.x,h.z]) < required)) return h;
    // Find a clear point beyond all boxes, then bisect along the original bearing.
    // Distance is convex along this ray; beyond the final exit it stays clear.
    let low = original, high = original;
    for (const o of occupied) high = Math.max(high, Math.hypot(...o.c)+Math.hypot(o.hu,o.hv)+required+1);
    for (let n=0;n<60;n++) {
      const mid = (low+high)/2;
      if (occupied.some(o => obbPointDistance(o,[ux*mid,uz*mid]) < required)) low=mid;
      else high=mid;
    }
    return { ...h, x:ux*high, z:uz*high };
  });
}
