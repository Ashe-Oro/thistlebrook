import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchInstances } from '../src/compiler/batches.js';
import { makeTree, makeGate, makeGround, makeHills } from '../src/builders.js';

for (const build of [() => makeTree(1.2, 3), () => makeGate({ width: 2.9, open: 0.55 })]) {
  const template = new THREE.Group();
  template.name = 'template';
  template.userData.entry = { bounds: { min: [-2, 0, -2], max: [2, 5, 2] } };
  const content = build();
  content.scale.setScalar(1.6);
  content.rotation.y = Math.PI;
  content.position.y = -0.2;
  template.add(content);
  const instances = [
    { pos: [9, -4], rotY: 0.8, scale: 1 },
    { pos: [-12, 7], rotY: -1.4, scale: 0.7 },
    { pos: [3, 16], rotY: 2.9, scale: 1.15, pavingWidth: 2 },
  ];
  const originals = new THREE.Group();
  for (const i of instances) {
    const copy = template.clone(true);
    copy.position.set(i.pos[0], 0, i.pos[1]); copy.rotation.y = i.rotY; copy.scale.setScalar(i.scale);
    if (i.pavingWidth) copy.scale.x *= i.pavingWidth / 5;
    originals.add(copy);
  }
  const batched = batchInstances(template, instances);
  const expected = new THREE.Box3().setFromObject(originals);
  const actual = new THREE.Box3().setFromObject(batched);
  assert(expected.min.distanceTo(actual.min) < 1e-5 && expected.max.distanceTo(actual.max) < 1e-5, 'batches preserve world extents of nested geometry / ink');
  const sourceMeshes = [];
  template.traverse(o => { if (o.isMesh) sourceMeshes.push(o); });
  const batches = batched.children.filter(o => o.isInstancedMesh);
  assert.equal(batches.length, sourceMeshes.length, 'one draw per template mesh, independent of copy count');
  for (const [i, b] of batches.entries()) {
    assert.equal(b.count, instances.length);
    assert.equal(b.geometry, sourceMeshes[i].geometry);
    assert.equal(b.material, sourceMeshes[i].material);
    assert.equal(b.userData.outline, sourceMeshes[i].userData.outline);
    assert.equal(b.userData.foliage, sourceMeshes[i].userData.foliage);
    assert.equal(b.userData.instances, instances);
  }
  const pivots = batched.children.filter(o => o.userData.batchPivot);
  assert.equal(pivots.length, instances.length);
  assert(pivots.every((p, i) => p.userData.inst === instances[i] && p.userData.entry === template.userData.entry));
}
console.log('batches: tree and gate geometry, ink, bounds, shared resources and per-instance metadata pass');

// A submerged water surface must not be masked by the flat grass disk.
const ground = makeGround(165,[{ min:[-75.5,-90.5], max:[-70.5,-80.5] }]);
ground.updateMatrixWorld(true);
const down = new THREE.Vector3(0,-1,0);
assert.equal(new THREE.Raycaster(new THREE.Vector3(-73,10,-88),down).intersectObject(ground,true).length,0);
assert(new THREE.Raycaster(new THREE.Vector3(-77,10,-88),down).intersectObject(ground,true).length > 0);
const oldHills = makeHills(125/70);
const spots = [[-45,-8,-55,18],[40,-6,-60,22],[0,-10,-70,30],[-62,-7,-30,16],[60,-9,-20,20],[-30,-6,-48,14]];
for (const [index,h] of oldHills.children.entries()) {
  assert.deepEqual(h.position.toArray(),spots[index].slice(0,3).map(x=>x*(125/70)));
  assert.equal(h.geometry.parameters.radius,spots[index][3]);
}
console.log('runtime geometry: water opening exposes channel, nearby grass remains, default hills retain original geometry');
