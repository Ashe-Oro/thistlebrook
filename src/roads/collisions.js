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
    // A parked car (a bay or a driveway) blocks only a crossing it actually stands on (opus-suburb).
    if (v.parked) { if (d < v.width / 2 + .3) return false; continue; }
    // A car that has stopped to let people cross waves them over, unless its bumper is
    // within half a metre of the crossing (opus-suburb: a courtesy deadlock at the bus-stop crosswalks).
    const speed = v.speed ?? v.speedNow ?? 0;
    const waving = speed <= .15 && v.status === 'Yielding to pedestrian';
    if (d < v.length / 2 + (waving ? .5 : 1.2)) return false; // already on the crossing
    if (d > Math.max(16, speed * 5.5)) continue;
    const toward = [((a[0] + b[0]) / 2) - c[0], ((a[1] + b[1]) / 2) - c[1]];
    const approaching = dot(toward, v.direction) > 0;
    // A vehicle may be facing away from the zebra before turning onto it.
    if ((v.kind === 'cycle' || !approaching) && speed > .15 && v.positionAhead) {
      const reach = v.kind === 'cycle' ? 12 : Math.max(5, speed * 5.5);
      for (let distance = .5; distance <= reach; distance += .5) {
        if (segDist(v.positionAhead(distance), a, b) < v.length / 2 + 1.2) return false;
      }
    }
    // A bus dwelling at its stop with the doors open is about to pull away: treat it as moving (opus-suburb).
    const moving = speed > .15 || v.doorOpen;
    if (approaching && (moving || (d < 6 && !waving))) return false;
  }
  return true;
}

// Distance from a point to the oriented body. A zone stays occupied until
// the complete footprint clears its perimeter.
export function vehicleInZone(v, point, radius) {
  const dx = point[0] - v.position[0], dz = point[1] - v.position[1];
  const [x, z] = v.direction;
  const along = Math.max(0, Math.abs(dx * x + dz * z) - v.length / 2);
  const across = Math.max(0, Math.abs(dx * z - dz * x) - v.width / 2);
  return along * along + across * across < radius * radius;
}

/** Guard a simulation substep against vehicles from any system. The
 * broad-phase extent comes from both bodies, including long trucks. */
export function sweepBlocker(vehicle, next, vehicles) {
  const candidate = footprint(next);
  for (const other of vehicles) {
    if (other === vehicle) continue;
    const dx = other.position[0] - next.position[0], dz = other.position[1] - next.position[1];
    const reach = (vehicle.length + vehicle.width + other.length + other.width) / 2 + .05;
    if (Math.abs(dx) > reach || Math.abs(dz) > reach) continue;
    if (footprintsOverlap(candidate, footprint(other), .035)) return other;
  }
  return null;
}

/** Break a circular wait for reservations, without bypassing physical clearance. */
export function releaseWaitCycles(vehicles, zones, events) {
  for (const vehicle of vehicles) {
    if (vehicle.speed > .02 || !vehicle.blockedBy) continue;
    const seen = new Set();
    let current = vehicle;
    while (current?.speed <= .02 && current.blockedBy) {
      if (seen.has(current)) {
        if (current !== vehicle) break;
        const cycle = [...seen].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', {numeric:true}));
        if (cycle[0] !== vehicle) break;
        const transferable = zones.find(zone => zone.owner === vehicle.blockedBy
          && (zone.points??[zone.point]).every(p=>!vehicleInZone(zone.owner,p,zone.radius??4)));
        if (transferable) {
          transferable.owner = vehicle;
          events.push({allowed:vehicle.id, cycle:cycle.map(v => v.id), at:transferable.point});
        }
        break;
      }
      seen.add(current);
      current = current.blockedBy;
    }
  }
}
