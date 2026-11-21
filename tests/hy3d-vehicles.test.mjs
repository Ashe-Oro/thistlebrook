import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import draco from 'draco3dgltf';
import {compileAstra} from '../src/compiler/astra.js';
import {resolveAll} from '../src/catalog/resolve-all.js';
import {TOWN_RULE} from '../src/compiler/town-rules.js';
import {fitToFootprint, hy3dTemplateFromGeometry, loadHy3dModels} from '../src/astra/hy3d/index.js';
import manifest from '../src/astra/hy3d/models.json' with {type: 'json'};
import {createTeslaVehicle, TESLA_HY3D_SLUGS, TESLA_STYLES, teslaLampSpots} from '../src/astra/tesla/models.js';
import {createTeslaTown} from '../src/astra/tesla/index.js';
import {DEMO, HOVER_PAD, LINEUP, RAMP, roadsterPose} from '../src/astra/tesla/demo-motion.js';
import {ARENA_MASTS, arenaFixtures, STARBASE_SITE} from '../src/astra/night-landmarks.js';
import {batchStatic, displayRocket, rocket} from '../src/astra/starbase-models.js';
import {assertRoadsterClearance, assertRowClearance} from './helpers/roadster-clearance.mjs';

const asset = (name) => new URL(`../public/${manifest.dir}${name}`, import.meta.url);
const kinds = Object.keys(TESLA_STYLES);
const box = (slug) => {
  const [x, y, z] = manifest.models[slug].dims;
  return hy3dTemplateFromGeometry(slug, new THREE.BoxGeometry(x, y, z));
};
const templates = new Map(Object.keys(manifest.models).map(slug => [slug, box(slug)]));
const catalog = resolveAll(JSON.parse(readFileSync(new URL('../src/catalog/bounds.json', import.meta.url))));
const town = compileAstra(catalog, 831);
const sceneSystem = (hy3d) => {
  const scene = new THREE.Scene();
  const traffic = { root: new THREE.Group(), objects: [], simulation: { vehicles: [] } };
  const tesla = createTeslaTown(scene, town, { traffic, hy3d });
  assert.equal(tesla.adapter.installed.length, 0);
  return {scene, tesla};
};

