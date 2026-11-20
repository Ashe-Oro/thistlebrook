// OWNER: night-landmarks lane. The Roadster proving ground after dark: six
// stadium masts with lamp banks and wide cones, grandstand and sign lighting,
// LED track edges, and bright lamps + beams on the parked lineup and the
// performing Roadster (fixtures: night-landmarks.js arenaFixtures()).
// Lives in its own group so the arena's toon batches, grandstandBounds and
// audit() are untouched.
import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {toonMaterial, outlineMaterial} from '../../toon.js';
import {arenaFixtures, mastFrame, MAST_BANK, LANDMARK_LOOK} from '../night-landmarks.js';
import {buildLandmarkGlow, setLandmarkNight, landmarkEmitterLevel} from '../landmark-glow.js';
import {DEMO} from './demo-motion.js';

const STEEL = '#6f8985', INK = '#304b4c';

// Toon steel masts: plinth, tapered pole, cross-arm, and an ink lamp bank of
// eight housings on a backing frame, turned and tilted toward the aim point.
function masts(fixtures) {
  const steel = [], ink = [];
  const oriented = (w, h, d, f, at) => new THREE.BoxGeometry(w, h, d).applyMatrix4(new THREE.Matrix4().makeBasis(new THREE.Vector3(...f.right), new THREE.Vector3(...f.up), new THREE.Vector3(...f.forward))).translate(...at);
  for (const m of fixtures.filter((x) => x.prim === 'mast')) {
    const [x, , z] = m.pos, f = mastFrame({x, z, height: m.height, aim: m.aim}), H = m.height;
    const at = (p, v, k) => p.map((c, i) => c + v[i] * k);
    steel.push(new THREE.BoxGeometry(1.1, .45, 1.1).translate(x, .22, z));
    steel.push(new THREE.CylinderGeometry(.15, .24, H + 1.2, 10).translate(x, .45 + (H + 1.2) / 2, z));
    steel.push(new THREE.BoxGeometry(3.5, .18, .2).rotateY(f.yaw).translate(x + Math.sin(f.yaw) * .2, H + .25, z + Math.cos(f.yaw) * .2));
    for (const s of [-1, 1]) steel.push(oriented(.12, 1.5, .12, f, at(at(f.centre, f.right, s * 1.45), f.forward, -.15)));
    ink.push(oriented(3.1, 1.32, .1, f, at(f.centre, f.forward, -.2)));
    for (const u of MAST_BANK.columns) for (const v of MAST_BANK.rows) ink.push(oriented(...MAST_BANK.housing, f, at(at(f.centre, f.right, u), f.up, v)));
  }
  const group = new THREE.Group(); group.name = 'Night landmarks • Arena masts';
  for (const [color, parts] of [[STEEL, steel], [INK, ink]]) {
    const flat = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.deleteAttribute('uv'); return n; });
    const geometry = mergeGeometries(flat); flat.forEach((g) => g.dispose());
    const body = new THREE.Mesh(geometry, toonMaterial(color)); body.castShadow = body.receiveShadow = true;
    const hull = new THREE.Mesh(geometry, outlineMaterial(.035)); hull.userData.outline = true;
    group.add(body, hull);
  }
  return group;
}

/** `signs`: the board label materials (front/back name + phase caption). */
export function buildArenaLights(root, {signs = []} = {}) {
  const fixtures = arenaFixtures();
  // The performing Roadster: a matrix-only proxy rebuilt from the show pose
  // (object at pose, scale carScale, pivot .43 above the contact point).
  const roadster = new THREE.Object3D(); roadster.matrixAutoUpdate = false;
  const glow = buildLandmarkGlow(fixtures, {name: 'Roadster arena', follow: {roadster}});
  const group = new THREE.Group(); group.name = 'Roadster arena night lights';
  const structure = masts(fixtures);
  group.add(structure, glow.group); root.add(group);
  const lift = new THREE.Matrix4().makeTranslation(0, .43, 0), drop = new THREE.Matrix4().makeTranslation(0, -.43, 0);
  const place = new THREE.Matrix4(), turn = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3().setScalar(DEMO.carScale), one = new THREE.Quaternion();
  return {
    group, glow, fixtures, masts: structure, roadster, signs,
    update(time, pose, night = 0) {
      setLandmarkNight(night, time);
      if (pose) {
        place.compose(p.set(pose.localX, pose.y, pose.localZ), one, s);
        turn.makeRotationFromQuaternion(q.fromArray(pose.orientation));
        roadster.matrix.copy(place).multiply(lift).multiply(turn).multiply(drop);
      }
      glow.update();
      const k = 1 + LANDMARK_LOOK.sign * landmarkEmitterLevel();
      for (const m of signs) m.color.setScalar(k);
    },
    // Shared landmark materials and unit geometries stay alive (module-level).
    dispose() {
      structure.traverse((o) => { if (o.isMesh && !o.userData.outline) o.geometry.dispose(); });
      glow.meshes.emitters?.geometry.dispose();
      for (const m of glow.meshList) if (m.isInstancedMesh) m.dispose();
      group.removeFromParent();
    },
  };
}
