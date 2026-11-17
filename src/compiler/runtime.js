// Turn a compiled town into three.js objects. Browser-only (imports the loader
// and builders). buildTown(town, scene) adds the world (sky/hills/ground),
// the plaza disk and every instance, resolving async mesh loads before the
// returned Promise settles.
import * as THREE from 'three';
import { batchInstances } from './batches.js';
import { place, instantiate, RESOLVED } from '../catalog/loader.js';
import { PALETTE, toonMaterial } from '../toon.js';
import { occupiedHillBounds } from './hills.js';
import { makeGround, makeHills, makeSky, makePath } from '../builders.js';

function plazaDisk(radius) {
  const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), toonMaterial(PALETTE.grassDark));
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = 0.02; // just above makeGround's green patch
  disk.receiveShadow = true;
  return disk;
}

export function buildTown(town, scene) {
  scene.add(makeSky());
  const extent = town.area.shape === 'circle' ? town.area.radius : Math.hypot(town.area.w, town.area.d) / 2;
  const groundRadius = Math.max(70, extent + 15);
  const edo = town.instances.some(i => i.district === 'edo');
  scene.add(makeHills(groundRadius / 70, edo ? occupiedHillBounds(town, RESOLVED) : []));
  // One opening for the joined pond/stream bed: lowering water below grass
  // requires removing the grass underneath, otherwise it masks the channel.
  const water = town.instances.filter(i => ['edo-koi-pond-tile','edo-garden-stream-tile'].includes(i.id));
  const cutouts = water.length ? [{
    min: [Math.min(...water.map(i => i.pos[0]-2.5)), Math.min(...water.map(i => i.pos[1]-2.5))],
    max: [Math.max(...water.map(i => i.pos[0]+2.5)), Math.max(...water.map(i => i.pos[1]+2.5))],
  }] : [];
  scene.add(makeGround(groundRadius, cutouts));
  if (edo) scene.add(makePath(-48, -100, 48, -100, 8.2));

  const loads = [];
  const batches = new Map();
  const paramsFor = inst => inst.kind === 'gate'
    ? { ...(inst.params || {}), ...(inst.width != null ? { width: inst.width } : {}), ...(inst.open != null ? { open: inst.open } : {}) }
    : inst.params;
  const batchKey = inst => `${inst.id}:${JSON.stringify(paramsFor(inst) || {})}`;
  if (town.instances.some(i => i.street)) {
    for (const inst of town.instances) {
      // Villagers always keep a real object for their individual idle motion.
      if (inst.kind === 'villager') continue;
      if (!RESOLVED.has(inst.id) || !['tree', 'bush', 'fence', 'gate', 'prop', 'paving'].includes(inst.kind)) continue;
      const key = batchKey(inst);
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(inst);
    }
    for (const [key, list] of batches) {
      if (list.length < 2) { batches.delete(key); continue; }
      loads.push(instantiate(list[0].id, { params: paramsFor(list[0]) }).then(template => { const batch = batchInstances(template, list); scene.add(batch); return batch; }));
    }
  }
  for (const inst of town.instances) {
    if (inst.kind === 'plaza') { scene.add(plazaDisk(inst.radius)); continue; }
    if (batches.has(batchKey(inst))) continue;
    const [x, z] = inst.pos;
    // Gates carry their gap width / swing as top-level instance fields.
    const params = paramsFor(inst);
    loads.push(
      place(inst.id, { x, z, rotY: inst.rotY, params, scale: inst.scale || 1 })
        .then((obj) => { if (inst.pavingWidth) obj.scale.x *= inst.pavingWidth / 5; obj.userData.inst = inst; scene.add(obj); return obj; }),
    );
  }
  return Promise.all(loads);
}