test('HY3D manifest covers the arena and the browser loader is inert in Node', async () => {
  assert.equal(manifest.dir, 'licensed/hy3d/');
  for (const [slug, {source, look, tris, texture, color, dims, yaw}] of Object.entries(manifest.models)) {
    assert.match(slug, /^[a-z0-9-]+$/);
    assert.match(source, /\.glb$/);
    assert(Number.isInteger(tris) && tris > 0);
    assert.equal(dims.length, 3);
    assert(dims.every(n => Number.isFinite(n) && n > 0));
    assert(yaw === undefined || Number.isFinite(yaw));
    if (look === 'tex') assert(Number.isInteger(texture) && texture > 0);
    else {
      assert.equal(look, 'flat');
      assert.match(color, /^#[a-f0-9]{6}$/i);
    }
  }
  for (const kind of [...LINEUP.map(item => item.kind), 'roadster', 'model-s', 'model-x'])
    assert(templates.has(TESLA_HY3D_SLUGS[kind]), kind);
  const pending = loadHy3dModels();
  assert.strictEqual(loadHy3dModels(), pending);
  assert.equal((await pending).size, 0);
  assert.deepEqual(fitToFootprint({width: 4, length: 4, height: 1}, {width: 1, length: 2, height: 1}), {
    scale: .25, offset: [0, 0, 0],
  });
});

test(`${TOWN_RULE.generatedFootprint} each generated Tesla keeps the factory contract and shared mesh resources`, () => {
  const scale = 1.3;
  for (const kind of kinds) {
    const procedural = createTeslaVehicle(kind, {scale});
    const car = createTeslaVehicle(kind, {scale, hy3d: templates});
    const template = templates.get(TESLA_HY3D_SLUGS[kind]);
    assert.equal(car.userData.kind, kind);
    assert.equal(car.userData.pivot.position.y, .43);
    assert.equal(car.userData.pivot.children[0].position.y, -.43);
    assert.deepEqual(car.userData.dimensions, procedural.userData.dimensions, kind);
    assert.equal(car.userData.wheelRadius, procedural.userData.wheelRadius);
    assert.equal(car.userData.wheels.length, kind === 'semi' ? 6 : 4);
    car.userData.wheels.forEach((wheel, i) => {
      assert(!wheel.visible && !wheel.isMesh);
      assert.deepEqual(wheel.position.toArray(), procedural.userData.wheels[i].position.toArray());
    });
    car.userData.animate({distance: 3, night: 1, stage: true});
    assert.equal(car.userData.wheels[0].rotation.x, 3 / car.userData.wheelRadius);
    car.updateMatrixWorld(true);
    const meshes = [];
    car.traverseVisible(obj => { if (obj.isMesh) meshes.push(obj); });
    assert.equal(meshes.length, 4, kind);
    assert.equal(meshes.filter(mesh => mesh.geometry === template.geometry).length, 2);
    let disposed = false;
    const onDispose = () => { disposed = true; };
    for (const resource of [template.geometry, template.material, template.outline]) resource.addEventListener('dispose', onDispose);
    const {length, width} = TESLA_STYLES[kind];
    for (const [role, sign] of [['head', 1], ['tail', -1]]) {
      const mesh = meshes.find(m => m.userData.lamp === role);
      assert(mesh?.geometry.attributes.position.count, `${kind} ${role}`);
      const {min, max} = new THREE.Box3().setFromObject(mesh, true);
      assert(Math.max(Math.abs(min.x), Math.abs(max.x)) <= width * scale / 2);
      assert(Math.abs((min.z + max.z) / (scale * length) - sign) <= .05, `${kind} ${role}`);
      assert(mesh.material.color.r > 1, `${kind} ${role} should glow on stage`);
    }
    car.userData.dispose();
    assert(!disposed);
    for (const resource of [template.geometry, template.material, template.outline]) resource.removeEventListener('dispose', onDispose);
    procedural.userData.dispose();
  }
});

test('an empty generated map uses the same procedural body for every kind', () => {
  for (const kind of kinds) {
    const a = createTeslaVehicle(kind), b = createTeslaVehicle(kind, {hy3d: new Map()});
    const meshes = root => {
      const parts = [];
      root.traverse(object => {
        if (object.isMesh) parts.push({
          vertices: object.geometry.attributes.position.array,
          lamp: object.userData.lamp, outline: object.userData.outline, position: object.position.toArray(),
        });
      });
      return parts;
    };
    assert.deepEqual(a.userData.dimensions, b.userData.dimensions);
    assert.deepEqual(meshes(a), meshes(b), kind);
    a.userData.dispose(); b.userData.dispose();
  }
});

function assertChargingClearance(scene, tesla) {
  const {arena, roadster} = tesla;
  const localBox = (min, max) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
  const zones = {
    ramp: localBox([RAMP.x - RAMP.width / 2 - .32, 0, RAMP.z - RAMP.radius - 1.9],
      [RAMP.x + RAMP.width / 2 + .32, 12, RAMP.z + 1]),
    hover: localBox([HOVER_PAD.x - 2.68, 0, HOVER_PAD.z - 2.68], [HOVER_PAD.x + 2.68, 7, HOVER_PAD.z + 2.68]),
    grandstand: arena.grandstandBounds,
    'east connection': localBox([21.4, 0, -19.4], [23, 1, 19.4]),
    ...Object.fromEntries(ARENA_MASTS.map(({role, x, z}) => [role, localBox([x - .55, 0, z - .55], [x + .55, 1, z + .55])])),
  };
  const bounds = Object.entries(arena.audit().chargingBay).flatMap(([name, entries]) => entries.map(({min, max}) => ({
    name, box: localBox(min, max),
  })));
  const overlaps = (a, b) => a.min.x <= b.max.x && a.max.x >= b.min.x && a.min.z <= b.max.z && a.max.z >= b.min.z;
  for (const prop of bounds) for (const [name, zone] of Object.entries(zones))
    assert(!overlaps(prop.box, zone), `${prop.name} intersects ${name}`);
  const car = roadster.object;
  car.userData.jets.removeFromParent();
  scene.updateMatrixWorld(true);
  const worldToArena = arena.root.matrixWorld.clone().invert();
  for (let t = 0; t < DEMO.period; t += .025) {
    const pose = roadsterPose(t);
    car.position.set(pose.x, pose.y, pose.z);
    car.userData.pivot.quaternion.fromArray(pose.orientation);
    car.updateMatrixWorld(true);
    const footprint = new THREE.Box3().setFromObject(car, true).applyMatrix4(worldToArena);
    for (const prop of bounds) assert(!overlaps(footprint, prop.box), `${prop.name} at ${t}s`);
  }
}

function assertRampContact(car) {
  // Measure penetration against the inner cylinder of the authored ramp
  // using the actual vertices. Ink and cold-gas effects are visual overlays.
  let worst = -Infinity;
  const point = new THREE.Vector3();
  for (let t = 5; t < 28; t += .035) {
    const pose = roadsterPose(t);
    if (!pose.contact) continue;
    car.position.set(pose.localX, pose.y, pose.localZ);
    car.userData.pivot.quaternion.fromArray(pose.orientation);
    car.updateMatrixWorld(true);
    car.traverseVisible(mesh => {
      if (!mesh.isMesh || mesh.userData.outline) return;
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
        const y = DEMO.ground + RAMP.radius - point.y, z = RAMP.z - point.z;
        const angle = (Math.atan2(z, y) + 2 * Math.PI) % (2 * Math.PI);
        if (angle > RAMP.end || Math.abs(point.x - RAMP.x) > RAMP.width / 2) continue;
        worst = Math.max(worst, Math.hypot(y, z) - RAMP.radius);
      }
    });
  }
  assert(worst < .04, `Ramp overlap ${worst}`);
  assert(worst > -.035, `Ramp contact gap ${-worst}`);
}

