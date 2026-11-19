import * as THREE from 'three';
import { place } from '../catalog/loader.js';
import { toonMaterial } from '../toon.js';
import { CLIP } from '../life/animation-plan.js';
import { createVillagerMixer } from '../life/villager-mixer.js';
import { tagDistrictModels } from './registry/district-models.js';
import { fairgroundModel } from './themepark-assets.js';
import { BAND, FESTIVAL_GATE, FESTIVAL_STALLS, STAGE_HEIGHT } from './festival-plan.js';

const ink = '#283e47', brass = '#e4b66b', cream = '#fff0cd', coral = '#bd5b51', blue = '#498d94';
const cube = new THREE.BoxGeometry();
const sphere = new THREE.SphereGeometry(1, 12, 8);
const drum = new THREE.CylinderGeometry(1, 1, 1, 24);
const dummy = new THREE.Object3D();

function mesh(root, geometry, color, position, scale = [1, 1, 1]) {
  const object = new THREE.Mesh(geometry, toonMaterial(color));
  object.position.set(...position);
  object.scale.set(...scale);
  object.castShadow = object.receiveShadow = true;
  root.add(object);
  return object;
}
const box = (root, color, pos, size) => mesh(root, cube, color, pos, size);
const ball = (root, color, pos, scale) => mesh(root, sphere, color, pos, scale);
const cylinder = (root, color, pos, radius, height) => mesh(root, drum, color, pos, [radius, height, radius]);

function rod(root, color, from, to, radius = .035) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const object = cylinder(root, color, a.clone().lerp(b, .5).toArray(), radius, a.distanceTo(b));
  object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return object;
}

function instances(root, geo, material, count) {
  const batch = new THREE.InstancedMesh(geo, material, count);
  root.add(batch);
  return batch;
}
function instanceAt(batch, i, position, scale, yaw = 0) {
  dummy.position.set(...position);
  dummy.scale.set(...scale);
  dummy.rotation.set(0, yaw, 0);
  dummy.updateMatrix();
  batch.setMatrixAt(i, dummy.matrix);
}

// Batch repeated meshes in the space of their instrument or speaker group;
// the batches still move with the performer and share the normal cel material.
function batchParts(root, parts) {
  const batches = new Map();
  for (const part of parts) {
    const key = part.geometry.uuid + part.material.uuid;
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(part);
  }
  for (const group of batches.values()) {
    if (group.length === 1) continue;
    const [first] = group;
    const batch = instances(root, first.geometry, first.material, group.length);
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    group.forEach((part, i) => {
      part.updateMatrix();
      batch.setMatrixAt(i, part.matrix);
      root.remove(part);
    });
  }
}

function stringInstrument(root, isBass) {
  const guitar = new THREE.Group();
  guitar.position.set(-.18, .98, .34);
  guitar.rotation.z = -.54;
  root.add(guitar);
  const shape = new THREE.Shape();
  shape.moveTo(-.12, .27);
  shape.bezierCurveTo(-.4, .4, -.43, .11, -.28, .02);
  shape.bezierCurveTo(-.17, -.06, -.44, -.18, -.28, -.37);
  shape.bezierCurveTo(-.17, -.52, .19, -.48, .3, -.35);
  shape.bezierCurveTo(.48, -.17, .18, -.04, .26, .09);
  shape.bezierCurveTo(.36, .29, .12, .33, .12, .2);
  shape.lineTo(-.12, .27);
  const body = new THREE.ExtrudeGeometry(shape, {depth: .09, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 2, curveSegments: 8});
  mesh(guitar, body, isBass ? blue : coral, [0, 0, 0]);
  ball(guitar, cream, [.09, -.09, .106], [.2, .26, .014]);
  const neck = isBass ? .8 : .66;
  box(guitar, '#806346', [0, neck / 2 + .08, .055], [.115, neck, .09]);
  box(guitar, ink, [0, neck + .14, .05], [.18, .23, .11]);
  box(guitar, ink, [0, -.25, .113], [.23, .075, .04]);
  for (let i = 0; i < (isBass ? 4 : 6); i++) {
    const x = (i - (isBass ? 1.5 : 2.5)) * .013;
    rod(guitar, cream, [x, -.23, .145], [x, neck + .16, .114], .004);
  }
  for (let i = 0; i < 5; i++) box(guitar, brass, [0, .18 + i * .102, .107], [.115, .009, .009]);
  batchParts(guitar, [...guitar.children]);
  return t => {
    guitar.rotation.z = -.55 + .06 * Math.sin(t * 5);
    return [guitar.localToWorld(new THREE.Vector3(.02, neck * .78, .13)),
      guitar.localToWorld(new THREE.Vector3(.01 + Math.sin(t * 13) * .11, -.12, .17))];
  };
}

