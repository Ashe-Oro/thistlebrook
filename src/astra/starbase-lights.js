// OWNER: night-landmarks lane. Starbase Texas after dark: tower floods and sky
// beams, the glowing tank farm, red aviation beacons, lit hulls, pads, LZ rings
// and the apron necklace (fixtures: night-landmarks.js starbaseFixtures()).
// Built after batchStatic, so nothing here is merged into the static batches.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toonMaterial, outlineMaterial} from '../toon.js';
import {starbaseFixtures} from './night-landmarks.js';
import {buildLandmarkGlow, setLandmarkNight} from './landmark-glow.js';

const HOUSING = '#4f646c';

// Day fixtures for the lights that need a body: searchlight drums on the pad
// corners and a housing behind every tower flood lens. One toon draw + ink.
function housings(fixtures) {
  const parts = [];
  for (const f of fixtures) {
    if (f.prim === 'searchlight') parts.push(new THREE.CylinderGeometry(f.radius * .85, f.radius, f.height, 14).translate(...f.pos));
    if (f.prim === 'lens' && f.kind === 'tower-flood') {
      const d = new THREE.Vector3(...f.facing), g = new THREE.BoxGeometry(f.size[0] + .16, f.size[1] + .16, .45);
      g.translate(0, 0, -.2).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d)).translate(...f.pos);
      parts.push(g);
    }
  }
  const flat = parts.map((g) => { const n = g.toNonIndexed(); g.dispose(); n.deleteAttribute('uv'); return n; });
  const geometry = mergeGeometries(flat); flat.forEach((g) => g.dispose());
  const group = new THREE.Group(); group.name = 'Night landmarks • Starbase fixtures';
  const body = new THREE.Mesh(geometry, toonMaterial(HOUSING)); body.castShadow = body.receiveShadow = true;
  const ink = new THREE.Mesh(geometry, outlineMaterial(.04)); ink.userData.outline = true;
  group.add(body, ink);
  return group;
}

/** `follow`: rocket roots (ship, booster, f9, upper, side0, side1) and the strongback. */
export function buildStarbaseLights(root, {follow} = {}) {
  const fixtures = starbaseFixtures(), glow = buildLandmarkGlow(fixtures, {name: 'Starbase', follow});
  const group = new THREE.Group(); group.name = 'Starbase night lights';
  group.add(housings(fixtures), glow.group); root.add(group);
  return {
    group, glow, fixtures,
    update(t, night = 0) { setLandmarkNight(night, t); glow.update(); },
  };
}