test('generated arena clears the Roadster, grandstand, ramp, hover pad, connection and masts', () => {
  // A slab with square ground-level bumpers cannot follow a curved ramp.
  // Bevel the fake Roadster's underside to leave the same tire contact zone.
  const [width, height, length] = manifest.models['roadster-white'].dims;
  const shape = new THREE.BoxGeometry(width, height, length, 2, 4, 6);
  const p = shape.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < -height * .35) p.setZ(i, p.getZ(i) * .54);
  }
  shape.computeVertexNormals();
  const arenaTemplates = new Map(templates).set('roadster-white', hy3dTemplateFromGeometry('roadster-white', shape));
  assertRoadsterClearance(arenaTemplates);
  const {scene, tesla} = sceneSystem(arenaTemplates);
  try {
    assertRowClearance(scene, tesla);
    assertChargingClearance(scene, tesla);
    assertRampContact(tesla.roadster.object);
    const bounds = tesla.arena.audit().chargingBay;
    assert.equal(bounds.supercharger.length, 4);
    assert.equal(bounds.optimus.length, 2);
    for (const name of ['model-s', 'model-x', 'megapack', 'powerwall']) assert.equal(bounds[name].length, 1);
    const chargers = tesla.arena.root.children.filter(mesh => mesh.name === 'Superchargers');
    assert.equal(chargers.length, 2);
    assert(chargers.every(mesh => mesh.isInstancedMesh && mesh.count === 4));
  } finally { tesla.dispose(); }
});

