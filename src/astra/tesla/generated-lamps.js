import * as THREE from 'three';

const probeMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
const PROUD = .0015;
const STEPS = 16;

// The bands follow the lamp heights of the generated noses and rear decks,
// measured as a fraction of each mesh's height above the ground.
const bands = {
  sedan: [.43, .49], crossover: [.43, .55], cybercab: [.37, .52],
  cybertruck: [.44, .55], semi: [.28, .22], roadster: [.46, .53],
  'model-s': [.42, .52], 'model-x': [.42, .53],
};

export function generatedLamps(kind, mesh, { width, height, length }, scale) {
  const halfWidth = width * scale / 2, halfLength = length * scale / 2;
  const probe = new THREE.Mesh(mesh.geometry, probeMaterial);
  probe.matrixWorld.copy(mesh.matrixWorld);
  const ray = new THREE.Raycaster(), origin = new THREE.Vector3(), direction = new THREE.Vector3();

  function makeLamp(end, band, ranges, color) {
    const vertices = [], spots = [];
    direction.set(0, 0, -end);
    const surface = (x, y) => {
      ray.set(origin.set(x, y, end * (halfLength + 1)), direction);
      return ray.intersectObject(probe, false)[0]?.point.z;
    };
    const halfHeight = Math.min(.013, height * scale * .02);
    for (const [from, to] of ranges) {
      // Project each strip onto its face. Recesses and rounded corners
      // therefore follow the mesh, and the halo sits on the actual strip.
      let best = [];
      for (const adjustment of [0, -.05, .05, -.12, .12, -.20, .20]) {
        const y = height * scale * (band + adjustment);
        let run = [];
        for (let i = 0; i <= STEPS; i++) {
          const x = halfWidth * THREE.MathUtils.lerp(from, to, i / STEPS);
          const bottom = surface(x, y - halfHeight), top = surface(x, y + halfHeight);
          if (bottom === undefined || top === undefined) { run = []; continue; }
          run.push([[x, y - halfHeight, bottom + end * PROUD], [x, y + halfHeight, top + end * PROUD]]);
          if (run.length > best.length) best = run.slice();
        }
        if (best.length >= STEPS * .8) break;
      }
      if (best.length < 2) continue;
      for (let i = 1; i < best.length; i++) {
        const [a, b] = best[i - 1], [c, d] = best[i];
        vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      for (const fraction of end > 0 ? [.5] : [.2, .8]) {
        const [low, high] = best[Math.round((best.length - 1) * fraction)];
        spots.push(low.map((value, axis) => (value + high[axis]) / 2));
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    return { geometry, material, spots };
  }
  // The Roadster tail is a continuous, almost full-width light bar.
  const rear = kind === 'roadster' ? .96 : .78;
  return {
    head: makeLamp(1, bands[kind][0], [[-.76, -.30], [.30, .76]], '#e5eedc'),
    tail: makeLamp(-1, bands[kind][1], [[-rear, rear]], '#fa7961'),
  };
}
