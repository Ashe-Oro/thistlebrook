import * as THREE from 'three';

// Flatten each template mesh (including its ink hull) into a draw batch.
// Nested source transforms are baked into matrices, so child hulls and native
// scale/yaw offsets keep exactly the same placement as loader.place().
export function batchInstances(template, instances) {
  template.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = `batch:${template.name}`;
  group.userData.instances = instances;
  const transform = new THREE.Object3D(), matrix = new THREE.Matrix4();
  template.traverse(source => {
    if (!source.isMesh) return;
    const batch = new THREE.InstancedMesh(source.geometry, source.material, instances.length);
    batch.name = source.userData.outline ? 'ink-batch' : template.name;
    batch.userData = { ...source.userData, instances };
    batch.castShadow = source.castShadow;
    batch.receiveShadow = source.receiveShadow;
    batch.renderOrder = source.renderOrder;
    batch.layers.mask = source.layers.mask;
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      transform.position.set(inst.pos[0], 0, inst.pos[1]);
      transform.rotation.set(0, inst.rotY, 0);
      transform.scale.set(inst.scale || 1, inst.scale || 1, inst.scale || 1);
      if (inst.pavingWidth) transform.scale.x *= inst.pavingWidth / 5;
      transform.updateMatrix();
      batch.setMatrixAt(i, matrix.multiplyMatrices(transform.matrix, source.matrixWorld));
    }
    batch.instanceMatrix.needsUpdate = true;
    batch.computeBoundingBox();
    batch.computeBoundingSphere();
    group.add(batch);
  });
  // Lightweight pivots keep the existing anchor/debug API and per-instance
  // camera bounds. Raycasts use batch.userData.instances[hit.instanceId].
  for (const inst of instances) {
    const pivot = new THREE.Group();
    pivot.position.set(inst.pos[0], 0, inst.pos[1]);
    pivot.rotation.y = inst.rotY;
    pivot.scale.setScalar(inst.scale || 1);
    if (inst.pavingWidth) pivot.scale.x *= inst.pavingWidth / 5;
    pivot.userData = { inst, entry: template.userData.entry, batchPivot: true };
    group.add(pivot);
  }
  return group;
}