test('night fixtures follow the generated lamp strips on parked and performing cars', () => {
  const {scene, tesla} = sceneSystem(templates);
  try {
    const {arena, roadster} = tesla;
    const fixtures = arenaFixtures({lineup: arena.lineup, roadster: roadster.object, charging: arena.charging.cars});
    const check = (car, moving) => {
      car.updateMatrix();
      for (const role of ['head', 'tail']) {
        const kind = car.userData.kind, expected = teslaLampSpots(kind, car)[role];
        const halos = fixtures.filter(f => f.prim === 'halo' && f.kind === `car-${role}` && f.role === kind);
        assert.equal(halos.length, 2);
        halos.forEach(({pos}, i) => {
          const point = new THREE.Vector3(...expected[i]);
          point.z += (role === 'head' ? 1 : -1) * (moving ? .03 : .04 / car.scale.x);
          if (!moving) point.applyMatrix4(car.matrix);
          assert(point.distanceTo(new THREE.Vector3(...pos)) < 1e-6, `${kind} ${role}`);
        });
      }
    };
    [...arena.lineup, ...arena.charging.cars].forEach(car => check(car, false));
    check(roadster.object, true);
    scene.updateMatrixWorld(true);
  } finally { tesla.dispose(); }
});

test('static Starships use the shared generated body and retain their display height', () => {
  const statics = new THREE.Group(), batches = new THREE.Group();
  const procedural = rocket('ship');
  procedural.flame.removeFromParent();
  const height = (root) => new THREE.Box3().setFromObject(root, true).getSize(new THREE.Vector3()).y;
  for (const {kind, x, z} of STARBASE_SITE.garden.filter(({kind}) => kind === 'ship')) {
    const ship = displayRocket(kind, templates);
    ship.position.set(x, .3, z);
    assert(Math.abs(height(ship) / height(procedural.root) - 1) < .10);
    const bounds = new THREE.Box3().setFromObject(ship, true);
    assert(bounds.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(x, 6.3, z)) < 1e-6);
    statics.add(ship);
  }
  batchStatic(statics, batches);
  const instances = [];
  batches.traverse(mesh => {if (mesh.isInstancedMesh) instances.push(mesh);});
  assert.equal(instances.length, 2);
  for (const mesh of instances) {
    assert.equal(mesh.geometry, templates.get('starship').geometry);
    assert.equal(mesh.count, 2);
  }
  assert.equal(instances.filter(mesh => mesh.userData.outline).length, 1);
});

test('locally built GLBs meet the file and triangle budgets and clear the arena', async (t) => {
  if (!existsSync(asset('build-report.json'))) return t.skip('HY3D build report is absent');
  const {models, total} = JSON.parse(readFileSync(asset('build-report.json')));
  const decoder = await draco.createDecoderModule();
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder': decoder});
  for (const [slug, model] of Object.entries(models)) {
    assert(manifest.models[slug], slug);
    assert(model.tris <= manifest.models[slug].tris, `${slug} reported triangle budget`);
  }
  assert.equal(total, Object.values(models).reduce((sum, model) => sum + model.bytes, 0));
  const built = new Map();
  let bytes = 0;
  for (const [slug, entry] of Object.entries(manifest.models)) {
    if (!existsSync(asset(`${slug}.glb`))) continue;
    const size = statSync(asset(`${slug}.glb`)).size;
    bytes += size;
    const document = await io.read(fileURLToPath(asset(`${slug}.glb`)));
    const [primitive] = document.getRoot().listMeshes()[0].listPrimitives();
    const indices = primitive.getIndices().getArray();
    const tris = indices.length / 3;
    assert(tris <= entry.tris, `${slug} triangle budget`);
    if (models[slug]) {
      assert.equal(tris, models[slug].tris, slug);
      assert.equal(size, models[slug].bytes, slug);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(primitive.getAttribute('POSITION').getArray(), 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(primitive.getAttribute('NORMAL').getArray(), 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    built.set(slug, hy3dTemplateFromGeometry(slug, geometry));
  }
  assert(total <= 1.5e6 && bytes <= 1.5e6);
  assertRoadsterClearance(built);
  const {scene, tesla} = sceneSystem(built);
  try {
    assertRowClearance(scene, tesla);
    assertChargingClearance(scene, tesla);
    assertRampContact(tesla.roadster.object);
    for (const car of [...tesla.arena.lineup, ...tesla.arena.charging.cars, tesla.roadster.object]) {
      if (!car.userData.hy3dSlug) continue;
      assert.equal(car.userData.lampSpots.head.length, 2, car.name);
      assert.equal(car.userData.lampSpots.tail.length, 2, car.name);
    }
  } finally { tesla.dispose(); }
});
