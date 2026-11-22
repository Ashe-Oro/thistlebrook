import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { batchStaticLines, batchStaticMeshes, INK_VERTEX_REPLACES, patchInkVertexShader } from '../src/astra/static-batches.js';
import { bindMeshDetail, createModelDetail } from '../src/astra/model-detail.js';
import { configureRigidBatches, createRigidBatches } from '../src/astra/rigid-batches.js';
import { sceneryVisibility } from '../src/astra/scenery-visibility.js';
import { renderCoverage, tagAssembly, tagBatch } from '../src/astra/registry/render-tags.js';
import { outlineMaterial, toonMaterial } from '../src/toon.js';

test('static batches keep district-local transforms, palette and placement coverage', () => {
  const source = new THREE.Group(), parent = new THREE.Group();
  parent.position.x = 180;
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  for (const [id, x, color] of [['bench', 4, '#d3b291'], ['table', 10, '#e4b981']]) {
    const mesh = new THREE.Mesh(geometry, toonMaterial(color));
    mesh.position.x = x;
    mesh.userData.registryId = id;
    source.add(mesh);
  }
  const assembly = batchStaticMeshes(source, parent);
  assert.equal(assembly.children.length, 1);
  const [batch] = assembly.children;
  assert.deepEqual(batch.userData.registryIds, ['bench', 'table']);
  assert.deepEqual(new THREE.Box3().setFromObject(parent).getCenter(new THREE.Vector3()).toArray(), [187, 0, 0]);
  const colors = batch.geometry.attributes.color;
  assert(Math.abs(colors.getY(0) - new THREE.Color('#d3b291').g) < 1e-6);
  assert(Math.abs(colors.getY(geometry.attributes.position.count) - new THREE.Color('#e4b981').g) < 1e-6);
  assert.deepEqual(renderCoverage(parent, { registry: { places: [{ id: 'bench' }, { id: 'table' }] } }), []);
});

test('merged ink follows each model scale and bound detail remains live', async () => {
  const source = new THREE.Group(), parent = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  for (const [thickness, scale] of [[.1, 2], [.2, 3]]) {
    const hull = new THREE.Mesh(geometry, outlineMaterial(thickness));
    hull.scale.x = scale;
    hull.userData.outline = true;
    source.add(hull);
  }
  const changeable = new THREE.Mesh(geometry, toonMaterial('#ffffff'));
  source.add(changeable);
  const detail = createModelDetail({ x: 0, z: 0, zoom: .2 });
  const replacement = new THREE.BoxGeometry(2, 2, 2);
  bindMeshDetail(detail, [[0, 0]], changeable, async () => replacement);
  const assembly = batchStaticMeshes(source, parent);
  tagAssembly(parent, 'district');
  const instance = assembly.children.find(mesh => mesh.isInstancedMesh);
  const ink = assembly.children.find(mesh => mesh.userData.outline).geometry.attributes.inkOffset;
  assert(Math.abs(ink.getX(0) - .2) < 1e-6);
  assert(Math.abs(ink.getX(geometry.attributes.position.count) - .6) < 1e-6);
  assert.equal(instance.geometry, geometry);
  detail.update({ x: 0, z: 0, zoom: 3 });
  await detail.settled();
  assert.equal(instance.geometry, replacement);
  assert.deepEqual(renderCoverage(parent, { registry: { places: [{ id: 'district' }] } }), []);
});

test('static wire batches keep independent line strips and inherited registry IDs', () => {
  const source = new THREE.Group(), parent = new THREE.Group();
  for (const x of [2, 5]) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 1),
    ]), new THREE.LineBasicMaterial({ color: 0x990000 }));
    line.position.x = x;
    source.add(line);
  }
  source.updateMatrixWorld(true);
  batchStaticLines(source, parent);
  tagAssembly(parent, 'district');
  const [wire] = parent.children;
  const positions = wire.geometry.attributes.position;
  assert.equal(positions.count, 8);
  assert.deepEqual([positions.getX(3), positions.getX(4)], [2, 5]);
  assert.deepEqual(wire.userData.registryIds, ['district']);
});

