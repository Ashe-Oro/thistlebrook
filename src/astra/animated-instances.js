import * as THREE from 'three';

/** Put identical animated parts with authored local poses in a single draw. */
export function animatedInstances(parent, parts, { name, bounds }) {
  const source = parts[0];
  if (!source) return { update() {} };

  const mesh = new THREE.InstancedMesh(source.geometry, source.material, parts.length);
  mesh.name = name;
  mesh.castShadow = source.castShadow;
  mesh.receiveShadow = source.receiveShadow;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (bounds) mesh.boundingSphere = bounds;
  else mesh.frustumCulled = false;
  mesh.userData.registryIds = parts.map(part => part.userData.registryId);
  parent.add(mesh);
  function update() {
    parts.forEach((part, index) => {
      part.updateMatrix();
      mesh.setMatrixAt(index, part.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update();
  return { update };
}