function drumKit(root) {
  const kick = cylinder(root, coral, [.15, .46, .8], .46, .39);
  kick.rotation.x = Math.PI / 2;
  cylinder(root, cream, [.15, .46, 1.01], .42, .025).rotation.x = Math.PI / 2;
  cylinder(root, ink, [.22, .48, 1.026], .12, .015).rotation.x = Math.PI / 2;
  for (const [x, y, z, r] of [[-.45, .73, .56, .29], [.45, .91, .63, .25]]) {
    cylinder(root, coral, [x, y, z], r, .23);
    cylinder(root, cream, [x, y + .13, z], r * 1.02, .03);
    rod(root, ink, [x, .02, z], [x, y, z]);
  }
  const cymbals = [[-.85, 1.15, .74], [.9, 1.22, .77]].map(([x, y, z]) => {
    rod(root, ink, [x, .02, z], [x, y, z]);
    for (const dx of [-.25, .25]) rod(root, ink, [x + dx, .02, z + .19], [x, .34, z], .023);
    const cymbal = cylinder(root, brass, [x, y, z], .31, .038);
    ball(root, brass, [x, y + .025, z], [.12, .056, .12]);
    return cymbal;
  });
  return t => {
    cymbals.forEach((c, i) => c.rotation.z = Math.sin(t * 10 + i) * .13);
    return [-1, 1].map((side, i) => root.localToWorld(new THREE.Vector3(side * .44, 1.02 + .24 * Math.sin(t * 11 + i * Math.PI), .32)));
  };
}

function keyboard(root) {
  const start = root.children.length;
  for (const side of [-1, 1]) rod(root, ink, [side * .7, .01, .53], [-side * .57, 1.02, .53], .056);
  box(root, coral, [0, 1.05, .57], [1.66, .14, .49]);
  for (let i = 0; i < 14; i++) {
    const x = (i - 6.5) * .109;
    box(root, cream, [x, 1.132, .53], [.098, .028, .28]);
    if (![2, 6, 9, 13].includes(i)) box(root, ink, [x + .05, 1.155, .62], [.06, .038, .15]);
  }
  batchParts(root, root.children.slice(start));
  return t => [-1, 1].map((side, i) => root.localToWorld(new THREE.Vector3(side * .29 + Math.sin(t * 5 + i) * .13, 1.17 + .05 * Math.sin(t * 13 + i), .49)));
}

function microphone(root) {
  cylinder(root, ink, [0, .04, .62], .22, .08);
  rod(root, ink, [0, .06, .62], [0, 1.39, .62]);
  rod(root, ink, [0, 1.39, .62], [0, 1.55, .30], .045);
  ball(root, '#a8bbc1', [0, 1.55, .29], [.083, .08, .11]);
  return t => [root.localToWorld(new THREE.Vector3(.08, 1.39, .39 + .035 * Math.sin(t * 6))), null];
}

