// Crosswalk dimensions shared by the graph, pavement renderer and audit.
export const WALK_GAP = .55;
export const ZEBRA_HALF_WIDTH = .55;
export const addScaled = (p, d, s) => [p[0] + d[0] * s, p[1] + d[1] * s];
export const minus = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
export const normal = ([x, z]) => [-z, x];
export const direction = (a, b) => {
  const delta = minus(b, a);
  const length = Math.hypot(...delta) || 1;
  return [delta[0] / length, delta[1] / length];
};
export const midpoint = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

/** Find the carriageway crossed at the midpoint using its actual paved axis. */
export function crossingRoad(index, a, b) {
  const center = midpoint(a, b), across = direction(a, b);
  return index.near(center).find((road) => {
    if (road.turningCircle) return false;
    const along = direction(road.a, road.b), offset = minus(center, road.a);
    const station = dot(offset, along);
    return station >= -.02 && station <= Math.hypot(...minus(road.b, road.a)) + .02
      && Math.abs(dot(offset, normal(along))) < .08 && Math.abs(dot(along, across)) < .035;
  });
}

export function spansCurbs(index, road, a, b) {
  const offset = Math.hypot(...minus(a, b)) / 2;
  return Math.abs(offset - road.hw - WALK_GAP) < .09
    && [a, b].every((p) => index.depth(p) <= -.32);
}

/** Test the whole painted band against intersecting or branching pavement. */
export function inJunction(index, road, a, b) {
  const center = midpoint(a, b), along = direction(road.a, road.b), across = normal(along);
  return index.near(center, road.hw + WALK_GAP).some((other) => {
    const axis = direction(other.a, other.b);
    if (other === road || Math.abs(dot(along, axis)) > .995) return false;
    const length = Math.hypot(...minus(other.b, other.a));
    for (const side of [-1, 0, 1]) {
      const strip = addScaled(center, along, side * ZEBRA_HALF_WIDTH);
      for (let step = -4; step <= 4; step++) {
        const p = addScaled(strip, across, (road.hw + WALK_GAP) * step / 4);
        const delta = minus(p, other.a), station = Math.max(0, Math.min(length, dot(delta, axis)));
        if (Math.hypot(...minus(p, addScaled(other.a, axis, station))) < other.hw + .15) return true;
      }
    }
    return false;
  });
}
