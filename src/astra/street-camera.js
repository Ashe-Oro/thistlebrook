import * as THREE from 'three';

export const STREET_ZOOM_MAX = 45;
export const STREET_EYE_HEIGHT = 1.8;
export const STREET_LOOK_TILT = .68;
export const STREET_DEFAULT_PITCH = -.07;
const clearance = .42;
const cellSize = 16;
const pitchMin = THREE.MathUtils.degToRad(-27);
const pitchMax = THREE.MathUtils.degToRad(50);

export const streetPitch = pitch => THREE.MathUtils.clamp(pitch, pitchMin, pitchMax);
export const streetYaw = yaw => THREE.MathUtils.euclideanModulo(yaw + Math.PI, 2 * Math.PI) - Math.PI;

export function streetCollision(town, catalogHeight, { terrain = [], groundHeight = () => 0 } = {}) {
  const cells = new Map();
  let highest = 0;
  const cell = coordinate => Math.floor(coordinate / cellSize);
  const key = (x, z) => `${x},${z}`;
  // Treat steep, sculpted hills as solids using their render bounds. Pinewood
  // has a heightfield, so its trails can be walked using the sampled surface.
  const hills = terrain.flatMap(hill => hill.parts.map(({geometry, position, scale, rotY}) => {
    const transform = new THREE.Matrix4().makeRotationY(rotY).scale(new THREE.Vector3(...scale));
    transform.setPosition(...position);
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const box = geometry.boundingBox.clone().applyMatrix4(transform);
    return { box: { min: [box.min.x, box.min.z], max: [box.max.x, box.max.z] }, height: box.max.y };
  })).filter(hill => hill.height > 0);
  for (const item of [...town.buildings, ...town.venues, ...hills]) {
    const { box } = item;
    if (!box) continue;
    const height = item.height ?? catalogHeight(item) ?? 8;
    const solid = {
      minX: box.min[0] - clearance, maxX: box.max[0] + clearance,
      minZ: box.min[1] - clearance, maxZ: box.max[1] + clearance,
      top: Math.max(height, STREET_EYE_HEIGHT) + clearance,
    };
    highest = Math.max(highest, solid.top);
    for (let x = cell(solid.minX); x <= cell(solid.maxX); x++) {
      for (let z = cell(solid.minZ); z <= cell(solid.maxZ); z++) {
        const id = key(x, z);
        if (!cells.has(id)) cells.set(id, []);
        cells.get(id).push(solid);
      }
    }
  }

  function nearby(x, z, dx = 0, dz = 0) {
    const x0 = cell(Math.min(x, x + dx)), x1 = cell(Math.max(x, x + dx));
    const z0 = cell(Math.min(z, z + dz)), z1 = cell(Math.max(z, z + dz));
    if (x0 === x1 && z0 === z1) return cells.get(key(x0, z0)) ?? [];
    const solids = new Set();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        for (const solid of cells.get(key(cx, cz)) ?? []) solids.add(solid);
      }
    }
    return solids;
  }

  function blocking(x, z) {
    return (cells.get(key(cell(x), cell(z))) ?? []).filter(solid =>
      x > solid.minX && x < solid.maxX && z > solid.minZ && z < solid.maxZ);
  }

  // Walk each cardinal ray out of the union of overlapping footprints, then
  // choose the shortest exit. Navigation bounds include a margin around solids.
  function land(x, z, out) {
    const occupied = blocking(x, z);
    out.set(x, 0, z);
    if (!occupied.length) return out;
    let best = Infinity;
    for (const [axis, edge, sign] of [['x', 'minX', -1], ['x', 'maxX', 1], ['z', 'minZ', -1], ['z', 'maxZ', 1]]) {
      let px = x, pz = z, solids = occupied;
      while (solids.length) {
        const advance = sign < 0 ? Math.min : Math.max;
        for (const solid of solids) {
          if (axis === 'x') px = advance(px, solid[edge] + sign * .001);
          else pz = advance(pz, solid[edge] + sign * .001);
        }
        solids = blocking(px, pz);
      }
      const distance = Math.abs(px - x) + Math.abs(pz - z);
      if (distance < best) { best = distance; out.set(px, 0, pz); }
    }
    return out;
  }

  // Swept point against expanded slabs. Large moves cannot tunnel through a
  // facade. A zero component permits moving parallel to a wall already touched.
  function fraction(x, z, dx, dz, height, roofBlend = 0) {
    if ((!dx && !dz) || height >= highest + roofBlend) return 1;
    let safe = 1;
    for (const solid of nearby(x, z, dx, dz)) {
      if (height >= solid.top + roofBlend) continue;
      if (!dx && (x <= solid.minX || x >= solid.maxX)) continue;
      if (!dz && (z <= solid.minZ || z >= solid.maxZ)) continue;
      const ax = dx ? (solid.minX - x) / dx : -Infinity;
      const bx = dx ? (solid.maxX - x) / dx : Infinity;
      const az = dz ? (solid.minZ - z) / dz : -Infinity;
      const bz = dz ? (solid.maxZ - z) / dz : Infinity;
      const enter = Math.max(Math.min(ax, bx), Math.min(az, bz));
      const exit = Math.min(Math.max(ax, bx), Math.max(az, bz));
      if (exit <= Math.max(0, enter) || enter >= safe) continue;
      const overRoof = roofBlend ? THREE.MathUtils.smoothstep(height, solid.top, solid.top + roofBlend) : 0;
      safe = Math.min(safe, THREE.MathUtils.lerp(Math.max(0, enter), 1, overRoof));
    }
    return safe;
  }
  return { land, fraction, floor: (x, z) => Math.max(0, groundHeight(x, z)) };
}