// Keep the existing Mixamo clip on the torso and legs, then put each wrist on
// its playing target with the rig's original upper-arm and forearm lengths.
function aimBone(bone, child, target) {
  const origin = bone.getWorldPosition(new THREE.Vector3());
  const from = bone.parent.worldToLocal(child.getWorldPosition(new THREE.Vector3()));
  const to = bone.parent.worldToLocal(target.clone());
  const pivot = bone.parent.worldToLocal(origin);
  bone.quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(from.sub(pivot).normalize(), to.sub(pivot).normalize()));
}
function reach(hand, target) {
  if (!target) return;
  const forearm = hand.parent, arm = forearm.parent;
  const shoulder = arm.getWorldPosition(new THREE.Vector3());
  const elbow = forearm.getWorldPosition(new THREE.Vector3());
  const upper = shoulder.distanceTo(elbow), lower = elbow.distanceTo(hand.getWorldPosition(new THREE.Vector3()));
  const direction = target.clone().sub(shoulder).normalize();
  const length = THREE.MathUtils.clamp(target.distanceTo(shoulder), Math.abs(upper - lower) + .001, upper + lower - .001);
  const along = (upper ** 2 - lower ** 2 + length ** 2) / (2 * length);
  const down = new THREE.Vector3(0, -1, 0);
  down.addScaledVector(direction, -down.dot(direction)).normalize();
  const bend = shoulder.clone().addScaledVector(direction, along).addScaledVector(down, Math.sqrt(Math.max(0, upper ** 2 - along ** 2)));
  aimBone(arm, forearm, bend);
  aimBone(forearm, hand, target);
}

function speaker(root, x) {
  for (const [y, w, h] of [[1.28, 1.26, .8], [2.025, 1.0, .65], [2.62, .92, .49]]) {
    box(root, ink, [x, y, -45.98], [w, h, .77]);
    box(root, '#415257', [x, y, -45.58], [w * .88, h * .84, .025]);
    const cone = cylinder(root, '#202f34', [x, y, -45.548], h * .34, .035);
    cone.rotation.x = Math.PI / 2;
    ball(root, '#56686c', [x, y, -45.51], [h * .13, h * .13, .02]);
  }
}

function noteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 73px Georgia';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#3f5967';
  ctx.lineWidth = 8;
  ctx.strokeText('♫', 48, 52);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('♫', 48, 52);
  return new THREE.CanvasTexture(canvas);
}

function washTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.88)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.45)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export async function buildFestivalStage(scene, sign, town) {
  const root = new THREE.Group();
  root.name = 'Merrymead Sessions festival';
  root.visible = false;
  scene.add(root);
  const stacks = new THREE.Group();
  stacks.name = 'Merrymead PA stacks';
  scene.add(stacks);
  for (const x of [-72.55, -61.45]) speaker(stacks, x);
  batchParts(stacks, [...stacks.children]);

  const {position: [gateX, gateZ], width} = FESTIVAL_GATE;
  for (const x of [gateX - width / 2, gateX + width / 2]) {
    box(root, '#89654d', [x, 1.5, gateZ], [.16, 3, .16]);
    ball(root, brass, [x, 3.04, gateZ], [.14, .14, .14]);
  }
  sign('MERRYMEAD MUSIC FESTIVAL', gateX, 2.75, gateZ + .13, width, '#913e45', root);

  const flags = instances(root, new THREE.ConeGeometry(.22, .53, 3).rotateZ(Math.PI), toonMaterial('#ffffff'), 18);
  flags.castShadow = true;
  for (let i = 0; i < flags.count; i++) {
    const u = i / (flags.count - 1);
    instanceAt(flags, i, [-71.6 + u * 9.2, 3.83 - .62 * Math.sin(u * Math.PI), -50.46], [1, 1, .28]);
    flags.setColorAt(i, new THREE.Color([coral, brass, cream, blue][i % 4]));
  }

  const bulbs = instances(root, sphere, new THREE.MeshBasicMaterial({color: cream}), 23);
  for (let i = 0; i < bulbs.count; i++) {
    const theta = .15 + i / (bulbs.count - 1) * (Math.PI - .3);
    instanceAt(bulbs, i, [-67 + 5.98 * Math.cos(theta), .9 + 5.98 * Math.sin(theta), -46.47], [.088, .088, .088]);
  }

  const washMap = washTexture();
  const washes = ['#ffae73', '#c394ff', '#60ead2'].map((color, i) => {
    const light = new THREE.PointLight(color, 0, 9, 1.65);
    light.position.set(-70.2 + i * 3.25, 3.65, -47);
    scene.add(light);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.38, 3.85), new THREE.MeshBasicMaterial({
      color, map: washMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.position.set(-69.9 + i * 2.8, 2.72, -50.7);
    root.add(glow);
    return {light, glow};
  });
  const notes = instances(root, new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial({
    map: noteTexture(), alphaTest: .38, side: THREE.DoubleSide, depthWrite: false,
  }), 8);
  notes.frustumCulled = false;
  for (let i = 0; i < notes.count; i++) notes.setColorAt(i, new THREE.Color([cream, '#ffb88c', '#a7f6dc'][i % 3]));

  const builders = {guitar: p => stringInstrument(p, false), bass: p => stringInstrument(p, true), drums: drumKit, keys: keyboard, vocals: microphone};
  const [band, stalls] = await Promise.all([
    Promise.all(BAND.map(async ({id, model, position: [x, z]}, i) => {
      const object = await place('townsfolk-' + model, {x, z, scale: 1.07, animated: true});
      object.position.y = STAGE_HEIGHT;
      object.name = 'Merrymead performer · ' + id;
      root.add(object);
      const mixer = createVillagerMixer(object, i);
      // Instruments are placed in the performer's coordinates, in front of +Z.
      const targets = builders[id](object);
      if (id === 'drums') for (const hand of mixer?.hands || []) {
        // Mixamo bones are in centimeters in the source GLBs.
        const scale = hand.getWorldScale(new THREE.Vector3()).x;
        rod(hand, '#d4a56b', [0, 0, 0], [0, -.28 / scale, .065 / scale], .021 / scale);
      }
      return {id, object, mixer, targets};
    })),
    Promise.all(FESTIVAL_STALLS.map(async ({asset, label, position: [x, z], scale, elevation}) => {
      const stall = await fairgroundModel(asset, {x, y: elevation, z, scale});
      root.add(stall);
      sign(label, x, 2.22, z + 1.13, 2.45, '#913e45', root);
      return stall;
    })),
  ]);

  tagDistrictModels(root, town, 'fair');

  return {root, band, stalls, update(t, dt, hour, active) {
    root.visible = active;
    const dusk = THREE.MathUtils.smoothstep(hour, 16, 19.5);
    for (const [i, {light, glow}] of washes.entries()) {
      const pulse = .7 + .3 * Math.sin(t * 6.4 + i * 2.1);
      light.intensity = active ? (6 + dusk * 17) * pulse : 0;
      glow.material.opacity = (.16 + dusk * .58) * pulse;
    }
    if (!active) return;
    for (const {id, object, mixer, targets} of band) {
      mixer?.update({clip: id === 'vocals' ? CLIP.look : CLIP.work}, {dt});
      object.rotation.z = Math.sin(t * 5 + object.position.x) * .036;
      const hands = targets(t);
      mixer?.hands.forEach((hand, i) => reach(hand, hands[i]));
    }
    for (let i = 0; i < notes.count; i++) {
      const u = (t * .30 + i / notes.count) % 1;
      const size = (.39 + .43 * Math.sin(Math.PI * u)) * (i % 2 ? .86 : 1);
      instanceAt(notes, i, [-70.55 + (i % 5) * 1.62 + Math.sin(u * 4 + i) * .52, 2.80 + u * 3.02, -46.20 + (i % 3) * .25], [size, size, size], Math.PI / 5);
    }
    notes.instanceMatrix.needsUpdate = true;
  }, audit() {
    return {
      active: root.visible, stalls: root.visible ? stalls.length : 0, notes: root.visible ? notes.count : 0,
      lights: washes.map(({light}) => light.intensity),
      band: root.visible ? band.map(({id, object, mixer}) => {
        const {clip, tPose} = mixer?.sample() ?? {};
        return {id, position: [object.position.x, object.position.z], yaw: object.rotation.y, band: true, clip, tPose};
      }) : [],
    };
  }};
}