test('rigid batches follow poses, accept detail swaps and restore the original draw path', () => {
  const root = new THREE.Group(), moving = new THREE.Group();
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = toonMaterial('#a37f67');
  root.add(moving);
  const fixed = new THREE.InstancedMesh(geometry, material, 2);
  const pose = new THREE.Mesh(geometry, material);
  fixed.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, 0, 0));
  fixed.setMatrixAt(1, new THREE.Matrix4().makeTranslation(7, 0, 0));
  moving.add(fixed, pose);
  configureRigidBatches(true);
  try {
    const collection = createRigidBatches(root, { includeInstances: true });
    const [batch] = collection.newMeshes;
    const matrix = new THREE.Matrix4();
    assert(batch.isBatchedMesh);
    assert.equal(fixed.layers.mask, 0);
    assert.equal(batch.getMatrixAt(0, matrix).elements[12], 5);
    moving.position.x = 11;
    fixed.count = 1;
    collection.update();
    assert.equal(batch.getMatrixAt(0, matrix).elements[12], 16);
    assert.equal(batch.getVisibleAt(1), false);
    pose.geometry = new THREE.BoxGeometry(2, 2, 2);
    collection.update();
    assert.equal(pose.layers.mask, 1);
    assert.equal(batch.getVisibleAt(2), false);
    collection.setActive(false);
    assert.equal(fixed.layers.mask, 1);
    assert.equal(batch.visible, false);
    collection.setActive(true);
    assert.equal(fixed.layers.mask, 0);
    assert.equal(batch.visible, true);
  } finally {
    configureRigidBatches(false);
  }
  assert.equal(createRigidBatches(root).newMeshes.length, 0);
});


test('scenery culling keeps visible instance matrices and placement IDs aligned', () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), toonMaterial('#ffffff'), 2);
  const visibility = sceneryVisibility();
  const first = new THREE.Matrix4(), second = new THREE.Matrix4().makeTranslation(96, 0, 0);
  mesh.setMatrixAt(0, first);
  mesh.setMatrixAt(1, second);
  visibility.add(mesh, [{ pos: [0, 0] }, { pos: [96, 0] }]);
  tagBatch(mesh, ['one', 'two']);

  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 10);
  camera.position.set(96, 0, 5);
  camera.updateMatrixWorld();
  const update = () => visibility.update(frustum.setFromProjectionMatrix(
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)));
  update();
  assert.equal(mesh.count, 1);
  assert.deepEqual(mesh.userData.registryIds, ['two', 'one']);
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(0, matrix);
  assert(matrix.equals(second));

  camera.left = -100;
  camera.updateProjectionMatrix();
  update();
  assert.equal(mesh.count, 2);
  assert.deepEqual(mesh.userData.registryIds, ['one', 'two']);
  mesh.getMatrixAt(0, matrix);
  assert(matrix.equals(first));
});


test('batched ink shader replaces match the outline vertex shader and drop uThickness', () => {
  const source = outlineMaterial(0).vertexShader;
  assert(source.includes('safeNormal * uThickness * k'));
  for (const [from] of INK_VERTEX_REPLACES) {
    assert(source.includes(from), `outline vertex shader no longer contains ${JSON.stringify(from)}`);
  }
  const patched = patchInkVertexShader(source);
  assert(!patched.includes('uThickness'));
  assert(patched.includes('attribute vec3 inkOffset'));
  assert(patched.includes('inkOffset * k'));
  assert(!patched.includes('safeNormal'));
  assert(!patched.includes('nLen'));
});

test('merged ink bakes zero-length normals to a zero offset, not NaN', () => {
  const source = new THREE.Group(), parent = new THREE.Group();
  const material = outlineMaterial(0.2);
  // Distinct geometries so the batcher merges two members (and bakes inkOffset)
  // instead of instancing a single shared mesh.
  for (const x of [0, 2]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0, 0, 0, 0], 3));
    const hull = new THREE.Mesh(geometry, material);
    hull.position.x = x;
    hull.userData.outline = true;
    source.add(hull);
  }
  const assembly = batchStaticMeshes(source, parent);
  const ink = assembly.children.find(mesh => mesh.userData.outline).geometry.attributes.inkOffset;
  assert.equal(ink.count, 6);
  for (let i = 0; i < ink.count; i++) {
    assert(Number.isFinite(ink.getX(i)) && Number.isFinite(ink.getY(i)) && Number.isFinite(ink.getZ(i)));
  }
  for (const offset of [0, 3]) {
    assert.deepEqual([ink.getX(offset), ink.getY(offset), ink.getZ(offset)], [0, 0, 0]);
    assert(Math.abs(ink.getY(offset + 1) - 0.2) < 1e-6);
    assert.deepEqual([ink.getX(offset + 1), ink.getZ(offset + 1)], [0, 0]);
    assert.deepEqual([ink.getX(offset + 2), ink.getY(offset + 2), ink.getZ(offset + 2)], [0, 0, 0]);
  }
});