// Interpolate homogeneous W from parallel rays to perspective. Depth is solved
// at the clip planes after the blend so NDC depth stays valid throughout.
export function streetProjection(camera, tilt, mapZoom, armDepth, overheadNear, overheadFar) {
  const blend = THREE.MathUtils.smoothstep(tilt, 0, .72);
  const focus = Math.max(9, armDepth);
  const aspect = (camera.right - camera.left) / (camera.top - camera.bottom);
  // Hold a 40° horizontal minimum in portrait so both street edges stay visible.
  const lens = Math.min(Math.tan(THREE.MathUtils.degToRad(42)),
    Math.max(Math.tan(THREE.MathUtils.degToRad(31)), Math.tan(THREE.MathUtils.degToRad(20)) / aspect));
  const halfHeight = THREE.MathUtils.lerp((camera.top - camera.bottom) / (2 * mapZoom),
    9 * lens, THREE.MathUtils.smoothstep(tilt, .35, 1));
  const near = camera.near = THREE.MathUtils.lerp(overheadNear, .08, tilt);
  const far = camera.far = THREE.MathUtils.lerp(overheadFar, 750, THREE.MathUtils.smoothstep(tilt, .25, 1));
  const parallel = 1 - blend, perspective = blend / focus;
  const nearW = parallel + perspective * near, farW = parallel + perspective * far;
  const depthScale = (farW + nearW) / (far - near);
  camera.projectionMatrix.set(
    1 / (halfHeight * aspect), 0, 0, 0,
    0, 1 / halfHeight, 0, 0,
    0, 0, -depthScale, -nearW - depthScale * near,
    0, 0, -perspective, parallel,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
}

// Two points from the inverse projection handle all stages of the blend.
export function mapCameraRay(raycaster, point, camera) {
  if (camera.isOrthographicCamera) { raycaster.setFromCamera(point, camera); return; }
  const { ray } = raycaster;
  ray.origin.set(point.x, point.y, -1).unproject(camera);
  ray.direction.set(point.x, point.y, .5).unproject(camera).sub(ray.origin).normalize();
  raycaster.camera = camera;
}
