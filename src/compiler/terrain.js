// Raised terrain the renderer draws above the mainland slab: the Pinecrest
// range (cones, snow caps and boulder rings, src/astra/themepark.js), the
// seeded landscape mountains and meadow hills (src/astra/landscape.js) and the
// Pinewood ridge heightfield (src/compiler/woods.js). Each mesh is rebuilt here
// with the renderer's exact transforms so the railway can measure the rock
// above a tunnel bore and the ground beside open track. Pure: THREE maths only.
import * as THREE from 'three';
import {PARK_MOUNTAINS} from '../astra/themepark-plan.js';
import {terrainY, GROUND_TOP} from './woods.js';

const cone = new THREE.ConeGeometry(1, 1, 7, 1), rock = new THREE.IcosahedronGeometry(1, 0), hill = new THREE.IcosahedronGeometry(1, 1);

/** Park peaks in render order: [{id, x, z, w, h, parts: [{geometry, position, scale, rotY}]}]. */
export function parkPeaks(mountains = PARK_MOUNTAINS) {
  return mountains.map(([x, z, w, h], i) => ({
    id: 'pinecrest-peak-' + i, x, z, w, h, parts: [
      {geometry: cone, position: [x, h / 2 - .2, z], scale: [w, h, w * .8], rotY: x},
      {geometry: cone, position: [x, h * .84, z], scale: [w * .33, h * .33, w * .8 * .33], rotY: x},
      ...Array.from({length: 6}, (_, k) => {
        const a = k / 6 * Math.PI * 2;
        return {geometry: rock, position: [x + Math.sin(a) * w * .8, 2, z + Math.cos(a) * w * .65], scale: [4, 3, 4], rotY: 0, boulder: true};
      }),
    ],
  }));
}

/** Seeded landscape hills, as drawn by src/astra/landscape.js. */
export function landscapeHills(town) {
  return (town.landscape?.hills ?? []).map((h, i) => ({
    id: h.registryId ?? 'landscape:hill-' + i, x: h.pos[0], z: h.pos[1], w: h.radius, h: h.height, mountain: h.mountain, parts: h.mountain
      ? [{geometry: cone, position: [h.pos[0], h.height / 2 - .1, h.pos[1]], scale: [h.radius, h.height, h.radius * .8], rotY: 0},
        {geometry: cone, position: [h.pos[0], h.height * .85, h.pos[1]], scale: [h.radius * .3, h.height * .3, h.radius * .24], rotY: 0}]
      : [{geometry: hill, position: [h.pos[0], -h.height * .22, h.pos[1]], scale: [h.radius, h.height, h.radius * .8], rotY: 0}],
  }));
}

const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
ray.firstHitOnly = true;

/**
 * Height sampler over every raised terrain mesh. `options.peaks` / `options.hills`
 * replace the inventories (fault injection lowers or removes a hill this way).
 * Returns {height(x, z) -> y or GROUND_TOP, peaks, hills, hit(x, z) -> {y, id}}.
 */
export function terrainSurface(town, {peaks = parkPeaks(), hills = landscapeHills(town), ridge = true} = {}) {
  const items = [...peaks, ...hills].map((item) => {
    const group = new THREE.Group();
    for (const p of item.parts) {
      const m = new THREE.Mesh(p.geometry);
      m.position.set(...p.position); m.scale.set(...p.scale); m.rotation.y = p.rotY;
      group.add(m);
    }
    group.updateMatrixWorld(true);
    const reach = Math.max(item.w, ...item.parts.map((p) => Math.hypot(p.position[0] - item.x, p.position[2] - item.z) + Math.max(p.scale[0], p.scale[2])));
    return {item, group, reach};
  });
  const grid = new Map(), cell = 16;
  for (const it of items) {
    for (let gx = Math.floor((it.item.x - it.reach) / cell); gx <= Math.floor((it.item.x + it.reach) / cell); gx++)
      for (let gz = Math.floor((it.item.z - it.reach) / cell); gz <= Math.floor((it.item.z + it.reach) / cell); gz++) {
        const k = gx + ',' + gz; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(it);
      }
  }
  function hit(x, z) {
    let best = {y: ridge ? terrainY(x, z) : GROUND_TOP, id: 'ground'};
    if (ridge && best.y > GROUND_TOP + 1e-6) best.id = 'woods:ridge';
    for (const it of grid.get(Math.floor(x / cell) + ',' + Math.floor(z / cell)) ?? []) {
      if (Math.hypot(x - it.item.x, z - it.item.z) > it.reach) continue;
      from.set(x, 400, z); ray.set(from, down);
      const h = ray.intersectObject(it.group, true)[0];
      if (h && h.point.y > best.y) best = {y: h.point.y, id: it.item.id};
    }
    return best;
  }
  return {height: (x, z) => hit(x, z).y, hit, peaks, hills};
}
