import * as THREE from 'three';
import {railPose} from '../compiler/railway.js';
import {terrainSurface} from '../compiler/terrain.js';
import {toonMaterial} from '../toon.js';
import {inkMesh} from './ink-mesh.js';

const CUT_HALF = 2.18;
const ROOF = 4.5;

export function trackSection(rail, from, to) {
  const samples = rail.samples.filter((q) => q.s > from && q.s < to);
  return [railPose(rail, from), ...samples, railPose(rail, to)];
}
const world = (q, lateral, rise = 0) => new THREE.Vector3(
  q.p[0] - q.d[1] * lateral, q.y + rise, q.p[1] + q.d[0] * lateral,
);

// Each pair of survey sections defines a convex excavation. In the open cuts
// the excavation reaches the sky. In the bore it stops just above the vault.
export function tunnelCuts(rail) {
  return rail.tunnels.flatMap(({approach: [a, d], s: [b, c]}) =>
    [[a, b, false], [b, c, true], [c, d, false]].flatMap(([from, to, covered]) => {
      const run = trackSection(rail, from, to);
      return run.slice(1).map((q, i) => {
        const prev = run[i];
        const corners = [world(prev, -CUT_HALF), world(prev, CUT_HALF), world(q, CUT_HALF), world(q, -CUT_HALF)];
        const centre = world(railPose(rail, (prev.s + q.s) / 2), 0, 1);
        const planes = corners.map((p, j) => {
          const next = corners[(j + 1) % 4];
          const normal = new THREE.Vector3(next.z - p.z, 0, p.x - next.x).normalize();
          const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, p);
          return plane.distanceToPoint(centre) < 0 ? plane.negate() : plane;
        });
        if (covered) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), Math.max(prev.y, q.y) + ROOF));
        // The ballast and bore floor sit above the unchanged mainland slab.
        const bounds = new THREE.Box3().setFromPoints(corners);
        bounds.min.y = -Infinity;
        bounds.max.y = covered ? Math.max(prev.y, q.y) + ROOF : Infinity;
        return {planes, bounds};
      });
    }));
}

function splitPolygon(polygon, plane) {
  const inside = [], outside = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const da = plane.distanceToPoint(a), db = plane.distanceToPoint(b);
    const keep = da >= -1e-7;
    (keep ? inside : outside).push(a);
    if (keep !== (db >= -1e-7)) {
      const edge = a.clone().lerp(b, da / (da - db));
      inside.push(edge);
      outside.push(edge);
    }
  }
  return {inside, outside};
}

/** Subtract each excavation from the actual terrain triangles. The resulting
 * opening is shared by colour, shadows, outlines and renderer raycasts. */
export function excavateHill(geometry, cuts) {
  geometry.computeBoundingBox();
  const local = cuts.filter((cut) => cut.bounds.intersectsBox(geometry.boundingBox));
  if (!local.length) return geometry;
  const attr = geometry.attributes.position, index = geometry.index;
  const positions = [];
  for (let i = 0; i < (index?.count ?? attr.count); i += 3) {
    const tri = [i, i + 1, i + 2].map((j) => new THREE.Vector3().fromBufferAttribute(attr, index ? index.getX(j) : j));
    const bounds = new THREE.Box3().setFromPoints(tri);
    let polygons = [tri];
    for (const cut of local) {
      if (!cut.bounds.intersectsBox(bounds)) continue;
      polygons = polygons.flatMap((polygon) => {
        // Reject faces wholly on the outer side of any clipping plane.
        if (cut.planes.some((plane) => polygon.every((p) => plane.distanceToPoint(p) < -1e-7))) return [polygon];
        const remainder = [];
        for (const plane of cut.planes) {
          const {inside, outside} = splitPolygon(polygon, plane);
          if (outside.length >= 3) remainder.push(outside);
          polygon = inside;
          if (polygon.length < 3) break;
        }
        return remainder;
      });
    }
    for (const p of polygons) for (let j = 2; j < p.length; j++) {
      positions.push(...p[0], ...p[j - 1], ...p[j]);
    }
  }
  return surfaceGeometry(positions);
}

function surfaceGeometry(positions) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function surface(rows, color) {
  const positions = [];
  for (let i = 1; i < rows.length; i++) for (let j = 1; j < rows[i].length; j++) {
    const a = rows[i - 1][j - 1], b = rows[i - 1][j], c = rows[i][j - 1], d = rows[i][j];
    positions.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const mesh = inkMesh(new THREE.Mesh(surfaceGeometry(positions), toonMaterial(color).clone()), .036);
  mesh.material.side = THREE.DoubleSide;
  mesh.receiveShadow = true;
  return mesh;
}

const strip = (run, section, color) => surface(run.map(section), color);

export function buildTunnelSurfaces(root, town) {
  const rail = town.railway, terrain = terrainSurface(town);
  for (const {id, approach, s} of rail.tunnels) {
    const bore = trackSection(rail, s[0], s[1]);
    // A dark masonry vault provides a continuous interior along the curve.
    const lining = strip(bore, (q) => [
      world(q, -2.05, -.04), world(q, -2.05, 2.6), world(q, -1.53, 3.57),
      world(q, 0, 4.05), world(q, 1.53, 3.57), world(q, 2.05, 2.6), world(q, 2.05, -.04),
    ], '#4d5048');
    lining.name = id + ' · stone bore';
    const floor = strip(bore, (q) => [world(q, -2.06, .018), world(q, 2.06, .018)], '#625a4e');
    floor.name = id + ' · gravel floor';
    root.add(lining, floor);
    for (const [start, end, mouth, into] of [[approach[0], s[0], s[0], 1], [s[1], approach[1], s[1], -1]]) {
      // Close the exposed cut above the masonry arch with earth, following the
      // undisturbed section of the hill a short distance behind the portal.
      const lip = railPose(rail, mouth + into * .07);
      const back = railPose(rail, mouth + into * 1.1);
      const columns = [-2.24, -1.7, -.9, 0, .9, 1.7, 2.24];
      const roof = (q) => columns.map((x) => {
        const p = world(q, x);
        p.y = terrain.height(p.x, p.z) + .025;
        return p;
      });
      const top = roof(lip);
      const spring = columns.map((x, i) => world(lip, x, Math.min(top[i].y - lip.y, 3.98 - .42 * (x / 2.24) ** 2)));
      const face = surface([spring, top], '#727b55');
      face.name = id + ' · exposed earth face';
      root.add(face, surface([top, roof(back)], '#97a26a'));
      const run = trackSection(rail, start, end);
      for (const side of [-1, 1]) {
        const berm = strip(run, (q) => {
          const blend = 1 - Math.abs(q.s - mouth) / (end - start);
          const at = (offset, y) => world(q, offset * side, y - q.y);
          const shoulder = at(3.6, 0);
          const hill = terrain.height(shoulder.x, shoulder.z);
          const edge = world(q, 4.05 * side);
          return [at(1.92, q.y + .04), at(2.38, Math.max(q.y + .1, hill * blend * .8)),
            at(3.6, Math.max(q.y + .1, hill + .04)), at(4.05, terrain.height(edge.x, edge.z) - .025)];
        }, side < 0 ? '#8b845e' : '#9d956b');
        berm.name = id + ' · earth berm';
        root.add(berm);
      }
    }
  }
}
